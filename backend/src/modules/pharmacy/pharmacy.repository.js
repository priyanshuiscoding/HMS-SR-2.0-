import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";
import { resolveMedicineId, toCamelBatch, toCamelMedicine, toCamelStockTransaction } from "../inventory/inventory.repository.js";

const pool = { query: (text, params) => query(text, params) };

function toNumber(value) {
  return Number(value || 0);
}

function medicineNameKey(value) {
  return String(value || "").trim().toLowerCase();
}

// Dispensed quantities are tracked per medicine, keyed by master id where the
// prescription line carries one and by name otherwise, because legacy lines and
// hand-typed medicines do not always resolve to a medicine master row.
function issuedQuantityFor(medicineRow, index) {
  if (medicineRow.medicine_id && index.byId.has(medicineRow.medicine_id)) {
    return index.byId.get(medicineRow.medicine_id);
  }

  return index.byName.get(medicineNameKey(medicineRow.medicine_name)) || 0;
}

function addIssuedQuantity(index, medicineId, medicineName, quantity) {
  if (medicineId) {
    index.byId.set(medicineId, (index.byId.get(medicineId) || 0) + quantity);
  }

  const nameKey = medicineNameKey(medicineName);
  if (nameKey) {
    index.byName.set(nameKey, (index.byName.get(nameKey) || 0) + quantity);
  }
}

async function loadIssuedIndex(client, prescriptionId) {
  const result = await client.query(
    `
    SELECT di.medicine_id, di.medicine_name, SUM(di.quantity) AS quantity
    FROM dispensation_items di
    JOIN dispensations d ON d.id = di.dispensation_id
    WHERE d.prescription_id = $1
    GROUP BY di.medicine_id, di.medicine_name
    `,
    [prescriptionId]
  );

  const index = { byId: new Map(), byName: new Map() };
  result.rows.forEach((row) => addIssuedQuantity(index, row.medicine_id, row.medicine_name, toNumber(row.quantity)));
  return index;
}

function toCamelDispensationItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    dispensationId: row.dispensation_id,
    medicineId: row.medicine_id || "",
    medicineName: row.medicine_name,
    batchId: row.batch_id || "",
    batchNumber: row.batch_number || "",
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    amount: toNumber(row.amount),
    metadata: row.metadata || {}
  };
}

function toCamelDispensation(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    dispenseNumber: row.dispense_number,
    prescriptionId: row.prescription_id || "",
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    visitId: row.visit_id || "",
    dispensedBy: row.dispensed_by || "",
    dispensedDate: toIsoDateTime(row.dispensed_date),
    status: row.status || "completed",
    items,
    metadata: row.metadata || {}
  };
}

// A prescription is only "completed" once every prescribed line has been fully
// handed over. Anything in between stays in the pharmacy queue as "partial" so
// the patient can come back for the rest of the course.
function derivePharmacyStatus(row, issuedTotal) {
  const explicitStatus = row.metadata?.pharmacyStatus || "";

  if (explicitStatus === "cancelled") return "cancelled";
  if (row.is_dispensed) return "completed";
  if (explicitStatus === "reopened") return "reopened";
  return issuedTotal > 0 ? "partial" : "pending";
}

function toCamelPrescription(row, medicines = [], dispensations = []) {
  if (!row) return null;

  // Totals come off the dispensation items rather than the per-line figures so
  // they stay exact even when a prescription repeats the same medicine twice.
  const dispensedTotal = dispensations.reduce(
    (sum, dispensation) => sum + dispensation.items.reduce((itemSum, item) => itemSum + toNumber(item.quantity), 0),
    0
  );
  const prescribedTotal = medicines.reduce((sum, medicine) => sum + toNumber(medicine.quantityPrescribed), 0);

  return {
    id: row.id,
    prescriptionNumber: row.prescription_number,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    doctorId: row.doctor_id || "",
    visitId: row.visit_id || "",
    prescriptionDate: toIsoDate(row.prescription_date),
    diagnosis: row.diagnosis || "",
    diagnosisAyurvedic: row.diagnosis_ayurvedic || "",
    isDispensed: Boolean(row.is_dispensed),
    pharmacyStatus: derivePharmacyStatus(row, dispensedTotal),
    prescribedTotal,
    dispensedTotal,
    balanceTotal: Math.max(prescribedTotal - dispensedTotal, 0),
    medicines,
    dispensations,
    dispensation: dispensations[0] || null,
    metadata: row.metadata || {}
  };
}

