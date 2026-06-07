import { query, withTransaction } from "../../config/postgres.js";
import { createBillRecordWithClient } from "../billing/billing.repository.js";
import { toIsoDate, toIsoDateTime, toTime } from "../../utils/dateTime.js";

function toNumber(value) {
  return Number(value || 0);
}

function toCamelTherapy(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    defaultDurationMinutes: Number(row.default_duration_minutes || 0),
    price: toNumber(row.price),
    roomType: row.room_type,
    requiresRecovery: Boolean(row.requires_recovery),
    description: row.description || "",
    metadata: row.metadata || {}
  };
}

function toCamelMaterial(row) {
  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    medicineId: row.medicine_id || "",
    medicineName: row.medicine_name,
    quantity: toNumber(row.quantity),
    unit: row.unit || "unit",
    notes: row.notes || "",
    metadata: row.metadata || {}
  };
}

function toCamelMedicine(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.medicine_code,
    name: row.name,
    category: row.category || "",
    formulation: row.formulation || "",
    unit: row.unit || "unit",
    price: toNumber(row.selling_price),
    reorderLevel: toNumber(row.reorder_level),
    gstPercentage: toNumber(row.gst_percentage),
    metadata: row.metadata || {}
  };
}

function toCamelSession(row, materialsUsed = []) {
  if (!row) return null;

  return {
    id: row.id,
    scheduleNumber: row.schedule_number,
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    therapyId: row.therapy_id || "",
    therapyName: row.therapy_name,
    recommendedBy: row.recommended_by || "",
    recommendedByName: row.metadata?.recommendedByName || "",
    linkedVisitId: row.linked_visit_id || "",
    prescriptionId: row.prescription_id || "",
    therapyRoomId: row.therapy_room_id || "",
    recoveryBedId: row.recovery_bed_id || "",
    therapistId: row.therapist_id || "",
    therapistName: row.therapist_name,
    scheduledDate: toIsoDate(row.scheduled_date),
    scheduledTime: toTime(row.scheduled_time),
    estimatedDurationMinutes: Number(row.estimated_duration_minutes || 0),
    status: row.status,
    complaint: row.complaint || "",
    preparationNotes: row.preparation_notes || "",
    executionNotes: row.execution_notes || "",
    followUpAdvice: row.follow_up_advice || "",
    materialsUsed,
    sessionStartedAt: toIsoDateTime(row.session_started_at),
    sessionCompletedAt: toIsoDateTime(row.session_completed_at),
    outcome: row.outcome || "",
    billId: row.bill_id || "",
    billedAmount: toNumber(row.billed_amount),
    createdBy: row.created_by || "",
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadSessionBundle(client, sessionId) {
  const sessionResult = await client.query("SELECT * FROM panchkarma_sessions WHERE id = $1", [sessionId]);
  const session = sessionResult.rows[0];
  if (!session) return null;

  const materialResult = await client.query(
    "SELECT * FROM panchkarma_session_materials WHERE session_id = $1 ORDER BY medicine_name ASC",
    [sessionId]
  );

  return toCamelSession(session, materialResult.rows.map(toCamelMaterial));
}

export async function listTherapyRecords() {
  const result = await query(
    "SELECT * FROM panchkarma_therapy_masters WHERE is_active = true ORDER BY name ASC"
  );
  return result.rows.map(toCamelTherapy);
}

export async function listMaterialMedicineRecords() {
  const result = await query(
    `
    SELECT *
    FROM medicine_masters
    WHERE is_active = true
      AND category IN ('External Therapy', 'Ayurvedic Classical')
    ORDER BY name ASC
    `
  );
  return result.rows.map(toCamelMedicine);
}

export async function findTherapyRecord(id) {
  const result = await query("SELECT * FROM panchkarma_therapy_masters WHERE id = $1 AND is_active = true", [id]);
  return toCamelTherapy(result.rows[0]);
}

export async function listSessionRecords(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.scheduledDate) {
    params.push(filters.scheduledDate);
    conditions.push(`scheduled_date = $${params.length}`);
  }
  if (filters.therapistId) {
    params.push(filters.therapistId);
    conditions.push(`therapist_id = $${params.length}`);
  }
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  const sessionResult = await query(
    `
    SELECT *
    FROM panchkarma_sessions
    WHERE ${conditions.join(" AND ")}
    ORDER BY scheduled_date DESC, scheduled_time DESC, created_at DESC
    `,
    params
  );
  const materialResult = await query("SELECT * FROM panchkarma_session_materials ORDER BY medicine_name ASC");
  const materialsBySession = new Map();

  materialResult.rows.map(toCamelMaterial).forEach((material) => {
    materialsBySession.set(material.sessionId, [...(materialsBySession.get(material.sessionId) || []), material]);
  });

  return sessionResult.rows.map((row) => toCamelSession(row, materialsBySession.get(row.id) || []));
}

export async function findSessionRecord(id) {
  return withTransaction((client) => loadSessionBundle(client, id));
}

export async function createSessionRecord(payload) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["panchkarma:schedule-number"]);
    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM panchkarma_sessions");
    const scheduleNumber = `PKS-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;

    const result = await client.query(
      `
      INSERT INTO panchkarma_sessions (
        id, schedule_number, patient_id, patient_name, therapy_id, therapy_name, recommended_by,
        linked_visit_id, prescription_id, therapy_room_id, recovery_bed_id, therapist_id, therapist_name,
        scheduled_date, scheduled_time, estimated_duration_minutes, status, complaint, preparation_notes,
        created_by, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, 'scheduled', $17, $18,
        $19, $20::jsonb
      )
      RETURNING *
      `,
      [
        payload.id,
        scheduleNumber,
        payload.patientId,
        payload.patientName,
        payload.therapyId,
        payload.therapyName,
        payload.recommendedBy || null,
        payload.linkedVisitId || null,
        payload.prescriptionId || null,
        payload.therapyRoomId || null,
        payload.recoveryBedId || null,
        payload.therapistId,
        payload.therapistName,
        payload.scheduledDate,
        payload.scheduledTime,
        payload.estimatedDurationMinutes,
        payload.complaint || "",
        payload.preparationNotes || "",
        payload.createdBy || null,
        JSON.stringify(payload.metadata || {})
      ]
    );

    return toCamelSession(result.rows[0]);
  });
}

export async function startSessionRecord(sessionId, payload = {}) {
  return withTransaction(async (client) => {
    const sessionResult = await client.query("SELECT * FROM panchkarma_sessions WHERE id = $1 FOR UPDATE", [sessionId]);
    const session = sessionResult.rows[0];
    if (!session) return null;
    if (session.status !== "scheduled") return { conflict: "invalid_status" };

    await client.query(
      `
      UPDATE panchkarma_sessions
      SET status = 'in_progress',
          therapist_id = COALESCE($2, therapist_id),
          therapist_name = COALESCE($3, therapist_name),
          session_started_at = COALESCE($4, NOW()),
          execution_notes = COALESCE($5, execution_notes),
          metadata = metadata || $6::jsonb,
          updated_at = NOW()
      WHERE id = $1
      `,
      [
        sessionId,
        payload.therapistId || null,
        payload.therapistName || null,
        payload.sessionStartedAt || null,
        payload.executionNotes || null,
        JSON.stringify({ startedBy: payload.startedBy || "" })
      ]
    );

    return loadSessionBundle(client, sessionId);
  });
}

export async function completeSessionRecord(sessionId, payload) {
  return withTransaction(async (client) => {
    const sessionResult = await client.query("SELECT * FROM panchkarma_sessions WHERE id = $1 FOR UPDATE", [sessionId]);
    const session = sessionResult.rows[0];
    if (!session) return null;
    if (!["scheduled", "in_progress"].includes(session.status)) return { conflict: "invalid_status" };

    const materialsUsed = [];
    for (const item of payload.materialsUsed || []) {
      const medicineResult = await client.query("SELECT * FROM medicine_masters WHERE id = $1 AND is_active = true", [item.medicineId]);
      const medicine = medicineResult.rows[0];
      if (!medicine) return { conflict: "medicine_missing", medicineId: item.medicineId };

      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) return { conflict: "invalid_quantity", medicineName: medicine.name };

      const batchResult = await client.query(
        `
        SELECT *
        FROM inventory_batches
        WHERE medicine_id = $1 AND quantity_available > 0
        ORDER BY expiry_date ASC NULLS LAST, received_date ASC
        FOR UPDATE
        `,
        [medicine.id]
      );
      const totalAvailable = batchResult.rows.reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0);
      if (totalAvailable < quantity) return { conflict: "insufficient_stock", medicineName: medicine.name };

      let pendingQuantity = quantity;
      for (const batch of batchResult.rows) {
        if (pendingQuantity <= 0) break;

        const issued = Math.min(Number(batch.quantity_available || 0), pendingQuantity);
        pendingQuantity -= issued;

        await client.query(
          "UPDATE inventory_batches SET quantity_available = quantity_available - $2, updated_at = NOW() WHERE id = $1",
          [batch.id, issued]
        );
        await client.query(
          `
          INSERT INTO stock_transactions (
            id, medicine_id, medicine_name, batch_id, type, quantity, reference_number, note, created_by, metadata
          )
          VALUES ($1, $2, $3, $4, 'therapy_issue', $5, $6, $7, $8, $9::jsonb)
          `,
          [
            payload.createId(),
            medicine.id,
            medicine.name,
            batch.id,
            -issued,
            session.schedule_number,
            item.notes || "Panchkarma therapy consumption",
            payload.completedBy || null,
            JSON.stringify({ sessionId })
          ]
        );
      }

      const materialResult = await client.query(
        `
        INSERT INTO panchkarma_session_materials (
          id, session_id, medicine_id, medicine_name, quantity, unit, notes, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING *
        `,
        [
          payload.createId(),
          sessionId,
          medicine.id,
          medicine.name,
          quantity,
          medicine.unit || "unit",
          item.notes || "",
          JSON.stringify({})
        ]
      );
      materialsUsed.push(toCamelMaterial(materialResult.rows[0]));
    }

    let bill = null;
    if (payload.bill) {
      bill = await createBillRecordWithClient(client, payload.bill);
    }

    await client.query(
      `
      UPDATE panchkarma_sessions
      SET status = 'completed',
          session_started_at = COALESCE(session_started_at, NOW()),
          session_completed_at = COALESCE($2, NOW()),
          execution_notes = $3,
          follow_up_advice = $4,
          outcome = $5,
          bill_id = $6,
          billed_amount = $7,
          metadata = metadata || $8::jsonb,
          updated_at = NOW()
      WHERE id = $1
      `,
      [
        sessionId,
        payload.sessionCompletedAt || null,
        payload.executionNotes || session.execution_notes || "",
        payload.followUpAdvice || "",
        payload.outcome,
        bill?.id || session.bill_id || null,
        bill?.totalAmount || payload.billedAmount || 0,
        JSON.stringify({ completedBy: payload.completedBy || "" })
      ]
    );

    return {
      session: await loadSessionBundle(client, sessionId),
      bill,
      materialsUsed
    };
  });
}

export async function updateSessionStatusRecord(sessionId, payload = {}) {
  return withTransaction(async (client) => {
    const sessionResult = await client.query("SELECT * FROM panchkarma_sessions WHERE id = $1 FOR UPDATE", [sessionId]);
    const session = sessionResult.rows[0];

    if (!session) return null;
    if (payload.status === "cancelled" && session.status === "completed") return { conflict: "completed" };
    if (payload.status === "scheduled" && !["cancelled", "in_progress"].includes(session.status)) return { conflict: "invalid_status" };

    await client.query(
      `
      UPDATE panchkarma_sessions
      SET status = $2, metadata = metadata || $3::jsonb, updated_at = NOW()
      WHERE id = $1
      `,
      [sessionId, payload.status, JSON.stringify(payload.metadata || {})]
    );

    return loadSessionBundle(client, sessionId);
  });
}

export async function loadPanchkarmaMirrors() {
  const [therapies, sessions] = await Promise.all([
    listTherapyRecords(),
    listSessionRecords()
  ]);

  return { therapies, sessions };
}
