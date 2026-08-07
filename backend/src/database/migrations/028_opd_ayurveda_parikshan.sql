BEGIN;

-- Ayurvedic parikshan captured alongside the modern general examination.
-- Each group is a JSONB blob of field -> array of findings (free text allowed),
-- matching how vital_sign_details / general_appearance are already stored.
ALTER TABLE opd_general_examinations
  ADD COLUMN IF NOT EXISTS ashtavidha_pariksha JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dashavidha_pariksha JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS srotas_pariksha JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS samprapti_ghatak JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prakruti JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ayurveda_notes TEXT NOT NULL DEFAULT '';

COMMIT;
