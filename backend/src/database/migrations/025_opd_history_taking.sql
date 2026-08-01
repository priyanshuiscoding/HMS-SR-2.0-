BEGIN;

CREATE TABLE IF NOT EXISTS opd_history_taking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL UNIQUE REFERENCES opd_visits(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  history_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaints JSONB NOT NULL DEFAULT '[]'::jsonb,
  past_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  drug_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  family_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  personal_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  obstetric_gynaecological JSONB NOT NULL DEFAULT '{}'::jsonb,
  paediatric_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  mental_health_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  dietary_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  travel_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  prescription_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opd_history_taking_patient_date
  ON opd_history_taking(patient_id, history_date DESC);
CREATE INDEX IF NOT EXISTS idx_opd_history_taking_visit
  ON opd_history_taking(visit_id);

DROP TRIGGER IF EXISTS trg_opd_history_taking_touch_updated_at ON opd_history_taking;
CREATE TRIGGER trg_opd_history_taking_touch_updated_at
BEFORE UPDATE ON opd_history_taking
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
