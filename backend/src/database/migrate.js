import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { pgPool } from "../config/postgres.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");
const MIGRATION_LOCK_KEY = 729451388;

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n?/g, "\n");
}

function checksum(content) {
  return hashContent(normalizeLineEndings(content));
}

function checksumMatches(content, recordedChecksum) {
  const normalized = normalizeLineEndings(content);
  const candidates = [
    content,
    normalized,
    normalized.replace(/\n/g, "\r\n")
  ];

  return candidates.some((candidate) => hashContent(candidate) === recordedChecksum);
}

function withoutOuterTransaction(content) {
  const normalized = normalizeLineEndings(content);
  const match = normalized.match(/^\s*BEGIN\s*;([\s\S]*?)COMMIT\s*;\s*$/i);
  return match ? match[1].trim() : normalized;
}

async function appliedMigrations(client) {
  const result = await client.query("SELECT filename, checksum FROM schema_migrations ORDER BY filename");
  return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

async function run() {
  const client = await pgPool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);
    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, "utf8");
      const hash = checksum(sql);

      if (applied.has(file)) {
        if (!checksumMatches(sql, applied.get(file))) {
          throw new Error(`Migration checksum changed after apply: ${file}`);
        }

        console.log(`skip ${file}`);
        continue;
      }

      console.log(`apply ${file}`);
      await client.query("BEGIN");

      try {
        await client.query(withoutOuterTransaction(sql));
        await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [file, hash]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Database migrations complete.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
    await pgPool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
