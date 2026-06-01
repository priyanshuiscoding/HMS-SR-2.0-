BEGIN;

CREATE TABLE IF NOT EXISTS patient_uhid_remap_conflicts (
  id UUID PRIMARY KEY,
  registration_number VARCHAR(30),
  registration_date DATE,
  requested_uhid VARCHAR(30),
  assigned_uhid VARCHAR(30) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TEMP TABLE patient_uhid_remap_plan ON COMMIT DROP AS
WITH patient_basis AS (
  SELECT
    id,
    uhid AS previous_uhid,
    registration_number,
    registration_date,
    registration_time,
    created_at,
    COALESCE(registration_date, created_at::date, CURRENT_DATE) AS identity_date,
    NULLIF(SUBSTRING(COALESCE(registration_number, '') FROM '([0-9]+)$'), '')::int AS registration_serial
  FROM patients
  WHERE deleted_at IS NULL
),
numbered_patients AS (
  SELECT
    *,
    TO_CHAR(identity_date, 'YY') AS year_suffix,
    CASE
      WHEN registration_serial BETWEEN 1 AND 999999 THEN registration_serial
      ELSE NULL
    END AS usable_registration_serial
  FROM patient_basis
),
fallback_offsets AS (
  SELECT
    *,
    COALESCE(MAX(usable_registration_serial) OVER (PARTITION BY year_suffix), 0) AS max_registration_serial,
    ROW_NUMBER() OVER (
      PARTITION BY year_suffix, usable_registration_serial IS NULL
      ORDER BY registration_date NULLS LAST, registration_time NULLS LAST, created_at NULLS LAST, id
    ) AS fallback_serial
  FROM numbered_patients
),
requested_uhids AS (
  SELECT
    *,
    CONCAT(
      'SRH',
      year_suffix,
      LPAD(COALESCE(usable_registration_serial, max_registration_serial + fallback_serial)::text, 6, '0')
    ) AS requested_uhid
  FROM fallback_offsets
),
duplicate_adjusted_uhids AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY requested_uhid
      ORDER BY registration_date NULLS LAST, registration_time NULLS LAST, created_at NULLS LAST, id
    ) AS requested_rank,
    COUNT(*) OVER (PARTITION BY requested_uhid) AS requested_count,
    MAX(
      COALESCE(usable_registration_serial, max_registration_serial + fallback_serial)
    ) OVER (PARTITION BY year_suffix) AS year_max_serial
  FROM requested_uhids
)
SELECT
  id,
  previous_uhid,
  registration_number,
  registration_date,
  year_suffix,
  usable_registration_serial,
  requested_uhid,
  requested_count,
  requested_rank,
  CASE
    WHEN requested_rank = 1 THEN requested_uhid
    ELSE CONCAT('SRH', year_suffix, LPAD((year_max_serial + requested_rank - 1)::text, 6, '0'))
  END AS assigned_uhid
FROM duplicate_adjusted_uhids;

UPDATE patients AS patient
SET uhid = CONCAT('TMP', SUBSTRING(MD5(patient.id::text) FROM 1 FOR 27))
FROM patient_uhid_remap_plan AS plan
WHERE patient.id = plan.id
  AND patient.uhid IS DISTINCT FROM plan.assigned_uhid;

INSERT INTO patient_uhid_remap_conflicts (
  id, registration_number, registration_date, requested_uhid, assigned_uhid, reason
)
SELECT
  id,
  registration_number,
  registration_date,
  requested_uhid,
  assigned_uhid,
  CASE
    WHEN usable_registration_serial IS NULL THEN 'Reg No / PPIN had no usable trailing numeric serial; assigned next serial for registration year.'
    WHEN requested_count > 1 AND requested_rank > 1 THEN 'Duplicate Reg No / PPIN serial in the same registration year; assigned next available serial.'
    ELSE 'No conflict.'
  END
FROM patient_uhid_remap_plan
WHERE usable_registration_serial IS NULL
  OR (requested_count > 1 AND requested_rank > 1)
ON CONFLICT (id) DO UPDATE
SET
  registration_number = EXCLUDED.registration_number,
  registration_date = EXCLUDED.registration_date,
  requested_uhid = EXCLUDED.requested_uhid,
  assigned_uhid = EXCLUDED.assigned_uhid,
  reason = EXCLUDED.reason;

UPDATE patients AS patient
SET
  uhid = plan.assigned_uhid,
  metadata = jsonb_set(
    COALESCE(patient.metadata, '{}'::jsonb),
    '{uhidRemap}',
    jsonb_build_object(
      'previousUhid', plan.previous_uhid,
      'requestedUhid', plan.requested_uhid,
      'assignedUhid', plan.assigned_uhid,
      'registrationYear', plan.year_suffix,
      'registrationSerial', plan.usable_registration_serial
    ),
    true
  ),
  updated_at = NOW()
FROM patient_uhid_remap_plan AS plan
WHERE patient.id = plan.id
  AND patient.uhid IS DISTINCT FROM plan.assigned_uhid;

COMMIT;
