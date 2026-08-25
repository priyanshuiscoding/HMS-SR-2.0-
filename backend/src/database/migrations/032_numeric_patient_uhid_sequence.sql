BEGIN;

CREATE SEQUENCE IF NOT EXISTS patient_numeric_uhid_seq AS BIGINT;

SELECT setval(
  'patient_numeric_uhid_seq',
  GREATEST(
    6342,
    COALESCE((
      SELECT MAX(identifier::bigint)
      FROM (
        SELECT uhid AS identifier FROM patients WHERE uhid ~ '^[0-9]+$'
        UNION ALL
        SELECT registration_number AS identifier
        FROM patients
        WHERE COALESCE(registration_number, '') ~ '^[0-9]+$'
      ) numeric_identifiers
    ), 0)
  ),
  true
);

COMMIT;
