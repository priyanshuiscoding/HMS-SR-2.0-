ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS sample_collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sample_type VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS collection_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS processing_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_tests INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lab_orders
  DROP CONSTRAINT IF EXISTS lab_orders_bill_id_fkey;

ALTER TABLE lab_orders
  ADD CONSTRAINT lab_orders_bill_id_fkey
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL;

ALTER TABLE lab_order_tests
  ADD COLUMN IF NOT EXISTS code VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS department VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS normal_range TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lab_orders_date ON lab_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_lab_orders_visit ON lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_bill ON lab_orders(bill_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_tests_order_status ON lab_order_tests(order_id, status);
