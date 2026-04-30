BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS hospital_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(140) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'reception', 'doctor', 'pharmacy', 'lab', 'therapist', 'nursing', 'housekeeping', 'accounts', 'hr')),
  department VARCHAR(80) NOT NULL DEFAULT '',
  designation VARCHAR(120) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  staff_name VARCHAR(120) NOT NULL,
  working_time VARCHAR(80) NOT NULL,
  break_time VARCHAR(80) NOT NULL DEFAULT '',
  week_off VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_work_schedules_user ON staff_work_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_work_schedules_name ON staff_work_schedules(staff_name);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uhid VARCHAR(30) UNIQUE NOT NULL,
  registration_number VARCHAR(30),
  opd_ipd_number VARCHAR(30),
  patient_type VARCHAR(30) NOT NULL DEFAULT 'new',
  title VARCHAR(20) NOT NULL DEFAULT '',
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL DEFAULT '',
  full_name VARCHAR(180) NOT NULL,
  date_of_birth DATE,
  age_years INTEGER,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other', '')),
  blood_group VARCHAR(10),
  marital_status VARCHAR(30),
  occupation VARCHAR(120),
  phone VARCHAR(20) NOT NULL,
  alt_phone VARCHAR(20),
  email VARCHAR(140),
  address TEXT NOT NULL DEFAULT '',
  house_street TEXT NOT NULL DEFAULT '',
  area_village TEXT NOT NULL DEFAULT '',
  city VARCHAR(80) NOT NULL DEFAULT '',
  state VARCHAR(80) NOT NULL DEFAULT 'Madhya Pradesh',
  pincode VARCHAR(12) NOT NULL DEFAULT '',
  id_type VARCHAR(40) NOT NULL DEFAULT '',
  id_number_encrypted BYTEA,
  emergency_contact_name VARCHAR(120) NOT NULL DEFAULT '',
  emergency_contact_phone VARCHAR(20) NOT NULL DEFAULT '',
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  registration_time TIME,
  referred_by VARCHAR(120) NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  source_document TEXT NOT NULL DEFAULT '',
  clinical_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_registration_date ON patients(registration_date DESC);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  patient_age INTEGER,
  patient_gender VARCHAR(20) NOT NULL DEFAULT '',
  patient_mobile VARCHAR(20) NOT NULL DEFAULT '',
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('new', 'follow_up', 'emergency')),
  department VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  chief_complaint TEXT NOT NULL DEFAULT '',
  token_number INTEGER NOT NULL,
  booked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'Reception',
  sms_sent BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (doctor_id, appointment_date, appointment_time)
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE TABLE IF NOT EXISTS opd_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  visit_type VARCHAR(30) NOT NULL DEFAULT 'new',
  chief_complaint TEXT NOT NULL DEFAULT '',
  vitals_bp VARCHAR(20),
  vitals_pulse INTEGER,
  vitals_temp NUMERIC(4,1),
  vitals_weight NUMERIC(6,2),
  vitals_height NUMERIC(6,2),
  vitals_spo2 INTEGER,
  vitals_rr INTEGER,
  status VARCHAR(30) NOT NULL CHECK (status IN ('waiting', 'in_consultation', 'completed', 'cancelled')),
  consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opd_visits_patient ON opd_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_opd_visits_date ON opd_visits(visit_date DESC);

