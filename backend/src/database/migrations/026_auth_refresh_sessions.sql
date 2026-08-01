BEGIN;

CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_user
  ON auth_refresh_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_active
  ON auth_refresh_sessions (expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
