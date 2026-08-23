BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm ON patients USING gin (LOWER(full_name) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm ON patients USING gin (LOWER(phone) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_father_name_trgm ON patients USING gin (LOWER(father_name) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_city_trgm ON patients USING gin (LOWER(city) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_active_registry_order ON patients (registration_date DESC, registration_time DESC, created_at DESC) WHERE deleted_at IS NULL;
COMMIT;
