import { mkdir } from "fs/promises";
import path from "path";
import { spawn } from "child_process";

import "../backend/src/config/env.js";
import { env } from "../backend/src/config/env.js";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function databaseArgs() {
  if (env.databaseUrl) {
    return [env.databaseUrl];
  }

  return ["-h", env.dbHost, "-p", String(env.dbPort), "-U", env.dbUser, env.dbName];
}

async function main() {
  const backupDir = path.resolve("backups");
  await mkdir(backupDir, { recursive: true });

  const filePath = path.join(backupDir, `hms-${timestamp()}.dump`);
  const args = ["-Fc", "-f", filePath, ...databaseArgs()];
  const pgDumpBin = process.env.PG_DUMP_BIN || "pg_dump";
  const child = spawn(pgDumpBin, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: env.dbPassword
    }
  });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(`Backup written: ${filePath}`);
      return;
    }

    console.error(`pg_dump failed with exit code ${code}. Set PG_DUMP_BIN to a pg_dump version compatible with the server.`);
    process.exitCode = code || 1;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
