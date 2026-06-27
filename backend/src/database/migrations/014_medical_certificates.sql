BEGIN;

CREATE TABLE IF NOT EXISTS medical_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number VARCHAR(40) UNIQUE NOT NULL,
  certificate_type VARCHAR(40) NOT NULL CHECK (certificate_type IN ('fitness', 'sick_leave', 'insurance')),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  patient_age INTEGER,
  patient_gender VARCHAR(20) NOT NULL DEFAULT '',
  patient_mobile VARCHAR(20) NOT NULL DEFAULT '',
  uhid VARCHAR(30) NOT NULL DEFAULT '',
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name VARCHAR(180) NOT NULL,
  doctor_registration_number VARCHAR(80) NOT NULL DEFAULT '',
  certificate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT NOT NULL DEFAULT '',
  activity TEXT NOT NULL DEFAULT '',
  fit_date DATE,
  leave_from_date DATE,
  leave_to_date DATE,
  total_leave_days INTEGER,
  admission_date DATE,
  discharge_date DATE,
  treatment TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'cancelled')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_medical_certificates_patient ON medical_certificates(patient_id, certificate_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_medical_certificates_date ON medical_certificates(certificate_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_medical_certificates_type ON medical_certificates(certificate_type) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_medical_certificates_touch_updated_at ON medical_certificates;
CREATE TRIGGER trg_medical_certificates_touch_updated_at
BEFORE UPDATE ON medical_certificates
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
