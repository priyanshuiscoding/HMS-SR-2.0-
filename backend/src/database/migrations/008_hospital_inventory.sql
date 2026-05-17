BEGIN;

CREATE TABLE IF NOT EXISTS hospital_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'General',
  department VARCHAR(80) NOT NULL DEFAULT 'Hospital Store',
  unit VARCHAR(40) NOT NULL DEFAULT 'unit',
  quantity_available NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,2) NOT NULL DEFAULT 0,
  location VARCHAR(120) NOT NULL DEFAULT '',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hospital_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES hospital_inventory_items(id) ON DELETE CASCADE,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type VARCHAR(40) NOT NULL CHECK (type IN ('receipt', 'issue', 'adjustment')),
  quantity NUMERIC(12,2) NOT NULL,
  reference_number VARCHAR(80) NOT NULL DEFAULT '',
  department VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_hospital_inventory_name ON hospital_inventory_items(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hospital_inventory_category ON hospital_inventory_items(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hospital_inventory_department ON hospital_inventory_items(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hospital_inventory_tx_item ON hospital_inventory_transactions(item_id, transaction_date DESC);

DROP TRIGGER IF EXISTS trg_hospital_inventory_items_touch_updated_at ON hospital_inventory_items;
CREATE TRIGGER trg_hospital_inventory_items_touch_updated_at
BEFORE UPDATE ON hospital_inventory_items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
