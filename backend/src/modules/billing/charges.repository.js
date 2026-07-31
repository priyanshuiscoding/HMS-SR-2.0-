import { query } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";

const pool = { query: (text, params) => query(text, params) };

function toNumber(value) {
  return Number(value || 0);
}

function billItem(item) {
  return {
    description: item.description,
    category: item.category,
    quantity: toNumber(item.quantity) || 1,
    unitPrice: toNumber(item.unitPrice),
    amount: toNumber(item.amount),
    batchNumber: item.batchNumber || "",
    pack: item.pack || "",
    expiryDate: item.expiryDate || null,
    gstPercent: toNumber(item.gstPercent),
    metadata: item.metadata || {}
  };
}

function withTotal(charge) {
  return { ...charge, total: charge.items.reduce((sum, item) => sum + toNumber(item.amount), 0) };
}

// Scopes a charge query to one patient and/or an explicit set of source rows.
// The billing desk lists by patient; bill creation re-reads the exact rows it is
// about to consume so a charge billed on another counter meanwhile drops out.
function scopeClause({ patientId, sourceIds }, { idColumn, patientColumn }) {
  const params = [];
  let clause = "";

  if (patientId) {
    params.push(patientId);
    clause += ` AND ${patientColumn} = $${params.length}`;
  }

  if (sourceIds?.length) {
    params.push(sourceIds);
    clause += ` AND ${idColumn} = ANY($${params.length}::uuid[])`;
  }

  return { clause, params };
}

async function loadConsultationCharges(executor, filters) {
  const { clause, params } = scopeClause(filters, { idColumn: "v.id", patientColumn: "v.patient_id" });
  const result = await executor.query(
    `
    SELECT v.id, v.opd_number, v.patient_id, v.patient_name, v.visit_date, v.consultation_fee
    FROM opd_visits v
    WHERE v.consultation_fee > 0
      AND v.status <> 'cancelled'
      AND COALESCE(v.metadata->>'billId', '') = ''
      ${clause}
    ORDER BY v.visit_date DESC
    `,
    params
  );

  return result.rows.map((row) => ({
    source: "consultation",
    sourceId: row.id,
    reference: row.opd_number,
    chargeDate: toIsoDate(row.visit_date),
    label: `OPD consultation - ${row.opd_number}`,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    visitId: row.id,
    bedId: "",
    items: [
      billItem({
        description: "OPD Consultation Fee",
        category: "consultation",
        quantity: 1,
        unitPrice: row.consultation_fee,
        amount: row.consultation_fee,
        metadata: { visitId: row.id, opdNumber: row.opd_number }
      })
    ]
  }));
}

async function loadLabCharges(executor, filters) {
  const { clause, params } = scopeClause(filters, { idColumn: "o.id", patientColumn: "o.patient_id" });
  const result = await executor.query(
    `
    SELECT o.id, o.order_number, o.patient_id, o.patient_name, o.order_date, o.visit_id
    FROM lab_orders o
    WHERE o.bill_id IS NULL
      AND o.status <> 'cancelled'
      ${clause}
    ORDER BY o.order_date DESC
    `,
    params
  );

  if (!result.rows.length) return [];

  const testResult = await executor.query(
    `
    SELECT t.order_id, t.test_name, COALESCE(m.price, 0) AS price
    FROM lab_order_tests t
    LEFT JOIN lab_test_masters m ON m.id = t.test_id
    WHERE t.order_id = ANY($1::uuid[])
    ORDER BY t.test_name ASC
    `,
    [result.rows.map((row) => row.id)]
  );

  const testsByOrder = new Map();
  testResult.rows.forEach((row) => {
    testsByOrder.set(row.order_id, [...(testsByOrder.get(row.order_id) || []), row]);
  });

  return result.rows.map((row) => ({
    source: "lab",
    sourceId: row.id,
    reference: row.order_number,
    chargeDate: toIsoDate(row.order_date),
    label: `Lab order - ${row.order_number}`,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    visitId: row.visit_id || "",
    bedId: "",
    items: (testsByOrder.get(row.id) || []).map((test) =>
      billItem({
        description: test.test_name,
        category: "lab",
        quantity: 1,
        unitPrice: test.price,
        amount: test.price,
        metadata: { labOrderId: row.id, labOrderNumber: row.order_number }
      })
    )
  }));
}

