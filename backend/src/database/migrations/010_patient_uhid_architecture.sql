BEGIN;

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS uhid VARCHAR(30);

WITH existing_sequence AS (
  SELECT COALESCE(MAX(SUBSTRING(uhid FROM 6 FOR 6)::int), 0) AS max_serial
  FROM patients
  WHERE uhid ~ CONCAT('^SRH', TO_CHAR(CURRENT_DATE, 'YY'), '[0-9]{6}$')
),
ordered_patients AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        registration_date NULLS LAST,
        registration_time NULLS LAST,
        created_at NULLS LAST,
        id
    ) AS serial_number
  FROM patients
  WHERE uhid IS NULL OR uhid !~ '^SRH[0-9]{8}$'
),
assigned_uhids AS (
  SELECT
    ordered_patients.id,
    CONCAT('SRH', TO_CHAR(CURRENT_DATE, 'YY'), LPAD((existing_sequence.max_serial + ordered_patients.serial_number)::text, 6, '0')) AS next_uhid
  FROM ordered_patients
  CROSS JOIN existing_sequence
)
UPDATE patients AS patient
SET
  uhid = assigned_uhids.next_uhid,
  metadata = CASE
    WHEN patient.uhid IS NULL THEN COALESCE(patient.metadata, '{}'::jsonb)
    ELSE jsonb_set(
      COALESCE(patient.metadata, '{}'::jsonb),
      '{legacyUhid}',
      to_jsonb(patient.uhid),
      true
    )
  END
FROM assigned_uhids
WHERE patient.id = assigned_uhids.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_uhid_unique ON patients(uhid);
CREATE INDEX IF NOT EXISTS idx_patients_registration_number ON patients(registration_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_opd_ipd_number ON patients(opd_ipd_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_father_name ON patients(father_name) WHERE deleted_at IS NULL;

ALTER TABLE patients
ALTER COLUMN uhid SET NOT NULL;

COMMIT;
