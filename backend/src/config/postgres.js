import { Pool } from "pg";

import { env } from "./env.js";

const poolConfig = env.databaseUrl
  ? {
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: env.dbSslRejectUnauthorized } : false
  }
  : {
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    ssl: env.dbSsl ? { rejectUnauthorized: env.dbSslRejectUnauthorized } : false
  };

poolConfig.connectionTimeoutMillis = env.dbConnectionTimeoutMs;
poolConfig.application_name = "sr-aiims-hms-api";

export const pgPool = new Pool(poolConfig);

export async function query(text, params = []) {
  return pgPool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