async function loadPharmacyCharges(executor, filters) {
  const { clause, params } = scopeClause(filters, { idColumn: "d.id", patientColumn: "d.patient_id" });
  const result = await executor.query(
    `
    SELECT d.id, d.dispense_number, d.patient_id, d.patient_name, d.visit_id, d.dispensed_date, d.prescription_id
    FROM dispensations d
    WHERE COALESCE(d.metadata->>'billId', '') = ''
      ${clause}
    ORDER BY d.dispensed_date DESC
    `,
    params
  );

  if (!result.rows.length) return [];

  const itemResult = await executor.query(
    `
    SELECT i.dispensation_id, i.medicine_id, i.medicine_name, i.batch_id, i.batch_number,
           i.quantity, i.unit_price, i.amount,
           COALESCE(m.unit, '') AS pack, COALESCE(m.gst_percentage, 0) AS gst_percent, b.expiry_date
    FROM dispensation_items i
    LEFT JOIN medicine_masters m ON m.id = i.medicine_id
    LEFT JOIN inventory_batches b ON b.id = i.batch_id
    WHERE i.dispensation_id = ANY($1::uuid[])
    ORDER BY i.medicine_name ASC
    `,
    [result.rows.map((row) => row.id)]
  );

  const itemsByDispensation = new Map();
  itemResult.rows.forEach((row) => {
    itemsByDispensation.set(row.dispensation_id, [...(itemsByDispensation.get(row.dispensation_id) || []), row]);
  });

  return result.rows.map((row) => ({
    source: "pharmacy",
    sourceId: row.id,
    reference: row.dispense_number,
    chargeDate: toIsoDateTime(row.dispensed_date).slice(0, 10),
    label: `Pharmacy dispensing - ${row.dispense_number}`,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    visitId: row.visit_id || "",
    bedId: "",
    items: (itemsByDispensation.get(row.id) || []).map((item) =>
      billItem({
        description: item.medicine_name,
        category: "pharmacy",
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount,
        batchNumber: item.batch_number,
        pack: item.pack,
        expiryDate: item.expiry_date,
        gstPercent: item.gst_percent,
        metadata: { dispensationId: row.id, dispenseNumber: row.dispense_number, medicineId: item.medicine_id }
      })
    )
  }));
}

async function loadTherapyCharges(executor, filters) {
  const { clause, params } = scopeClause(filters, { idColumn: "s.id", patientColumn: "s.patient_id" });
  const result = await executor.query(
    `
    SELECT s.id, s.schedule_number, s.patient_id, s.patient_name, s.therapy_name,
           s.scheduled_date, s.billed_amount, s.linked_visit_id, s.metadata
    FROM panchkarma_sessions s
    WHERE s.bill_id IS NULL
      AND s.status = 'completed'
      ${clause}
    ORDER BY s.scheduled_date DESC
    `,
    params
  );

  return result.rows.map((row) => {
    // Sessions record their own priced breakdown at completion (therapy plus any
    // materials); fall back to the single billed amount for older rows.
    const storedItems = Array.isArray(row.metadata?.billItems) ? row.metadata.billItems : [];
    const items = storedItems.length
      ? storedItems.map(billItem)
      : [
        billItem({
          description: `${row.therapy_name} Panchkarma session`,
          category: "therapy",
          quantity: 1,
          unitPrice: row.billed_amount,
          amount: row.billed_amount
        })
      ];

    return {
      source: "therapy",
      sourceId: row.id,
      reference: row.schedule_number,
      chargeDate: toIsoDate(row.scheduled_date),
      label: `${row.therapy_name} - ${row.schedule_number}`,
      patientId: row.patient_id || "",
      patientName: row.patient_name,
      visitId: row.linked_visit_id || "",
      bedId: "",
      items: items.map((item) => ({
        ...item,
        metadata: { ...item.metadata, panchkarmaSessionId: row.id, panchkarmaScheduleNumber: row.schedule_number }
      }))
    };
  });
}

