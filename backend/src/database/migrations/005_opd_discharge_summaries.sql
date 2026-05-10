CREATE TABLE IF NOT EXISTS opd_discharge_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_number VARCHAR(30) UNIQUE NOT NULL,
  visit_id UUID NOT NULL UNIQUE REFERENCES opd_visits(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) NOT NULL CHECK (status IN ('draft', 'forwarded', 'printed')),
  clinical_course TEXT NOT NULL DEFAULT '',
  final_diagnosis TEXT NOT NULL DEFAULT '',
  condition_on_discharge TEXT NOT NULL DEFAULT '',
  advice TEXT NOT NULL DEFAULT '',
  follow_up_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opd_discharge_visit ON opd_discharge_summaries(visit_id);
CREATE INDEX IF NOT EXISTS idx_opd_discharge_patient ON opd_discharge_summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_opd_discharge_status ON opd_discharge_summaries(status);
