import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";
import { nullableUuid } from "../../utils/ids.js";

function toNumber(value) {
  return Number(value || 0);
}

async function existingUuid(client, tableName, value) {
  const id = nullableUuid(value);
  if (!id) return null;

  const result = await client.query(`SELECT id FROM ${tableName} WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0]?.id || null;
}

function toCamelItem(row) {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    amount: toNumber(row.amount),
    batchNumber: row.batch_number || "",
    pack: row.pack || "",
    expiryDate: toIsoDate(row.expiry_date),
    gstPercent: toNumber(row.gst_percent),
    metadata: row.metadata || {}
  };
}

function toCamelPayment(row) {
  if (!row) return null;

  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    billId: row.bill_id || "",
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    paymentDate: toIsoDateTime(row.payment_date),
    amount: toNumber(row.amount),
    paymentMode: row.payment_mode,
    referenceNumber: row.reference_number || "",
    receivedBy: row.received_by || "",
    note: row.note || "",
    metadata: row.metadata || {}
  };
}

function toCamelRefund(row) {
  if (!row) return null;

  return {
    id: row.id,
    refundNumber: row.refund_number,
    billId: row.bill_id || "",
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    refundDate: toIsoDateTime(row.refund_date),
    amount: toNumber(row.amount),
    paymentMode: row.payment_mode,
    referenceNumber: row.reference_number || "",
    reason: row.reason,
    note: row.note || "",
    approvedBy: row.approved_by || "",
    metadata: row.metadata || {}
  };
}

function calculatePaymentStatus(totalAmount, payments = [], refunds = []) {
  const grossPaidAmount = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const refundedAmount = refunds.reduce((sum, refund) => sum + toNumber(refund.amount), 0);
  const paidAmount = Math.max(grossPaidAmount - refundedAmount, 0);
  const balanceAmount = toNumber(totalAmount) - paidAmount;

  let paymentStatus = "unpaid";
  if (refundedAmount > 0 && paidAmount <= 0) {
    paymentStatus = "refunded";
  } else if (balanceAmount <= 0) {
    paymentStatus = "paid";
  } else if (paidAmount > 0) {
    paymentStatus = "partial";
  }

  return { grossPaidAmount, refundedAmount, paidAmount, balanceAmount, paymentStatus };
}

function toCamelBill(row, items = [], payments = [], refunds = []) {
  if (!row) return null;

  const computed = calculatePaymentStatus(row.total_amount, payments, refunds);

  return {
    id: row.id,
    billNumber: row.bill_number,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    visitId: row.visit_id || "",
    bedId: row.bed_id || "",
    billType: row.bill_type,
    billDate: toIsoDate(row.bill_date),
    subtotal: toNumber(row.subtotal),
    discountAmount: toNumber(row.discount_amount),
    taxAmount: toNumber(row.tax_amount),
    totalAmount: toNumber(row.total_amount),
    paymentStatus: computed.paymentStatus,
    createdBy: row.created_by || "",
    notes: row.notes || "",
    invoiceMeta: row.invoice_meta || {},
    metadata: row.metadata || {},
    items,
    payments,
    refunds,
    ...computed,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadBillBundle(client, billId) {
  const billResult = await client.query("SELECT * FROM bills WHERE id = $1", [billId]);
  const bill = billResult.rows[0];
  if (!bill) return null;

  const itemResult = await client.query("SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id", [billId]);
  const paymentResult = await client.query("SELECT * FROM payments WHERE bill_id = $1 ORDER BY payment_date DESC", [billId]);
  const refundResult = await client.query("SELECT * FROM refunds WHERE bill_id = $1 ORDER BY refund_date DESC", [billId]);

  return toCamelBill(
    bill,
    itemResult.rows.map(toCamelItem),
    paymentResult.rows.map(toCamelPayment),
    refundResult.rows.map(toCamelRefund)
  );
}

async function updateStoredPaymentStatus(client, billId, status) {
  await client.query("UPDATE bills SET payment_status = $2, updated_at = NOW() WHERE id = $1", [billId, status]);
}

export async function findBillById(id) {
  return withTransaction((client) => loadBillBundle(client, id));
}

export async function listBillRecords(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }
  if (filters.visitId) {
    params.push(filters.visitId);
    conditions.push(`visit_id = $${params.length}`);
  }
  if (filters.billType) {
    params.push(filters.billType);
    conditions.push(`bill_type = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`bill_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`bill_date <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(
      LOWER(bill_number) LIKE $${params.length}
      OR LOWER(patient_name) LIKE $${params.length}
      OR LOWER(bill_type) LIKE $${params.length}
      OR LOWER(notes) LIKE $${params.length}
    )`);
  }

  const result = await query(`SELECT * FROM bills WHERE ${conditions.join(" AND ")} ORDER BY bill_date DESC, created_at DESC`, params);
  const bills = [];
  for (const row of result.rows) {
    const bill = await findBillById(row.id);
    if (!filters.paymentStatus || bill.paymentStatus === filters.paymentStatus) {
      bills.push(bill);
    }
  }

  return bills;
}

export async function listPaymentRecords(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.billId) {
    params.push(filters.billId);
    conditions.push(`bill_id = $${params.length}`);
  }
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }
  if (filters.paymentMode) {
    params.push(filters.paymentMode);
    conditions.push(`payment_mode = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`payment_date::date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`payment_date::date <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(
      LOWER(receipt_number) LIKE $${params.length}
      OR LOWER(patient_name) LIKE $${params.length}
      OR LOWER(reference_number) LIKE $${params.length}
      OR LOWER(payment_mode) LIKE $${params.length}
    )`);
  }

  const result = await query(`SELECT * FROM payments WHERE ${conditions.join(" AND ")} ORDER BY payment_date DESC`, params);
  return result.rows.map(toCamelPayment);
}

export async function listRefundRecords(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.billId) {
    params.push(filters.billId);
    conditions.push(`bill_id = $${params.length}`);
  }
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }
  if (filters.paymentMode) {
    params.push(filters.paymentMode);
    conditions.push(`payment_mode = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    conditions.push(`refund_date::date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    conditions.push(`refund_date::date <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(
      LOWER(refund_number) LIKE $${params.length}
      OR LOWER(patient_name) LIKE $${params.length}
      OR LOWER(reference_number) LIKE $${params.length}
      OR LOWER(payment_mode) LIKE $${params.length}
      OR LOWER(reason) LIKE $${params.length}
    )`);
  }

  const result = await query(`SELECT * FROM refunds WHERE ${conditions.join(" AND ")} ORDER BY refund_date DESC`, params);
  return result.rows.map(toCamelRefund);
}

export async function createBillRecordWithClient(client, payload) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["bill:number"]);
  const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM bills");
  const billNumber = payload.billNumber || `BILL-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;
  const visitId = await existingUuid(client, "opd_visits", payload.visitId);
  const bedId = await existingUuid(client, "beds", payload.bedId);
  const createdBy = await existingUuid(client, "users", payload.createdBy);
  const metadata = {
    ...(payload.metadata || {}),
    sourceVisitId: payload.visitId || "",
    sourceBedId: payload.bedId || "",
    sourceCreatedBy: payload.createdBy || ""
  };

  const result = await client.query(
    `
    INSERT INTO bills (
      id, bill_number, patient_id, patient_name, visit_id, bed_id, bill_type, bill_date,
      subtotal, discount_amount, tax_amount, total_amount, payment_status, created_by,
      notes, invoice_meta, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16::jsonb, $17::jsonb
    )
    RETURNING *
    `,
    [
      payload.id,
      billNumber,
      payload.patientId || null,
      payload.patientName,
      visitId,
      bedId,
      payload.billType,
      payload.billDate,
      payload.subtotal,
      payload.discountAmount,
      payload.taxAmount,
      payload.totalAmount,
      payload.paymentStatus || "unpaid",
      createdBy,
      payload.notes || "",
      JSON.stringify(payload.invoiceMeta || {}),
      JSON.stringify(metadata)
    ]
  );

  for (const item of payload.items || []) {
    await client.query(
      `
      INSERT INTO bill_items (
        id, bill_id, description, category, quantity, unit_price, amount,
        batch_number, pack, expiry_date, gst_percent, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      `,
      [
        item.id,
        result.rows[0].id,
        item.description,
        item.category,
        item.quantity,
        item.unitPrice,
        item.amount,
        item.batchNumber || "",
        item.pack || "",
        item.expiryDate || null,
        item.gstPercent || 0,
        JSON.stringify(item.metadata || {})
      ]
    );
  }

  return loadBillBundle(client, result.rows[0].id);
}

export async function createBillRecord(payload) {
  return withTransaction((client) => createBillRecordWithClient(client, payload));
}

export async function applyDiscountRecord(billId, payload = {}, actorId = "") {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bill:${billId}`]);
    const bill = await loadBillBundle(client, billId);
    if (!bill) return null;

    const discountHistory = [
      {
        id: payload.historyId,
        discountAmount: payload.discountAmount,
        reason: payload.reason || "",
        appliedBy: actorId || "",
        appliedAt: new Date().toISOString()
      },
      ...(bill.metadata?.discountHistory || [])
    ];

    const totalAmount = toNumber(bill.subtotal) - toNumber(payload.discountAmount) + toNumber(bill.taxAmount);
    const paymentStatus = calculatePaymentStatus(totalAmount, bill.payments, bill.refunds).paymentStatus;

    await client.query(
      `
      UPDATE bills
      SET discount_amount = $2, total_amount = $3, payment_status = $4,
          metadata = metadata || $5::jsonb, updated_at = NOW()
      WHERE id = $1
      `,
      [billId, payload.discountAmount, totalAmount, paymentStatus, JSON.stringify({ discountHistory })]
    );

    return loadBillBundle(client, billId);
  });
}

export async function createPaymentRecord(billId, payload = {}) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bill:${billId}`]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["receipt:number"]);

    const bill = await loadBillBundle(client, billId);
    if (!bill) return null;

    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM payments");
    const receiptNumber = payload.receiptNumber || `RCT-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;
    const receivedBy = await existingUuid(client, "users", payload.receivedBy);

    const paymentResult = await client.query(
      `
      INSERT INTO payments (
        id, receipt_number, bill_id, patient_id, patient_name, payment_date,
        amount, payment_mode, reference_number, received_by, note, metadata
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        receiptNumber,
        bill.id,
        bill.patientId || null,
        bill.patientName,
        payload.paymentDate || null,
        payload.amount,
        payload.paymentMode,
        payload.referenceNumber || "",
        receivedBy,
        payload.note || "",
        JSON.stringify({ ...(payload.metadata || {}), sourceReceivedBy: payload.receivedBy || "" })
      ]
    );

    const updated = await loadBillBundle(client, billId);
    await updateStoredPaymentStatus(client, billId, updated.paymentStatus);

    return {
      payment: toCamelPayment(paymentResult.rows[0]),
      bill: await loadBillBundle(client, billId)
    };
  });
}

