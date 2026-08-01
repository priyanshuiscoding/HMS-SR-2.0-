import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { demoUsers } from "../backend/src/config/constants.js";
import { env } from "../backend/src/config/env.js";
import { productionReadinessFailures } from "../backend/src/config/productionReadiness.js";
import { query, pgPool } from "../backend/src/config/postgres.js";

const DEFAULT_SECRETS = new Set([
  "change_me_to_a_long_random_secret",
  "change_me_to_a_different_long_random_secret",
  "replace_with_64_plus_random_chars",
  "replace_with_a_different_64_plus_random_chars"
]);

const requiredTables = [
  "users",
  "patients",
  "appointments",
  "opd_visits",
  "ipd_admissions",
  "panchkarma_sessions",
  "medicine_masters",
  "inventory_batches",
  "dispensations",
  "lab_orders",
  "bills",
  "payments",
  "audit_logs",
  "opd_general_examinations",
  "opd_systemic_examinations",
  "opd_history_taking",
  "auth_refresh_sessions"
];

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

const requiredSettings = [
  "consultation_charge",
  "opd_operating_hours",
  "ipd_ward_charges",
  "invoice_profiles",
  "approval_policy",
  "notification_templates"
];

const checks = [];

function pass(name, detail = "") {
  checks.push({ name, status: "passed", detail });
}

function fail(name, detail = "") {
  checks.push({ name, status: "failed", detail });
}

async function tableExists(tableName) {
  const result = await query("SELECT to_regclass($1) AS table_name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
}

async function settingExists(settingKey) {
  const result = await query("SELECT 1 FROM hospital_settings WHERE key = $1", [settingKey]);
  return Boolean(result.rows[0]);
}

async function main() {
  if (env.persistenceEnabled) pass("Persistence enabled");
  else fail("Persistence enabled", "PERSISTENCE_ENABLED must be true for production.");

  if (!DEFAULT_SECRETS.has(env.jwtAccessSecret) && !DEFAULT_SECRETS.has(env.jwtRefreshSecret)) {
    pass("JWT secrets configured");
  } else {
    fail("JWT secrets configured", "Replace default JWT secrets before deployment.");
  }

  if (env.jwtAccessSecret !== env.jwtRefreshSecret) pass("JWT secrets are distinct");
  else fail("JWT secrets are distinct", "Access and refresh secrets must differ.");

  const productionFailures = productionReadinessFailures({ ...env, nodeEnv: "production" });
  if (productionFailures.length === 0) {
    pass("Production secret strength");
  } else {
    fail("Production secret strength", productionFailures.join(" "));
  }

  await query("SELECT 1");
  pass("Database connectivity", env.databaseUrl ? "DATABASE_URL" : `${env.dbHost}:${env.dbPort}/${env.dbName}`);

  for (const tableName of requiredTables) {
    if (await tableExists(tableName)) pass(`Table ${tableName}`);
    else fail(`Table ${tableName}`, "Missing required table.");
  }

  for (const settingKey of requiredSettings) {
    if (await settingExists(settingKey)) pass(`Setting ${settingKey}`);
    else fail(`Setting ${settingKey}`, "Run npm run db:seed to seed required hospital settings.");
  }

  const migrationFiles = (await fs.readdir(path.join(projectRoot, "backend", "src", "database", "migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const migrationResult = await query("SELECT filename FROM schema_migrations ORDER BY filename");
  const appliedMigrations = new Set(migrationResult.rows.map((row) => row.filename));
  const pendingMigrations = migrationFiles.filter((name) => !appliedMigrations.has(name));
  if (pendingMigrations.length === 0) pass("Migrations applied", `${migrationFiles.length} migration(s) recorded.`);
  else fail("Migrations applied", `Pending: ${pendingMigrations.join(", ")}`);

  const legacyHashResult = await query("SELECT COUNT(*)::int AS count FROM users WHERE password_hash LIKE 'seed-sha256:%'");
  const legacyHashes = Number(legacyHashResult.rows[0]?.count || 0);
  if (legacyHashes === 0) pass("Bcrypt password hashes");
  else fail("Bcrypt password hashes", `${legacyHashes} user(s) still have legacy seed hashes; have them log in or reset passwords.`);

  const usersResult = await query("SELECT email, password_hash FROM users WHERE deleted_at IS NULL");
  const knownPasswords = Array.from(new Set([
    "Welcome@123",
    "Admin@123",
    "Reception@123",
    "Doctor@123",
    "Hr@12345",
    ...demoUsers.map((user) => user.password)
  ].filter(Boolean)));
  const usersWithKnownPasswords = [];
  for (const user of usersResult.rows) {
    for (const password of knownPasswords) {
      if (await bcrypt.compare(password, user.password_hash).catch(() => false)) {
        usersWithKnownPasswords.push(user.email);
        break;
      }
    }
  }
  if (usersWithKnownPasswords.length === 0) pass("No known/default user passwords");
  else fail("No known/default user passwords", `${usersWithKnownPasswords.length} account(s) still use a seeded/default password.`);

  const adminResult = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = true AND deleted_at IS NULL");
  if (Number(adminResult.rows[0]?.count || 0) > 0) pass("Active administrator exists");
  else fail("Active administrator exists", "Run npm run db:bootstrap-admin before starting the HMS.");

  const auditResult = await query("SELECT COUNT(*)::int AS count FROM audit_logs");
  pass("Audit table reachable", `${auditResult.rows[0]?.count || 0} audit row(s).`);

  console.log(JSON.stringify({ checks, failed: checks.filter((item) => item.status === "failed").length }, null, 2));

  if (checks.some((item) => item.status === "failed")) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
