CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(40) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(180) NOT NULL,
  order_date DATE NOT NULL,
  expected_date DATE,
  status VARCHAR(30) NOT NULL CHECK (status IN ('draft', 'sent', 'approved', 'received', 'cancelled')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_date ON purchase_orders(status, order_date DESC);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicine_masters(id) ON DELETE SET NULL,
  medicine_name VARCHAR(220) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);

CREATE TABLE IF NOT EXISTS dispensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_number VARCHAR(40) UNIQUE NOT NULL,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(180) NOT NULL,
  visit_id UUID REFERENCES opd_visits(id) ON DELETE SET NULL,
  dispensed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dispensed_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispensations_patient ON dispensations(patient_id, dispensed_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispensations_prescription ON dispensations(prescription_id);

CREATE TABLE IF NOT EXISTS dispensation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_id UUID NOT NULL REFERENCES dispensations(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicine_masters(id) ON DELETE SET NULL,
  medicine_name VARCHAR(220) NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  batch_number VARCHAR(80) NOT NULL DEFAULT '',
  quantity NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_dispensation_items_dispensation ON dispensation_items(dispensation_id);
