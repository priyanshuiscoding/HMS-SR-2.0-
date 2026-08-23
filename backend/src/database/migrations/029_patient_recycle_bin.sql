BEGIN;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_patients_recycle_bin
  ON patients(deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

COMMIT;