function toCamelPrescriptionMedicine(row, quantityIssued = 0) {
  const quantityPrescribed = Number(row.quantity_dispensed || 0);
  const issued = toNumber(quantityIssued);

  return {
    id: row.id,
    medicineId: row.metadata?.sourceMedicineId || row.medicine_id || "",
    medicineName: row.medicine_name,
    strength: row.metadata?.strength || "",
    dose: row.dose || "",
    frequency: row.frequency || "",
    route: row.route || "",
    timing: row.timing || "",
    durationDays: Number(row.duration_days || 0),
    // quantityDispensed keeps its original meaning (what the doctor prescribed)
    // because the OPD prescription form and printable Rx both write and read it.
    quantityDispensed: quantityPrescribed,
    quantityPrescribed,
    quantityIssued: issued,
    balanceQuantity: Math.max(quantityPrescribed - issued, 0),
    specialInstructions: row.special_instructions || "",
    metadata: row.metadata || {}
  };
}

async function loadDispensationBundle(client, dispensationId) {
  const dispensationResult = await client.query("SELECT * FROM dispensations WHERE id = $1", [dispensationId]);
  const dispensation = dispensationResult.rows[0];
  if (!dispensation) return null;
  const itemResult = await client.query("SELECT * FROM dispensation_items WHERE dispensation_id = $1 ORDER BY medicine_name ASC", [dispensationId]);
  return toCamelDispensation(dispensation, itemResult.rows.map(toCamelDispensationItem));
}

export async function listDispensationRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }
  const dispensationResult = await query(`SELECT * FROM dispensations WHERE ${conditions.join(" AND ")} ORDER BY dispensed_date DESC`, params);
  const itemResult = await query("SELECT * FROM dispensation_items ORDER BY medicine_name ASC");
  const itemsByDispensation = new Map();
  itemResult.rows.map(toCamelDispensationItem).forEach((item) => {
    itemsByDispensation.set(item.dispensationId, [...(itemsByDispensation.get(item.dispensationId) || []), item]);
  });
  return dispensationResult.rows.map((row) => toCamelDispensation(row, itemsByDispensation.get(row.id) || []));
}

