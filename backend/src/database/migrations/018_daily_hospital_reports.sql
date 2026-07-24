BEGIN;

CREATE TABLE IF NOT EXISTS daily_hospital_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE UNIQUE NOT NULL,
  opd_patients INTEGER NOT NULL DEFAULT 0,
  ipd_patients INTEGER NOT NULL DEFAULT 0,
  ipd_admissions INTEGER NOT NULL DEFAULT 0,
  new_registrations INTEGER NOT NULL DEFAULT 0,
  follow_up_patients INTEGER NOT NULL DEFAULT 0,
  appointments INTEGER NOT NULL DEFAULT 0,
  discharged_patients INTEGER NOT NULL DEFAULT 0,
  emergency_cases INTEGER NOT NULL DEFAULT 0,
  panchkarma_sessions INTEGER NOT NULL DEFAULT 0,
  lab_orders INTEGER NOT NULL DEFAULT 0,
  pharmacy_dispensations INTEGER NOT NULL DEFAULT 0,
  bills_generated INTEGER NOT NULL DEFAULT 0,
  revenue_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  collected_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  cash_collection NUMERIC(14,2) NOT NULL DEFAULT 0,
  upi_collection NUMERIC(14,2) NOT NULL DEFAULT 0,
  card_collection NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_collection NUMERIC(14,2) NOT NULL DEFAULT 0,
  employees_total INTEGER NOT NULL DEFAULT 0,
  employees_present INTEGER NOT NULL DEFAULT 0,
  employees_absent INTEGER NOT NULL DEFAULT 0,
  employees_on_leave INTEGER NOT NULL DEFAULT 0,
  employees_half_day INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_hospital_reports_date
  ON daily_hospital_reports(report_date DESC);

DROP TRIGGER IF EXISTS trg_daily_hospital_reports_touch_updated_at ON daily_hospital_reports;
CREATE TRIGGER trg_daily_hospital_reports_touch_updated_at
BEFORE UPDATE ON daily_hospital_reports
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
