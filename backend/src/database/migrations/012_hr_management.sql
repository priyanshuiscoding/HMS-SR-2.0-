BEGIN;

CREATE TABLE IF NOT EXISTS hr_employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joining_date DATE,
  employment_type VARCHAR(40) NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'consultant', 'intern')),
  employment_status VARCHAR(40) NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'probation', 'on_notice', 'inactive', 'terminated')),
  reporting_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  emergency_contact_name VARCHAR(120) NOT NULL DEFAULT '',
  emergency_contact_phone VARCHAR(20) NOT NULL DEFAULT '',
  bank_name VARCHAR(120) NOT NULL DEFAULT '',
  bank_account_last4 VARCHAR(4) NOT NULL DEFAULT '',
  pan_number VARCHAR(20) NOT NULL DEFAULT '',
  salary_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_employee_profiles_status ON hr_employee_profiles(employment_status);

CREATE TABLE IF NOT EXISTS hr_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_name VARCHAR(80) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  grace_minutes INTEGER NOT NULL DEFAULT 10,
  is_night_shift BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shift_name, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS hr_shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES hr_shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  week_off VARCHAR(80) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_user ON hr_shift_assignments(user_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_shift ON hr_shift_assignments(shift_id);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'half_day', 'holiday')),
  check_in_time TIME,
  check_out_time TIME,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_exit_minutes INTEGER NOT NULL DEFAULT 0,
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'biometric', 'mobile', 'system')),
  notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON staff_attendance(status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_user ON staff_attendance(user_id, attendance_date DESC);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('sick', 'casual', 'earned', 'unpaid', 'maternity', 'paternity', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5,2) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_user ON hr_leave_requests(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests(status);

CREATE TABLE IF NOT EXISTS hr_payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payroll_month DATE NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (payment_status IN ('draft', 'processed', 'paid', 'withheld')),
  paid_on DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, payroll_month)
);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_month ON hr_payroll_records(payroll_month DESC);

CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(60) NOT NULL DEFAULT 'other',
  document_name VARCHAR(160) NOT NULL,
  document_number VARCHAR(80) NOT NULL DEFAULT '',
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'missing', 'archived')),
  notes TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_user ON hr_employee_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_expiry ON hr_employee_documents(expiry_date);

INSERT INTO hr_shifts (shift_name, start_time, end_time, break_minutes, grace_minutes, is_night_shift)
VALUES
  ('General Day Shift', '09:00', '18:00', 60, 10, false),
  ('Morning Half Shift', '09:00', '13:00', 0, 10, false),
  ('Evening Half Shift', '14:00', '19:00', 0, 10, false)
ON CONFLICT (shift_name, start_time, end_time) DO NOTHING;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'hr_employee_profiles', 'hr_shifts', 'hr_shift_assignments', 'staff_attendance',
    'hr_leave_requests', 'hr_payroll_records', 'hr_employee_documents'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END $$;

COMMIT;