// Reads through whichever executor is passed in so callers inside a transaction
// see their own uncommitted writes instead of a stale pooled snapshot.
async function loadPrescriptionQueue(executor, filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.status === "pending") conditions.push("p.is_dispensed = false AND COALESCE(p.metadata->>'pharmacyStatus', 'pending') <> 'cancelled'");
  if (filters.status === "completed") conditions.push("p.is_dispensed = true");
  if (filters.status === "cancelled") conditions.push("COALESCE(p.metadata->>'pharmacyStatus', '') = 'cancelled'");
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`p.patient_id = $${params.length}`);
  }
  if (filters.prescriptionId) {
    params.push(filters.prescriptionId);
    conditions.push(`p.id = $${params.length}`);
  }

  const prescriptionResult = await executor.query(
    `
    SELECT p.*
    FROM prescriptions p
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.prescription_date DESC, p.created_at DESC
    `,
    params
  );

  if (!prescriptionResult.rows.length) {
    return [];
  }

  const prescriptionIds = prescriptionResult.rows.map((row) => row.id);
  const medicineResult = await executor.query(
    "SELECT * FROM prescription_medicines WHERE prescription_id = ANY($1::uuid[]) ORDER BY medicine_name ASC",
    [prescriptionIds]
  );
  const dispensationResult = await executor.query(
    "SELECT * FROM dispensations WHERE prescription_id = ANY($1::uuid[]) ORDER BY dispensed_date DESC",
    [prescriptionIds]
  );
  const dispensationIds = dispensationResult.rows.map((row) => row.id);
  const itemResult = dispensationIds.length
    ? await executor.query(
      "SELECT * FROM dispensation_items WHERE dispensation_id = ANY($1::uuid[]) ORDER BY medicine_name ASC",
      [dispensationIds]
    )
    : { rows: [] };

  const medicineRowsByPrescription = new Map();
  for (const row of medicineResult.rows) {
    medicineRowsByPrescription.set(row.prescription_id, [...(medicineRowsByPrescription.get(row.prescription_id) || []), row]);
  }

  const prescriptionByDispensation = new Map(dispensationResult.rows.map((row) => [row.id, row.prescription_id]));
  const itemsByDispensation = new Map();
  const issuedByPrescription = new Map();

  itemResult.rows.map(toCamelDispensationItem).forEach((item) => {
    itemsByDispensation.set(item.dispensationId, [...(itemsByDispensation.get(item.dispensationId) || []), item]);

    const prescriptionId = prescriptionByDispensation.get(item.dispensationId);
    if (!prescriptionId) return;

    const index = issuedByPrescription.get(prescriptionId) || { byId: new Map(), byName: new Map() };
    addIssuedQuantity(index, item.medicineId, item.medicineName, toNumber(item.quantity));
    issuedByPrescription.set(prescriptionId, index);
  });

  const dispensationsByPrescription = new Map();
  dispensationResult.rows.forEach((row) => {
    const dispensation = toCamelDispensation(row, itemsByDispensation.get(row.id) || []);
    dispensationsByPrescription.set(row.prescription_id, [...(dispensationsByPrescription.get(row.prescription_id) || []), dispensation]);
  });

  return prescriptionResult.rows.map((row) => {
    const issuedIndex = issuedByPrescription.get(row.id) || { byId: new Map(), byName: new Map() };
    const medicines = (medicineRowsByPrescription.get(row.id) || []).map((medicineRow) =>
      toCamelPrescriptionMedicine(medicineRow, issuedQuantityFor(medicineRow, issuedIndex))
    );

    return toCamelPrescription(row, medicines, dispensationsByPrescription.get(row.id) || []);
  });
}

export async function listPrescriptionQueueRecords(filters = {}) {
  return loadPrescriptionQueue(pool, filters);
}

export async function updatePrescriptionPharmacyStatusRecord(prescriptionId, payload = {}) {
  return withTransaction(async (client) => {
    const prescriptionResult = await client.query("SELECT * FROM prescriptions WHERE id = $1 FOR UPDATE", [prescriptionId]);
    const prescription = prescriptionResult.rows[0];

    if (!prescription) return null;
    if (prescription.is_dispensed && payload.action === "cancel") return { conflict: "dispensed" };

    // Reopening clears is_dispensed so the prescription lands back in the pending
    // queue - used both for a pending balance and for a repeat of the same course.
    await client.query(
      `
      UPDATE prescriptions
      SET is_dispensed = COALESCE($3::boolean, is_dispensed),
          metadata = metadata || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
      `,
      [prescriptionId, JSON.stringify(payload.metadata || {}), payload.isDispensed ?? null]
    );

    const [updated] = await loadPrescriptionQueue(client, { prescriptionId });
    return updated || null;
  });
}

