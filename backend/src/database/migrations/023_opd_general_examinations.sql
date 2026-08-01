BEGIN;

CREATE TABLE IF NOT EXISTS opd_general_examinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL UNIQUE REFERENCES opd_visits(id) ON DELETE CASCADE,
  examined_by UUID REFERENCES users(id) ON DELETE SET NULL,
  examination_date DATE NOT NULL DEFAULT CURRENT_DATE,

  temperature_value NUMERIC(5,2),
  pulse_rate INTEGER,
  bp_right_systolic INTEGER,
  bp_right_diastolic INTEGER,
  bp_left_systolic INTEGER,
  bp_left_diastolic INTEGER,
  respiratory_rate INTEGER,
  spo2 NUMERIC(5,2),
  weight_kg NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  bmi NUMERIC(6,2),
  bmi_category VARCHAR(30) NOT NULL DEFAULT '',
  waist_circumference_cm NUMERIC(8,2),
  hip_circumference_cm NUMERIC(8,2),
  waist_hip_ratio NUMERIC(6,3),
  blood_glucose_mg_dl NUMERIC(8,2),
  blood_glucose_type VARCHAR(30) NOT NULL DEFAULT '',

  vital_sign_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  general_appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  skin_hair_nails JSONB NOT NULL DEFAULT '{}'::jsonb,
  eyes_tongue_mucosa JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opd_general_exam_patient_date
  ON opd_general_examinations(patient_id, examination_date DESC);
CREATE INDEX IF NOT EXISTS idx_opd_general_exam_visit
  ON opd_general_examinations(visit_id);

DROP TRIGGER IF EXISTS trg_opd_general_examinations_touch_updated_at ON opd_general_examinations;
CREATE TRIGGER trg_opd_general_examinations_touch_updated_at
BEFORE UPDATE ON opd_general_examinations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
