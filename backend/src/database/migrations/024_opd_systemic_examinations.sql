BEGIN;

CREATE TABLE IF NOT EXISTS opd_systemic_examinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL UNIQUE REFERENCES opd_visits(id) ON DELETE CASCADE,
  examined_by UUID REFERENCES users(id) ON DELETE SET NULL,
  examination_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cardiovascular JSONB NOT NULL DEFAULT '{}'::jsonb,
  respiratory JSONB NOT NULL DEFAULT '{}'::jsonb,
  gastrointestinal JSONB NOT NULL DEFAULT '{}'::jsonb,
  central_nervous_system JSONB NOT NULL DEFAULT '{}'::jsonb,
  musculoskeletal JSONB NOT NULL DEFAULT '{}'::jsonb,
  genitourinary JSONB NOT NULL DEFAULT '{}'::jsonb,
  endocrine JSONB NOT NULL DEFAULT '{}'::jsonb,
  eye_ent JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opd_systemic_exam_patient_date
  ON opd_systemic_examinations(patient_id, examination_date DESC);
CREATE INDEX IF NOT EXISTS idx_opd_systemic_exam_visit
  ON opd_systemic_examinations(visit_id);

DROP TRIGGER IF EXISTS trg_opd_systemic_examinations_touch_updated_at ON opd_systemic_examinations;
CREATE TRIGGER trg_opd_systemic_examinations_touch_updated_at
BEFORE UPDATE ON opd_systemic_examinations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