export async function getStockSummaryRecords() {
  const [medicineResult, batchResult] = await Promise.all([
    query("SELECT * FROM medicine_masters WHERE is_active = true ORDER BY name ASC"),
    query("SELECT * FROM inventory_batches ORDER BY expiry_date ASC NULLS LAST")
  ]);
  const batches = batchResult.rows.map(toCamelBatch);
  return medicineResult.rows.map((row) => {
    const medicine = toCamelMedicine(row);
    const medicineBatches = batches.filter((batch) => batch.medicineId === medicine.id);
    const totalAvailable = medicineBatches.reduce((sum, batch) => sum + Number(batch.quantityAvailable || 0), 0);
    const nearestExpiry = medicineBatches.find((batch) => Number(batch.quantityAvailable || 0) > 0)?.expiryDate || "";
    const expiringSoon = Boolean(nearestExpiry && new Date(nearestExpiry).getTime() - Date.now() <= 1000 * 60 * 60 * 24 * 90);
    return {
      ...medicine,
      totalAvailable,
      nearestExpiry,
      lowStock: totalAvailable <= Number(medicine.reorderLevel || 0),
      expiringSoon,
      activeBatches: medicineBatches.length
    };
  });
}

export async function getExpiringBatchRecords(withinDays = 90) {
  const batches = await query(
    `
    SELECT b.*, m.metadata AS medicine_metadata
    FROM inventory_batches b
    LEFT JOIN medicine_masters m ON m.id = b.medicine_id
    WHERE b.quantity_available > 0
    ORDER BY b.expiry_date ASC NULLS LAST
    `
  );
  return batches.rows
    .map((row) => {
      const batch = toCamelBatch(row);
      const timestamp = batch.expiryDate ? new Date(batch.expiryDate).getTime() : NaN;
      const daysToExpiry = Number.isNaN(timestamp) ? null : Math.floor((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
      return { ...batch, daysToExpiry };
    })
    .filter((batch) => batch.daysToExpiry !== null && batch.daysToExpiry <= withinDays);
}

export async function dispensePrescriptionRecord(prescriptionId, payload) {
  return withTransaction(async (client) => {
    const prescriptionResult = await client.query("SELECT * FROM prescriptions WHERE id = $1 FOR UPDATE", [prescriptionId]);
    const prescription = prescriptionResult.rows[0];
    if (!prescription) return null;
    if (prescription.metadata?.pharmacyStatus === "cancelled") return { conflict: "cancelled" };

    const medicineResult = await client.query("SELECT * FROM prescription_medicines WHERE prescription_id = $1 ORDER BY medicine_name ASC", [prescriptionId]);
    const issuedIndex = await loadIssuedIndex(client, prescriptionId);

    // Without explicit lines the caller means "hand over whatever is still
    // pending"; zero-quantity lines are the ones the pharmacist is not giving
    // today and are simply skipped.
    const requestedItems = (payload.items?.length
      ? payload.items
      : medicineResult.rows.map((item) => ({
        medicineId: item.metadata?.sourceMedicineId || item.medicine_id,
        quantity: Math.max(toNumber(item.quantity_dispensed) - issuedQuantityFor(item, issuedIndex), 0)
      }))
    ).filter((item) => toNumber(item.quantity) > 0);

    if (!requestedItems.length) return { conflict: "nothing_to_dispense" };

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["dispense:number"]);
    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM dispensations");
    const dispenseNumber = `DSP-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;

    const dispensationResult = await client.query(
      `
      INSERT INTO dispensations (
        id, dispense_number, prescription_id, patient_id, patient_name, visit_id, dispensed_by, dispensed_date, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'completed', $8::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        dispenseNumber,
        prescription.id,
        prescription.patient_id,
        prescription.patient_name,
        prescription.visit_id,
        payload.dispensedBy || null,
        JSON.stringify({})
      ]
    );

    const dispensedItems = [];
    for (const item of requestedItems) {
      const medicineId = await resolveMedicineId(client, item.medicineId);
      if (!medicineId) return { conflict: "medicine_missing", medicineId: item.medicineId };
      const medicineResultRow = await client.query("SELECT * FROM medicine_masters WHERE id = $1", [medicineId]);
      const medicine = medicineResultRow.rows[0];
      if (!medicine) return { conflict: "medicine_missing", medicineId: item.medicineId };
      const quantity = toNumber(item.quantity);

      let batch;
      if (item.batchId) {
        const batchResult = await client.query("SELECT * FROM inventory_batches WHERE id = $1 FOR UPDATE", [item.batchId]);
        batch = batchResult.rows[0];
      } else {
        const batchResult = await client.query(
          `
          SELECT *
          FROM inventory_batches
          WHERE medicine_id = $1 AND quantity_available > 0
          ORDER BY expiry_date ASC NULLS LAST, received_date ASC
          LIMIT 1
          FOR UPDATE
          `,
          [medicineId]
        );
        batch = batchResult.rows[0];
      }

      if (!batch || Number(batch.quantity_available || 0) < quantity) return { conflict: "insufficient_stock", medicineName: medicine.name };

      await client.query("UPDATE inventory_batches SET quantity_available = quantity_available - $2, updated_at = NOW() WHERE id = $1", [batch.id, quantity]);
      await client.query(
        `
        INSERT INTO stock_transactions (
          id, medicine_id, medicine_name, batch_id, type, quantity, reference_number, note, created_by, metadata
        )
        VALUES ($1, $2, $3, $4, 'issue', $5, $6, $7, $8, $9::jsonb)
        RETURNING *
        `,
        [
          payload.createId(),
          medicine.id,
          medicine.name,
          batch.id,
          -quantity,
          prescription.prescription_number,
          `Dispensed against ${prescription.prescription_number}`,
          payload.dispensedBy || null,
          JSON.stringify({ prescriptionId: prescription.id })
        ]
      );
      const itemResult = await client.query(
        `
        INSERT INTO dispensation_items (
          id, dispensation_id, medicine_id, medicine_name, batch_id, batch_number, quantity, unit_price, amount, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        RETURNING *
        `,
        [
          payload.createId(),
          dispensationResult.rows[0].id,
          medicine.id,
          medicine.name,
          batch.id,
          batch.batch_number,
          quantity,
          Number(batch.selling_price || medicine.selling_price || 0),
          quantity * Number(batch.selling_price || medicine.selling_price || 0),
          JSON.stringify({})
        ]
      );
      dispensedItems.push(toCamelDispensationItem(itemResult.rows[0]));
    }

    // Close the prescription only when every prescribed line is fully covered.
    // A part-issue leaves it open so the patient can collect the balance later.
    const issuedAfter = await loadIssuedIndex(client, prescriptionId);
    const fullyDispensed = medicineResult.rows.every((row) => {
      const prescribed = toNumber(row.quantity_dispensed);
      return prescribed <= 0 || issuedQuantityFor(row, issuedAfter) >= prescribed;
    });

    await client.query(
      `
      UPDATE prescriptions
      SET is_dispensed = $2, metadata = metadata || $3::jsonb, updated_at = NOW()
      WHERE id = $1
      `,
      [
        prescription.id,
        fullyDispensed,
        JSON.stringify({
          pharmacyStatus: fullyDispensed ? "completed" : "partial",
          lastDispensedAt: new Date().toISOString()
        })
      ]
    );

    // No bill is raised here. The dispensation itself is the charge record and
    // stays pending until the billing desk pulls it onto the patient's bill.
    return {
      ...(await loadDispensationBundle(client, dispensationResult.rows[0].id)),
      fullyDispensed
    };
  });
}

export async function loadPharmacyMirrors() {
  const [stockTransactions, dispensations] = await Promise.all([
    query("SELECT * FROM stock_transactions ORDER BY transaction_date DESC"),
    listDispensationRecords()
  ]);
  return {
    stockTransactions: stockTransactions.rows.map(toCamelStockTransaction),
    dispensations
  };
}