async function loadIpdCharges(executor, filters) {
  const { clause, params } = scopeClause(filters, { idColumn: "a.id", patientColumn: "a.patient_id" });
  const result = await executor.query(
    `
    SELECT a.id, a.admission_number, a.patient_id, a.patient_name, a.bed_id,
           a.admission_date, a.discharge_summary
    FROM ipd_admissions a
    WHERE a.bill_id IS NULL
      AND a.status = 'discharged'
      ${clause}
    ORDER BY a.admission_date DESC
    `,
    params
  );

  return result.rows.map((row) => {
    const summary = row.discharge_summary || {};
    const stayDays = Math.max(toNumber(summary.stayDays) || 1, 1);
    const roomCharge = toNumber(summary.roomCharge);
    const extraCharge = toNumber(summary.extraCharge);
    const items = [
      billItem({
        description: `IPD stay charges (${stayDays} day${stayDays === 1 ? "" : "s"})`,
        category: "room",
        quantity: stayDays,
        unitPrice: roomCharge / stayDays,
        amount: roomCharge,
        metadata: { admissionId: row.id, admissionNumber: row.admission_number }
      })
    ];

    if (extraCharge > 0) {
      items.push(
        billItem({
          description: summary.extraChargeLabel || "IPD additional charges",
          category: "service",
          quantity: 1,
          unitPrice: extraCharge,
          amount: extraCharge,
          metadata: { admissionId: row.id, admissionNumber: row.admission_number }
        })
      );
    }

    return {
      source: "ipd",
      sourceId: row.id,
      reference: row.admission_number,
      chargeDate: toIsoDate(summary.dischargeDate || row.admission_date),
      label: `IPD stay - ${row.admission_number}`,
      patientId: row.patient_id || "",
      patientName: row.patient_name,
      visitId: "",
      bedId: row.bed_id || "",
      items
    };
  });
}

const CHARGE_LOADERS = {
  consultation: loadConsultationCharges,
  lab: loadLabCharges,
  pharmacy: loadPharmacyCharges,
  therapy: loadTherapyCharges,
  ipd: loadIpdCharges
};

// Each source keeps its own "already billed" marker, so consuming a charge is a
// single update on the module that owns it - no separate ledger to drift.
const BILLED_MARKERS = {
  consultation: (client, ids, billId, billNumber) =>
    client.query(
      `
      UPDATE opd_visits
      SET metadata = metadata || jsonb_build_object('billId', $2::text, 'billNumber', $3::text), updated_at = NOW()
      WHERE id = ANY($1::uuid[])
      `,
      [ids, billId, billNumber]
    ),
  lab: (client, ids, billId) =>
    client.query("UPDATE lab_orders SET bill_id = $2, updated_at = NOW() WHERE id = ANY($1::uuid[])", [ids, billId]),
  pharmacy: (client, ids, billId, billNumber) =>
    client.query(
      `
      UPDATE dispensations
      SET metadata = metadata || jsonb_build_object('billId', $2::text, 'billNumber', $3::text), updated_at = NOW()
      WHERE id = ANY($1::uuid[])
      `,
      [ids, billId, billNumber]
    ),
  therapy: (client, ids, billId) =>
    client.query("UPDATE panchkarma_sessions SET bill_id = $2, updated_at = NOW() WHERE id = ANY($1::uuid[])", [ids, billId]),
  ipd: (client, ids, billId) =>
    client.query("UPDATE ipd_admissions SET bill_id = $2, updated_at = NOW() WHERE id = ANY($1::uuid[])", [ids, billId])
};

export const CHARGE_SOURCES = Object.keys(CHARGE_LOADERS);

async function loadPendingCharges(executor, filters = {}) {
  const sources = filters.sources?.length ? filters.sources.filter((source) => CHARGE_LOADERS[source]) : CHARGE_SOURCES;
  const charges = [];

  for (const source of sources) {
    const loaded = await CHARGE_LOADERS[source](executor, filters);
    charges.push(...loaded.map(withTotal));
  }

  return charges
    .filter((charge) => charge.items.length)
    .sort((left, right) => String(right.chargeDate).localeCompare(String(left.chargeDate)));
}

export async function listPendingChargeRecords(filters = {}) {
  return loadPendingCharges(pool, filters);
}

// Re-reads the exact rows a bill is about to consume, inside the caller's
// transaction. Anything already billed simply will not come back, which is how
// the caller detects a charge that was consumed elsewhere in the meantime.
export async function loadChargesForBilling(client, refs = []) {
  const idsBySource = new Map();

  refs.forEach((ref) => {
    if (!ref?.source || !ref?.sourceId || !CHARGE_LOADERS[ref.source]) return;
    idsBySource.set(ref.source, [...(idsBySource.get(ref.source) || []), ref.sourceId]);
  });

  const charges = [];
  for (const [source, sourceIds] of idsBySource) {
    const loaded = await CHARGE_LOADERS[source](client, { sourceIds });
    charges.push(...loaded.map(withTotal));
  }

  return charges;
}

export async function markChargesBilled(client, charges = [], billId, billNumber) {
  const idsBySource = new Map();
  charges.forEach((charge) => {
    idsBySource.set(charge.source, [...(idsBySource.get(charge.source) || []), charge.sourceId]);
  });

  for (const [source, ids] of idsBySource) {
    await BILLED_MARKERS[source](client, ids, billId, billNumber);
  }
}
