import crypto from "crypto";

import { query, withTransaction } from "../../config/postgres.js";

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export async function createRefreshSession({ userId, token, expiresAt }) {
  await query(
    `
    INSERT INTO auth_refresh_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [userId, tokenHash(token), expiresAt]
  );
}

export async function rotateRefreshSession({ currentToken, userId, nextToken, nextExpiresAt }) {
  return withTransaction(async (client) => {
    const currentHash = tokenHash(currentToken);
    const nextHash = tokenHash(nextToken);
    const current = await client.query(
      `
      SELECT id, user_id
      FROM auth_refresh_sessions
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      FOR UPDATE
      `,
      [currentHash]
    );

    if (!current.rows[0] || current.rows[0].user_id !== userId) {
      return false;
    }

    await client.query(
      `
      UPDATE auth_refresh_sessions
      SET revoked_at = NOW(), replaced_by_hash = $2
      WHERE id = $1
      `,
      [current.rows[0].id, nextHash]
    );
    await client.query(
      `
      INSERT INTO auth_refresh_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [userId, nextHash, nextExpiresAt]
    );

    return true;
  });
}

export async function revokeRefreshSession(token) {
  if (!token) {
    return;
  }

  await query(
    `
    UPDATE auth_refresh_sessions
    SET revoked_at = COALESCE(revoked_at, NOW())
    WHERE token_hash = $1
    `,
    [tokenHash(token)]
  );
}

export async function deleteExpiredRefreshSessions() {
  await query(
    `
    DELETE FROM auth_refresh_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days'
       OR revoked_at < NOW() - INTERVAL '30 days'
    `
  );
}
