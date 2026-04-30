BEGIN;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_doctor_id_appointment_date_appointment_time_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_doctor_slot
  ON appointments (doctor_id, appointment_date, appointment_time)
  WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'no_show');

CREATE INDEX IF NOT EXISTS idx_appointments_token_date
  ON appointments (appointment_date, token_number);

COMMIT;