export async function createRefundRecord(payload = {}) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bill:${payload.billId}`]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["refund:number"]);

    const bill = await loadBillBundle(client, payload.billId);
    if (!bill) return null;

    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM refunds");
    const refundNumber = payload.refundNumber || `RFD-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;
    const approvedBy = await existingUuid(client, "users", payload.approvedBy);

    const refundResult = await client.query(
      `
      INSERT INTO refunds (
        id, refund_number, bill_id, patient_id, patient_name, refund_date,
        amount, payment_mode, reference_number, reason, note, approved_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, $8, $9, $10, $11, $12, $13::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        refundNumber,
        bill.id,
        bill.patientId || null,
        bill.patientName,
        payload.refundDate || null,
        payload.amount,
        payload.paymentMode,
        payload.referenceNumber || "",
        payload.reason,
        payload.note || "",
        approvedBy,
        JSON.stringify({ ...(payload.metadata || {}), sourceApprovedBy: payload.approvedBy || "" })
      ]
    );

    const updated = await loadBillBundle(client, payload.billId);
    await updateStoredPaymentStatus(client, payload.billId, updated.paymentStatus);

    return {
      refund: toCamelRefund(refundResult.rows[0]),
      bill: await loadBillBundle(client, payload.billId)
    };
  });
}

export async function upsertSeedBill(client, bill) {
  await client.query(
    `
    INSERT INTO bills (
      id, bill_number, patient_id, patient_name, visit_id, bed_id, bill_type, bill_date,
      subtotal, discount_amount, tax_amount, total_amount, payment_status, created_by,
      notes, invoice_meta, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16::jsonb, $17::jsonb
    )
    ON CONFLICT (bill_number) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      visit_id = EXCLUDED.visit_id,
      bed_id = EXCLUDED.bed_id,
      bill_type = EXCLUDED.bill_type,
      bill_date = EXCLUDED.bill_date,
      subtotal = EXCLUDED.subtotal,
      discount_amount = EXCLUDED.discount_amount,
      tax_amount = EXCLUDED.tax_amount,
      total_amount = EXCLUDED.total_amount,
      payment_status = EXCLUDED.payment_status,
      created_by = EXCLUDED.created_by,
      notes = EXCLUDED.notes,
      invoice_meta = EXCLUDED.invoice_meta,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    `,
    [
      bill.id,
      bill.billNumber,
      bill.patientId || null,
      bill.patientName,
      bill.visitId || null,
      bill.bedId || null,
      bill.billType,
      bill.billDate,
      bill.subtotal,
      bill.discountAmount,
      bill.taxAmount,
      bill.totalAmount,
      bill.paymentStatus || "unpaid",
      bill.createdBy || null,
      bill.notes || "",
      JSON.stringify(bill.invoiceMeta || {}),
      JSON.stringify(bill.metadata || {})
    ]
  );

  await client.query("DELETE FROM bill_items WHERE bill_id = $1", [bill.id]);
  for (const item of bill.items || []) {
    await client.query(
      `
      INSERT INTO bill_items (
        id, bill_id, description, category, quantity, unit_price, amount,
        batch_number, pack, expiry_date, gst_percent, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      `,
      [
        item.id,
        bill.id,
        item.description,
        item.category || "service",
        item.quantity || 1,
        item.unitPrice || 0,
        item.amount || 0,
        item.batchNumber || "",
        item.pack || "",
        item.expiryDate || null,
        item.gstPercent || 0,
        JSON.stringify(item.metadata || {})
      ]
    );
  }
}

export async function upsertSeedPayment(client, payment) {
  await client.query(
    `
    INSERT INTO payments (
      id, receipt_number, bill_id, patient_id, patient_name, payment_date,
      amount, payment_mode, reference_number, received_by, note, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    ON CONFLICT (receipt_number) DO UPDATE
    SET
      bill_id = EXCLUDED.bill_id,
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      payment_date = EXCLUDED.payment_date,
      amount = EXCLUDED.amount,
      payment_mode = EXCLUDED.payment_mode,
      reference_number = EXCLUDED.reference_number,
      received_by = EXCLUDED.received_by,
      note = EXCLUDED.note,
      metadata = EXCLUDED.metadata
    `,
    [
      payment.id,
      payment.receiptNumber,
      payment.billId || null,
      payment.patientId || null,
      payment.patientName,
      payment.paymentDate,
      payment.amount,
      payment.paymentMode,
      payment.referenceNumber || "",
      payment.receivedBy || null,
      payment.note || "",
      JSON.stringify(payment.metadata || {})
    ]
  );
}

export async function upsertSeedRefund(client, refund) {
  await client.query(
    `
    INSERT INTO refunds (
      id, refund_number, bill_id, patient_id, patient_name, refund_date,
      amount, payment_mode, reference_number, reason, note, approved_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
    ON CONFLICT (refund_number) DO UPDATE
    SET
      bill_id = EXCLUDED.bill_id,
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      refund_date = EXCLUDED.refund_date,
      amount = EXCLUDED.amount,
      payment_mode = EXCLUDED.payment_mode,
      reference_number = EXCLUDED.reference_number,
      reason = EXCLUDED.reason,
      note = EXCLUDED.note,
      approved_by = EXCLUDED.approved_by,
      metadata = EXCLUDED.metadata
    `,
    [
      refund.id,
      refund.refundNumber,
      refund.billId || null,
      refund.patientId || null,
      refund.patientName,
      refund.refundDate,
      refund.amount,
      refund.paymentMode,
      refund.referenceNumber || "",
      refund.reason,
      refund.note || "",
      refund.approvedBy || null,
      JSON.stringify(refund.metadata || {})
    ]
  );
}
