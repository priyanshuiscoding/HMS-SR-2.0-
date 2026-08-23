BEGIN;

WITH latest_archive_audit AS (
  SELECT DISTINCT ON (new_value->'params'->>'id')
    new_value->'params'->>'id' AS patient_identifier,
    user_id,
    NULLIF(BTRIM(new_value->'body'->>'reason'), '') AS archive_reason
  FROM audit_logs
  WHERE action LIKE 'DELETE %/patients/%'
    AND new_value->'params'->>'id' IS NOT NULL
  ORDER BY new_value->'params'->>'id', created_at DESC
)
UPDATE patients AS patient
SET
  deleted_by = COALESCE(patient.deleted_by, audit.user_id),
  deletion_reason = CASE
    WHEN BTRIM(COALESCE(patient.deletion_reason, '')) = ''
    THEN COALESCE(audit.archive_reason, 'Archived before recycle-bin audit details were enabled')
    ELSE patient.deletion_reason
  END
FROM latest_archive_audit AS audit
WHERE patient.deleted_at IS NOT NULL
  AND (
    patient.id::text = audit.patient_identifier
    OR LOWER(patient.uhid) = LOWER(audit.patient_identifier)
    OR LOWER(COALESCE(patient.registration_number, '')) = LOWER(audit.patient_identifier)
  );

COMMIT;
