BEGIN;

-- Widen the certificate_type CHECK constraint to cover the new
-- medico-legal and patient-centric certificate categories. Type-specific
-- fields for these are stored in the existing metadata JSONB column.
ALTER TABLE medical_certificates
  DROP CONSTRAINT IF EXISTS medical_certificates_certificate_type_check;

ALTER TABLE medical_certificates
  ADD CONSTRAINT medical_certificates_certificate_type_check
  CHECK (certificate_type IN (
    'fitness',
    'sick_leave',
    'insurance',
    'birth',
    'death',
    'disability',
    'treatment',
    'panchakarma',
    'medical_records',
    'wound',
    'post_mortem',
    'mlc',
    'accident_wound'
  ));

COMMIT;
