import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { pgPool } from "../config/postgres.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

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

function checksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function appliedMigrations(client) {
  const result = await client.query("SELECT filename, checksum FROM schema_migrations ORDER BY filename");
  return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

async function run() {
  const client = await pgPool.connect();

  try {
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
        if (applied.get(file) !== hash) {
          throw new Error(`Migration checksum changed after apply: ${file}`);
        }

        console.log(`skip ${file}`);
        continue;
      }

      console.log(`apply ${file}`);
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [file, hash]);
    }

    console.log("Database migrations complete.");
  } finally {
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
