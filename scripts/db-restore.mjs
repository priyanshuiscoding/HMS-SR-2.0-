import { access } from "fs/promises";
import { spawn } from "child_process";

import "../backend/src/config/env.js";
import { env } from "../backend/src/config/env.js";

const backupFile = process.argv[2];

function databaseArgs() {
  if (env.databaseUrl) {
    return ["-d", env.databaseUrl];
  }

  return ["-h", env.dbHost, "-p", String(env.dbPort), "-U", env.dbUser, "-d", env.dbName];
}

async function main() {
  if (!backupFile) {
    throw new Error("Usage: npm run db:restore -- <backup-file.dump>");
  }

  await access(backupFile);

  const pgRestoreBin = process.env.PG_RESTORE_BIN || "pg_restore";
  const child = spawn(pgRestoreBin, ["--clean", "--if-exists", ...databaseArgs(), backupFile], {
    stdio: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: env.dbPassword
    }
  });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log("Database restore complete.");
      return;
    }

    console.error(`pg_restore failed with exit code ${code}. Set PG_RESTORE_BIN to a pg_restore version compatible with the server.`);
    process.exitCode = code || 1;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
