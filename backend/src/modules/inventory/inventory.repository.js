import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNumber(value) {
  return Number(value || 0);
}

export function toCamelMedicine(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.medicine_code,
    name: row.name,
    category: row.category || "",
    formulation: row.formulation || "",
    unit: row.unit || "unit",
    reorderLevel: toNumber(row.reorder_level),
    price: toNumber(row.selling_price),
    sellingPrice: toNumber(row.selling_price),
    gstPercent: toNumber(row.gst_percentage),
    metadata: row.metadata || {}
  };
}

export function toCamelSupplier(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    city: row.city || "",
    address: row.address || "",
    gstin: row.gstin || "",
    contactPerson: row.metadata?.contactPerson || "",
    metadata: row.metadata || {}
  };
}

export function toCamelBatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    medicineId: row.medicine_id || "",
    medicineName: row.medicine_name,
    batchNumber: row.batch_number,
    supplierId: row.supplier_id || "",
    receivedDate: toIsoDate(row.received_date),
    expiryDate: toIsoDate(row.expiry_date),
    quantityReceived: toNumber(row.quantity_received),
    quantityAvailable: toNumber(row.quantity_available),
    purchasePrice: toNumber(row.purchase_price),
    sellingPrice: toNumber(row.selling_price),
    invoiceNumber: row.invoice_number || "",
    receivedBy: row.received_by || "",
    metadata: row.metadata || {}
  };
}

export function toCamelStockTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    transactionDate: toIsoDateTime(row.transaction_date),
    medicineId: row.medicine_id || "",
    medicineName: row.medicine_name,
    batchId: row.batch_id || "",
    type: row.type,
    quantity: toNumber(row.quantity),
    referenceNumber: row.reference_number || "",
    note: row.note || "",
    createdBy: row.created_by || "",
    metadata: row.metadata || {}
  };
}

function toCamelPurchaseOrder(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    poNumber: row.po_number,
    supplierId: row.supplier_id || "",
    supplierName: row.supplier_name,
    orderDate: toIsoDate(row.order_date),
    expectedDate: toIsoDate(row.expected_date),
    status: row.status,
    subtotal: toNumber(row.subtotal),
    taxAmount: toNumber(row.tax_amount),
    totalAmount: toNumber(row.total_amount),
    note: row.note || "",
    createdBy: row.created_by || "",
    createdAt: toIsoDateTime(row.created_at),
    items,
    metadata: row.metadata || {}
  };
}

function toCamelPurchaseOrderItem(row) {
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    medicineId: row.medicine_id || "",
    medicineName: row.medicine_name,
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    amount: toNumber(row.amount),
    note: row.note || "",
    metadata: row.metadata || {}
  };
}

export async function resolveMedicineId(client, value) {
  if (!value) return null;
  if (uuidPattern.test(String(value))) {
    const direct = await client.query("SELECT id FROM medicine_masters WHERE id = $1 LIMIT 1", [value]);
    if (direct.rows[0]?.id) return direct.rows[0].id;
  }
  const source = await client.query("SELECT id FROM medicine_masters WHERE metadata->>'sourceId' = $1 LIMIT 1", [String(value)]);
  return source.rows[0]?.id || null;
}

export async function listMedicineRecords() {
  const result = await query("SELECT * FROM medicine_masters WHERE is_active = true ORDER BY name ASC");
  return result.rows.map(toCamelMedicine);
}

export async function findMedicineRecord(id) {
  return withTransaction(async (client) => {
    const resolvedId = await resolveMedicineId(client, id);
    if (!resolvedId) return null;
    const result = await client.query("SELECT * FROM medicine_masters WHERE id = $1 AND is_active = true", [resolvedId]);
    return toCamelMedicine(result.rows[0]);
  });
}

export async function listSupplierRecords(filters = {}) {
  const params = [];
  const conditions = ["is_active = true"];
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(phone) LIKE $${params.length} OR LOWER(city) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`);
  }
  const result = await query(`SELECT * FROM suppliers WHERE ${conditions.join(" AND ")} ORDER BY name ASC`, params);
  return result.rows.map(toCamelSupplier);
}

export async function createSupplierRecord(payload) {
  const result = await query(
    `
    INSERT INTO suppliers (id, name, phone, email, city, address, gstin, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    RETURNING *
    `,
    [
      payload.id,
      payload.name,
      payload.phone || "",
      payload.email || "",
      payload.city || "",
      payload.address || "",
      payload.gstin || "",
      JSON.stringify({ contactPerson: payload.contactPerson || "" })
    ]
  );
  return toCamelSupplier(result.rows[0]);
}

export async function supplierNameExists(name) {
  const result = await query("SELECT 1 FROM suppliers WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1", [name]);
  return result.rowCount > 0;
}

export async function listBatchRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.medicineId) {
    params.push(filters.medicineId);
    conditions.push(`(medicine_id = $${params.length} OR metadata->>'sourceMedicineId' = $${params.length})`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(LOWER(medicine_name) LIKE $${params.length} OR LOWER(batch_number) LIKE $${params.length} OR LOWER(invoice_number) LIKE $${params.length})`);
  }
  const result = await query(`SELECT * FROM inventory_batches WHERE ${conditions.join(" AND ")} ORDER BY expiry_date ASC NULLS LAST, medicine_name ASC`, params);
  return result.rows.map(toCamelBatch);
}

export async function listStockTransactionRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.medicineId) {
    params.push(filters.medicineId);
    conditions.push(`(medicine_id = $${params.length} OR metadata->>'sourceMedicineId' = $${params.length})`);
  }
  const result = await query(`SELECT * FROM stock_transactions WHERE ${conditions.join(" AND ")} ORDER BY transaction_date DESC`, params);
  return result.rows.map(toCamelStockTransaction);
}

