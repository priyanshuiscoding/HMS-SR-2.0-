import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";
import { resolveMedicineId, toCamelBatch, toCamelMedicine, toCamelStockTransaction } from "../inventory/inventory.repository.js";

function toNumber(value) {
  return Number(value || 0);
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

function toCamelPrescription(row, medicines = [], dispensation = null) {
  if (!row) return null;
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
    medicines,
    dispensation,
    metadata: row.metadata || {}
  };
}

function toCamelPrescriptionMedicine(row) {
  return {
    id: row.id,
    medicineId: row.metadata?.sourceMedicineId || row.medicine_id || "",
    medicineName: row.medicine_name,
    dose: row.dose || "",
    frequency: row.frequency || "",
    route: row.route || "",
    timing: row.timing || "",
    durationDays: Number(row.duration_days || 0),
    quantityDispensed: Number(row.quantity_dispensed || 0),
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

export async function listPrescriptionQueueRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.status === "pending") conditions.push("p.is_dispensed = false");
  if (filters.status === "completed") conditions.push("p.is_dispensed = true");
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`p.patient_id = $${params.length}`);
  }

  const prescriptionResult = await query(
    `
    SELECT p.*
    FROM prescriptions p
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.prescription_date DESC, p.created_at DESC
    `,
    params
  );
  const medicineResult = await query("SELECT * FROM prescription_medicines ORDER BY medicine_name ASC");
  const dispensationResult = await query("SELECT * FROM dispensations ORDER BY dispensed_date DESC");
  const itemResult = await query("SELECT * FROM dispensation_items ORDER BY medicine_name ASC");
  const medicinesByPrescription = new Map();
  const itemsByDispensation = new Map();
  const dispensationByPrescription = new Map();

  for (const row of medicineResult.rows) {
    const medicine = toCamelPrescriptionMedicine(row);
    medicinesByPrescription.set(row.prescription_id, [...(medicinesByPrescription.get(row.prescription_id) || []), medicine]);
  }
  itemResult.rows.map(toCamelDispensationItem).forEach((item) => {
    itemsByDispensation.set(item.dispensationId, [...(itemsByDispensation.get(item.dispensationId) || []), item]);
  });
  dispensationResult.rows.forEach((row) => {
    dispensationByPrescription.set(row.prescription_id, toCamelDispensation(row, itemsByDispensation.get(row.id) || []));
  });

  return prescriptionResult.rows.map((row) =>
    toCamelPrescription(row, medicinesByPrescription.get(row.id) || [], dispensationByPrescription.get(row.id) || null)
  );
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
    if (prescription.is_dispensed) return { conflict: "already_dispensed" };

    const medicineResult = await client.query("SELECT * FROM prescription_medicines WHERE prescription_id = $1 ORDER BY medicine_name ASC", [prescriptionId]);
    const requestedItems = payload.items?.length
      ? payload.items
      : medicineResult.rows.map((item) => ({ medicineId: item.metadata?.sourceMedicineId || item.medicine_id, quantity: item.quantity_dispensed || 0 }));

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
      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) return { conflict: "invalid_quantity", medicineName: medicine.name };

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

    await client.query("UPDATE prescriptions SET is_dispensed = true, updated_at = NOW() WHERE id = $1", [prescription.id]);
    return toCamelDispensation(dispensationResult.rows[0], dispensedItems);
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