CREATE TABLE IF NOT EXISTS ayurveda_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES opd_visits(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  prakriti_vata INTEGER CHECK (prakriti_vata BETWEEN 0 AND 10),
  prakriti_pitta INTEGER CHECK (prakriti_pitta BETWEEN 0 AND 10),
  prakriti_kapha INTEGER CHECK (prakriti_kapha BETWEEN 0 AND 10),
  prakriti_dominant VARCHAR(40),
  nadi_pariksha TEXT,
  nadi_type VARCHAR(50),
  jihva_pariksha TEXT,
  drik_pariksha TEXT,
  shabda_pariksha TEXT,
  sparsha_pariksha TEXT,
  akruti_pariksha TEXT,
  mala_pariksha TEXT,
  mutra_pariksha TEXT,
  dashavidha_sara JSONB NOT NULL DEFAULT '{}'::jsonb,
  dashavidha_satva VARCHAR(30),
  dashavidha_ahara_shakti VARCHAR(30),
  dashavidha_vyayama_shakti VARCHAR(30),
  agni_status VARCHAR(30),
  koshtha_nature VARCHAR(30),
  vikriti_assessment TEXT,
  observations TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ayurveda_patient ON ayurveda_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_ayurveda_visit ON ayurveda_assessments(visit_id);

CREATE TABLE IF NOT EXISTS medicine_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(220) NOT NULL,
  generic_name VARCHAR(220) NOT NULL DEFAULT '',
  category VARCHAR(80) NOT NULL,
  formulation VARCHAR(80) NOT NULL DEFAULT '',
  unit VARCHAR(40) NOT NULL,
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(10,2) NOT NULL DEFAULT 0,
  hsn_code VARCHAR(30) NOT NULL DEFAULT '',
  gst_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_medicine_masters_name ON medicine_masters(name);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visit_id UUID REFERENCES opd_visits(id) ON DELETE SET NULL,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT NOT NULL,
  diagnosis_ayurvedic TEXT NOT NULL DEFAULT '',
  nidana TEXT NOT NULL DEFAULT '',
  samprapti TEXT NOT NULL DEFAULT '',
  chikitsa_sutra TEXT NOT NULL DEFAULT '',
  diet_recommendations TEXT NOT NULL DEFAULT '',
  follow_up_date DATE,
  is_dispensed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);

CREATE TABLE IF NOT EXISTS prescription_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicine_masters(id) ON DELETE SET NULL,
  medicine_name VARCHAR(220) NOT NULL,
  dose VARCHAR(80) NOT NULL DEFAULT '',
  frequency VARCHAR(80) NOT NULL DEFAULT '',
  route VARCHAR(40) NOT NULL DEFAULT 'oral',
  timing VARCHAR(120) NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 0,
  anupana VARCHAR(120) NOT NULL DEFAULT '',
  quantity_dispensed NUMERIC(10,2) NOT NULL DEFAULT 0,
  special_instructions TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_prescription_medicines_rx ON prescription_medicines(prescription_id);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(40) UNIQUE NOT NULL,
  room_type VARCHAR(40) NOT NULL CHECK (room_type IN ('general', 'semi_private', 'private', 'deluxe', 'icu', 'therapy', 'panchkarma')),
  floor VARCHAR(80) NOT NULL DEFAULT '',
  ward VARCHAR(100) NOT NULL,
  total_beds INTEGER NOT NULL DEFAULT 0,
  daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  nursing_station VARCHAR(100) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);

CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number VARCHAR(60) UNIQUE NOT NULL,
  bed_label VARCHAR(100) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'maintenance')),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL DEFAULT '',
  assigned_at TIMESTAMPTZ,
  expected_discharge_date DATE,
  note TEXT NOT NULL DEFAULT '',
  admission_type VARCHAR(30) NOT NULL DEFAULT '',
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);

CREATE TABLE IF NOT EXISTS ipd_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  attending_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  admission_date DATE NOT NULL,
  admission_time TIME NOT NULL,
  admission_source VARCHAR(40) NOT NULL DEFAULT 'opd',
  admission_type VARCHAR(40) NOT NULL DEFAULT 'ipd',
  reason_for_admission TEXT NOT NULL,
  diagnosis TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL CHECK (status IN ('active', 'discharged', 'transferred', 'cancelled')),
  expected_discharge_date DATE,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  mlc_case BOOLEAN NOT NULL DEFAULT false,
  admitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  discharge_summary JSONB,
  bill_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ipd_patient ON ipd_admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ipd_status ON ipd_admissions(status);
CREATE INDEX IF NOT EXISTS idx_ipd_admission_date ON ipd_admissions(admission_date DESC);

CREATE TABLE IF NOT EXISTS ipd_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES ipd_admissions(id) ON DELETE CASCADE,
  note_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category VARCHAR(40) NOT NULL DEFAULT 'progress',
  note TEXT NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_ipd_notes_admission ON ipd_notes(admission_id, note_date DESC);