export async function receiveStockRecord(payload) {
  return withTransaction(async (client) => {
    const medicineId = await resolveMedicineId(client, payload.medicineId);
    if (!medicineId) return { conflict: "medicine_missing" };

    const medicineResult = await client.query("SELECT * FROM medicine_masters WHERE id = $1", [medicineId]);
    const medicine = medicineResult.rows[0];

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["inventory:grn"]);
    const grnResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM stock_transactions WHERE type = 'receipt'");
    const referenceNumber = payload.referenceNumber || `GRN-${new Date().getFullYear()}-${String(grnResult.rows[0].next_number).padStart(5, "0")}`;

    const batchResult = await client.query(
      `
      INSERT INTO inventory_batches (
        id, medicine_id, medicine_name, batch_number, supplier_id, received_date, expiry_date,
        quantity_received, quantity_available, purchase_price, selling_price, invoice_number, received_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13::jsonb)
      ON CONFLICT (medicine_id, batch_number) DO UPDATE
      SET quantity_received = inventory_batches.quantity_received + EXCLUDED.quantity_received,
          quantity_available = inventory_batches.quantity_available + EXCLUDED.quantity_available,
          purchase_price = EXCLUDED.purchase_price,
          selling_price = EXCLUDED.selling_price,
          invoice_number = EXCLUDED.invoice_number,
          updated_at = NOW()
      RETURNING *
      `,
      [
        payload.id,
        medicineId,
        medicine.name,
        payload.batchNumber,
        payload.supplierId || null,
        payload.receivedDate,
        payload.expiryDate || null,
        payload.quantityReceived,
        payload.purchasePrice || 0,
        payload.sellingPrice || medicine.selling_price || 0,
        payload.invoiceNumber || "",
        payload.receivedBy || null,
        JSON.stringify({})
      ]
    );

    const transactionResult = await client.query(
      `
      INSERT INTO stock_transactions (
        id, medicine_id, medicine_name, batch_id, type, quantity, reference_number, note, created_by, metadata
      )
      VALUES ($1, $2, $3, $4, 'receipt', $5, $6, $7, $8, $9::jsonb)
      RETURNING *
      `,
      [
        payload.transactionId,
        medicineId,
        medicine.name,
        batchResult.rows[0].id,
        payload.quantityReceived,
        referenceNumber,
        payload.note || "Stock received into inventory",
        payload.receivedBy || null,
        JSON.stringify({})
      ]
    );

    return {
      batch: toCamelBatch(batchResult.rows[0]),
      transaction: toCamelStockTransaction(transactionResult.rows[0])
    };
  });
}

export async function listPurchaseOrderRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.supplierId) {
    params.push(filters.supplierId);
    conditions.push(`supplier_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`order_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`order_date <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(LOWER(po_number) LIKE $${params.length} OR LOWER(supplier_name) LIKE $${params.length} OR LOWER(note) LIKE $${params.length})`);
  }

  const orderResult = await query(`SELECT * FROM purchase_orders WHERE ${conditions.join(" AND ")} ORDER BY order_date DESC, po_number DESC`, params);
  const itemResult = await query("SELECT * FROM purchase_order_items ORDER BY medicine_name ASC");
  const itemsByOrder = new Map();
  itemResult.rows.map(toCamelPurchaseOrderItem).forEach((item) => {
    itemsByOrder.set(item.purchaseOrderId, [...(itemsByOrder.get(item.purchaseOrderId) || []), item]);
  });

  return orderResult.rows.map((row) => toCamelPurchaseOrder(row, itemsByOrder.get(row.id) || []));
}

export async function createPurchaseOrderRecord(payload) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["purchase-order:number"]);
    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM purchase_orders");
    const poNumber = `PO-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;

    const supplierResult = await client.query("SELECT * FROM suppliers WHERE id = $1 AND is_active = true", [payload.supplierId]);
    const supplier = supplierResult.rows[0];
    if (!supplier) return { conflict: "supplier_missing" };

    const orderResult = await client.query(
      `
      INSERT INTO purchase_orders (
        id, po_number, supplier_id, supplier_name, order_date, expected_date, status,
        subtotal, tax_amount, total_amount, note, created_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        poNumber,
        supplier.id,
        supplier.name,
        payload.orderDate,
        payload.expectedDate || null,
        payload.status,
        payload.subtotal,
        payload.taxAmount,
        payload.totalAmount,
        payload.note || "",
        payload.createdBy || null,
        JSON.stringify({})
      ]
    );

    const items = [];
    for (const line of payload.items) {
      const medicineId = await resolveMedicineId(client, line.medicineId);
      if (!medicineId) return { conflict: "medicine_missing", medicineId: line.medicineId };
      const medicineResult = await client.query("SELECT * FROM medicine_masters WHERE id = $1", [medicineId]);
      const medicine = medicineResult.rows[0];
      const itemResult = await client.query(
        `
        INSERT INTO purchase_order_items (
          id, purchase_order_id, medicine_id, medicine_name, quantity, unit_price, amount, note, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING *
        `,
        [line.id, orderResult.rows[0].id, medicine.id, medicine.name, line.quantity, line.unitPrice, line.amount, line.note || "", JSON.stringify({})]
      );
      items.push(toCamelPurchaseOrderItem(itemResult.rows[0]));
    }

    return toCamelPurchaseOrder(orderResult.rows[0], items);
  });
}

export async function loadInventoryMirrors() {
  const [medicines, suppliers, batches, stockTransactions, purchaseOrders] = await Promise.all([
    listMedicineRecords(),
    listSupplierRecords(),
    listBatchRecords(),
    listStockTransactionRecords(),
    listPurchaseOrderRecords()
  ]);
  return { medicines, suppliers, batches, stockTransactions, purchaseOrders };
}
