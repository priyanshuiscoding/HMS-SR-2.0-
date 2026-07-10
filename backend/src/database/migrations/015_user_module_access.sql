BEGIN;

-- Per-user module access grants. A user's base `role` still governs their default
-- access; `granted_modules` is an admin-managed list of extra module keys the user
-- is allowed to open (e.g. giving an HR user access to the "billing" module). An
-- empty array means "no extra access beyond the base role".
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS granted_modules JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