CREATE TABLE IF NOT EXISTS ipd_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES ipd_admissions(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bp VARCHAR(20),
  pulse INTEGER,
  temp NUMERIC(4,1),
  spo2 INTEGER,
  rr INTEGER,
  weight NUMERIC(6,2),
  notes TEXT NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_ipd_vitals_admission ON ipd_vitals(admission_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS panchkarma_therapy_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(160) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Panchkarma & Therapy',
  default_duration_minutes INTEGER NOT NULL DEFAULT 45,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  room_type VARCHAR(40) NOT NULL DEFAULT 'therapy',
  requires_recovery BOOLEAN NOT NULL DEFAULT false,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_panchkarma_therapy_name ON panchkarma_therapy_masters(name);

CREATE TABLE IF NOT EXISTS panchkarma_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  therapy_id UUID REFERENCES panchkarma_therapy_masters(id) ON DELETE SET NULL,
  therapy_name VARCHAR(160) NOT NULL,
  recommended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  linked_visit_id UUID REFERENCES opd_visits(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  therapy_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  recovery_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  therapist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  therapist_name VARCHAR(180) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 45,
  status VARCHAR(30) NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  complaint TEXT NOT NULL DEFAULT '',
  preparation_notes TEXT NOT NULL DEFAULT '',
  execution_notes TEXT NOT NULL DEFAULT '',
  follow_up_advice TEXT NOT NULL DEFAULT '',
  session_started_at TIMESTAMPTZ,
  session_completed_at TIMESTAMPTZ,
  outcome TEXT NOT NULL DEFAULT '',
  bill_id UUID,
  billed_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_panchkarma_sessions_date ON panchkarma_sessions(scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_panchkarma_sessions_patient ON panchkarma_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_panchkarma_sessions_therapist ON panchkarma_sessions(therapist_id);

CREATE TABLE IF NOT EXISTS panchkarma_session_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES panchkarma_sessions(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicine_masters(id) ON DELETE SET NULL,
  medicine_name VARCHAR(220) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'unit',
  notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  email VARCHAR(140) NOT NULL DEFAULT '',
  city VARCHAR(80) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  gstin VARCHAR(30) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID REFERENCES medicine_masters(id) ON DELETE SET NULL,
  medicine_name VARCHAR(220) NOT NULL,
  batch_number VARCHAR(80) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  received_date DATE NOT NULL,
  expiry_date DATE,
  quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_available NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  invoice_number VARCHAR(80) NOT NULL DEFAULT '',
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (medicine_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_medicine ON inventory_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  medicine_id UUID REFERENCES medicine_masters(id) ON DELETE SET NULL,
  medicine_name VARCHAR(220) NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  type VARCHAR(40) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  reference_number VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_medicine ON stock_transactions(medicine_id, transaction_date DESC);

CREATE TABLE IF NOT EXISTS lab_test_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  department VARCHAR(80) NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  normal_range TEXT NOT NULL DEFAULT '',
  unit VARCHAR(40) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  ordered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  visit_id UUID REFERENCES opd_visits(id) ON DELETE SET NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('routine', 'urgent', 'stat')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'sample_collected', 'processing', 'reported', 'cancelled')),
  sample_collection_time TIMESTAMPTZ,
  report_url TEXT NOT NULL DEFAULT '',
  bill_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);

CREATE TABLE IF NOT EXISTS lab_order_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  test_id UUID REFERENCES lab_test_masters(id) ON DELETE SET NULL,
  test_name VARCHAR(180) NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  result_flag VARCHAR(40) NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  visit_id UUID REFERENCES opd_visits(id) ON DELETE SET NULL,
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  bill_type VARCHAR(40) NOT NULL CHECK (bill_type IN ('opd', 'ipd', 'lab', 'pharmacy', 'therapy', 'room', 'procedure', 'miscellaneous')),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  invoice_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_type_status ON bills(bill_type, payment_status);

CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'service',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  batch_number VARCHAR(80) NOT NULL DEFAULT '',
  pack VARCHAR(80) NOT NULL DEFAULT '',
  expiry_date DATE,
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(30) UNIQUE NOT NULL,
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount NUMERIC(12,2) NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  reference_number VARCHAR(120) NOT NULL DEFAULT '',
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number VARCHAR(30) UNIQUE NOT NULL,
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  refund_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount NUMERIC(12,2) NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  reference_number VARCHAR(120) NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_role VARCHAR(30),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  old_value JSONB,
  new_value JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at DESC);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'hospital_settings', 'users', 'staff_work_schedules', 'patients', 'appointments',
    'opd_visits', 'ayurveda_assessments', 'medicine_masters', 'prescriptions',
    'rooms', 'beds', 'ipd_admissions', 'panchkarma_therapy_masters',
    'panchkarma_sessions', 'suppliers', 'inventory_batches', 'lab_test_masters',
    'lab_orders', 'bills'
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
