BEGIN;

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type VARCHAR(60) NOT NULL DEFAULT 'general',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location VARCHAR(160) NOT NULL DEFAULT '',
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL DEFAULT '',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  reminder_minutes INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  source VARCHAR(40) NOT NULL DEFAULT 'manual',
  source_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_range ON calendar_events(starts_at, ends_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_patient ON calendar_events(patient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON calendar_events(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_calendar_events_touch_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_touch_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
