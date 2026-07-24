import { withTransaction, query } from "../../config/postgres.js";
import { currentTime, nowIso, toIsoDate, toIsoDateTime, toTime, todayDate } from "../../utils/dateTime.js";
import { toCamelBed, toCamelRoom } from "../rooms/rooms.repository.js";

function toNumber(value) {
  return Number(value || 0);
}

function toCamelNote(row) {
  if (!row) return null;

  return {
    id: row.id,
    admissionId: row.admission_id,
    noteDate: toIsoDateTime(row.note_date),
    category: row.category || "progress",
    note: row.note,
    authorId: row.author_id || "",
    metadata: row.metadata || {}
  };
}

function toCamelVital(row) {
  if (!row) return null;

  return {
    id: row.id,
    admissionId: row.admission_id,
    recordedAt: toIsoDateTime(row.recorded_at),
    bp: row.bp || "",
    pulse: row.pulse,
    temp: row.temp === null || row.temp === undefined ? null : Number(row.temp),
    spo2: row.spo2,
    rr: row.rr,
    weight: row.weight === null || row.weight === undefined ? null : Number(row.weight),
    notes: row.notes || "",
    recordedBy: row.recorded_by || "",
    metadata: row.metadata || {}
  };
}

export function toCamelAdmission(row, notes = [], vitals = []) {
  if (!row) return null;

  return {
    id: row.id,
    admissionNumber: row.admission_number,
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    attendingDoctorId: row.attending_doctor_id || "",
    roomId: row.room_id || "",
    bedId: row.bed_id || "",
    admissionDate: toIsoDate(row.admission_date),
    admissionTime: toTime(row.admission_time),
    admissionSource: row.admission_source || "opd",
    admissionType: row.admission_type || "ipd",
    reasonForAdmission: row.reason_for_admission,
    diagnosis: row.diagnosis || "",
    status: row.status,
    expectedDischargeDate: toIsoDate(row.expected_discharge_date),
    depositAmount: toNumber(row.deposit_amount),
    mlcCase: Boolean(row.mlc_case),
    admittedBy: row.admitted_by || "",
    dischargeSummary: row.discharge_summary || null,
    billId: row.bill_id || "",
    metadata: row.metadata || {},
    notes,
    vitals,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadAdmissionBundle(client, admissionId) {
  const admissionResult = await client.query("SELECT * FROM ipd_admissions WHERE id = $1", [admissionId]);
  const admission = admissionResult.rows[0];
  if (!admission) return null;

  const notesResult = await client.query("SELECT * FROM ipd_notes WHERE admission_id = $1 ORDER BY note_date DESC", [admissionId]);
  const vitalsResult = await client.query("SELECT * FROM ipd_vitals WHERE admission_id = $1 ORDER BY recorded_at DESC", [admissionId]);

  return toCamelAdmission(
    admission,
    notesResult.rows.map(toCamelNote),
    vitalsResult.rows.map(toCamelVital)
  );
}

export async function findAdmissionRecord(admissionId) {
  return withTransaction((client) => loadAdmissionBundle(client, admissionId));
}

export async function listAdmissionRecords(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  if (filters.roomId) {
    params.push(filters.roomId);
    conditions.push(`room_id = $${params.length}`);
  }

  const result = await query(
    `
    SELECT *
    FROM ipd_admissions
    WHERE ${conditions.join(" AND ")}
    ORDER BY admission_date DESC, admission_time DESC, created_at DESC
    `,
    params
  );

  return result.rows.map((row) => toCamelAdmission(row));
}

export async function listNoteRecords(admissionId) {
  const result = await query("SELECT * FROM ipd_notes WHERE admission_id = $1 ORDER BY note_date DESC", [admissionId]);
  return result.rows.map(toCamelNote);
}

export async function listVitalRecords(admissionId) {
  const result = await query("SELECT * FROM ipd_vitals WHERE admission_id = $1 ORDER BY recorded_at DESC", [admissionId]);
  return result.rows.map(toCamelVital);
}

export async function listActiveAdmissionRecords() {
  const result = await query("SELECT * FROM ipd_admissions WHERE status = 'active' ORDER BY admission_date DESC, admission_time DESC");
  return result.rows.map((row) => toCamelAdmission(row));
}

export async function createAdmissionRecord(payload) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["ipd:admission-number"]);

    const roomResult = await client.query("SELECT * FROM rooms WHERE id = $1 AND deleted_at IS NULL", [payload.roomId]);
    const bedResult = await client.query("SELECT * FROM beds WHERE id = $1 FOR UPDATE", [payload.bedId]);
    const activeResult = await client.query("SELECT id FROM ipd_admissions WHERE patient_id = $1 AND status = 'active' LIMIT 1", [payload.patientId]);
    const nextNumberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM ipd_admissions");

    const room = roomResult.rows[0];
    const bed = bedResult.rows[0];

    if (!room) return { conflict: "room_missing" };
    if (!bed) return { conflict: "bed_missing" };
    if (bed.room_id !== room.id) return { conflict: "bed_room_mismatch" };
    if (!["available", "reserved"].includes(bed.status)) return { conflict: "bed_unavailable" };
    if (activeResult.rowCount) return { conflict: "patient_active" };

    const admissionNumber = `IPD-${new Date().getFullYear()}-${String(nextNumberResult.rows[0].next_number).padStart(5, "0")}`;
    const admissionResult = await client.query(
      `
      INSERT INTO ipd_admissions (
        id, admission_number, patient_id, patient_name, attending_doctor_id, room_id, bed_id,
        admission_date, admission_time, admission_source, admission_type, reason_for_admission,
        diagnosis, status, expected_discharge_date, deposit_amount, mlc_case, admitted_by, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, 'active', $14, $15, $16, $17, $18::jsonb
      )
      RETURNING *
      `,
      [
        payload.id,
        admissionNumber,
        payload.patientId,
        payload.patientName,
        payload.attendingDoctorId,
        payload.roomId,
        payload.bedId,
        payload.admissionDate || todayDate(),
        payload.admissionTime || currentTime(),
        payload.admissionSource || "opd",
        payload.admissionType || "ipd",
        payload.reasonForAdmission,
        payload.diagnosis || "",
        payload.expectedDischargeDate || null,
        payload.depositAmount || 0,
        Boolean(payload.mlcCase),
        payload.admittedBy || null,
        JSON.stringify(payload.metadata || {})
      ]
    );

    await client.query(
      `
      UPDATE beds
      SET
        status = 'occupied',
        patient_id = $2,
        patient_name = $3,
        assigned_at = NOW(),
        expected_discharge_date = $4,
        note = $5,
        admission_type = 'ipd',
        assigned_by = $6,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        payload.bedId,
        payload.patientId,
        payload.patientName,
        payload.expectedDischargeDate || null,
        payload.reasonForAdmission || "",
        payload.admittedBy || null
      ]
    );

    await client.query("UPDATE patients SET opd_ipd_number = $2, updated_at = NOW() WHERE id = $1", [payload.patientId, admissionNumber]);

    if (payload.initialNote) {
      await client.query(
        `
        INSERT INTO ipd_notes (id, admission_id, note_date, category, note, author_id, metadata)
        VALUES ($1, $2, NOW(), 'admission', $3, $4, $5::jsonb)
        `,
        [payload.initialNote.id, admissionResult.rows[0].id, payload.initialNote.note, payload.admittedBy || null, JSON.stringify({})]
      );
    }

    return loadAdmissionBundle(client, admissionResult.rows[0].id);
  });
}

export async function addNoteRecord(admissionId, payload) {
  return withTransaction(async (client) => {
    const admissionResult = await client.query("SELECT * FROM ipd_admissions WHERE id = $1 FOR UPDATE", [admissionId]);
    const admission = admissionResult.rows[0];

    if (!admission) return null;
    if (admission.status !== "active") return { conflict: "inactive" };

    await client.query(
      `
      INSERT INTO ipd_notes (id, admission_id, note_date, category, note, author_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        payload.id,
        admissionId,
        payload.noteDate || nowIso(),
        payload.category || "progress",
        payload.note,
        payload.authorId || null,
        JSON.stringify(payload.metadata || {})
      ]
    );

    return loadAdmissionBundle(client, admissionId);
  });
}

export async function addVitalRecord(admissionId, payload) {
  return withTransaction(async (client) => {
    const admissionResult = await client.query("SELECT * FROM ipd_admissions WHERE id = $1 FOR UPDATE", [admissionId]);
    const admission = admissionResult.rows[0];

    if (!admission) return null;
    if (admission.status !== "active") return { conflict: "inactive" };

    await client.query(
      `
      INSERT INTO ipd_vitals (
        id, admission_id, recorded_at, bp, pulse, temp, spo2, rr, weight, notes, recorded_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      `,
      [
        payload.id,
        admissionId,
        payload.recordedAt || nowIso(),
        payload.bp || "",
        payload.pulse || null,
        payload.temp || null,
        payload.spo2 || null,
        payload.rr || null,
        payload.weight || null,
        payload.notes || "",
        payload.recordedBy || null,
        JSON.stringify(payload.metadata || {})
      ]
    );

    return loadAdmissionBundle(client, admissionId);
  });
}

export async function updateAdmissionRecord(admissionId, payload) {
  return withTransaction(async (client) => {
    const admissionResult = await client.query("SELECT * FROM ipd_admissions WHERE id = $1 FOR UPDATE", [admissionId]);
    const admission = admissionResult.rows[0];

    if (!admission) return null;
    if (admission.status !== "active") return { conflict: "inactive" };

    const nextRoomId = payload.roomId ?? admission.room_id;
    const nextBedId = payload.bedId ?? admission.bed_id;
    const changesBed = nextBedId !== admission.bed_id;

    if (changesBed || payload.roomId !== undefined) {
      const nextRoomResult = await client.query("SELECT * FROM rooms WHERE id = $1 AND deleted_at IS NULL", [nextRoomId]);
      const nextBedResult = await client.query("SELECT * FROM beds WHERE id = $1 FOR UPDATE", [nextBedId]);
      const nextRoom = nextRoomResult.rows[0];
      const nextBed = nextBedResult.rows[0];

      if (!nextRoom) return { conflict: "room_missing" };
      if (!nextBed) return { conflict: "bed_missing" };
      if (nextBed.room_id !== nextRoom.id) return { conflict: "bed_room_mismatch" };

      if (changesBed) {
        if (!["available", "reserved"].includes(nextBed.status)) return { conflict: "bed_unavailable" };
        await client.query(
          `
          UPDATE beds
          SET status = 'available', patient_id = NULL, patient_name = '', assigned_at = NULL,
              expected_discharge_date = NULL, note = $2, admission_type = '', assigned_by = NULL, updated_at = NOW()
          WHERE id = $1
          `,
          [admission.bed_id, `Transferred from ${admission.admission_number}`]
        );
      }

      await client.query(
        `
        UPDATE beds
        SET status = 'occupied', patient_id = $2, patient_name = $3, assigned_at = COALESCE(assigned_at, NOW()),
            expected_discharge_date = $4, note = $5, admission_type = 'ipd', assigned_by = $6, updated_at = NOW()
        WHERE id = $1
        `,
        [
          nextBedId,
          admission.patient_id,
          admission.patient_name,
          payload.expectedDischargeDate ?? admission.expected_discharge_date,
          payload.reasonForAdmission ?? admission.reason_for_admission,
          payload.updatedBy || null
        ]
      );
    }

    await client.query(
      `
      UPDATE ipd_admissions
      SET
        attending_doctor_id = $2,
        room_id = $3,
        bed_id = $4,
        admission_source = $5,
        admission_type = $6,
        reason_for_admission = $7,
        diagnosis = $8,
        expected_discharge_date = $9,
        metadata = metadata || $10::jsonb,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        admissionId,
        payload.attendingDoctorId ?? admission.attending_doctor_id,
        nextRoomId,
        nextBedId,
        payload.admissionSource ?? admission.admission_source,
        payload.admissionType ?? admission.admission_type,
        payload.reasonForAdmission ?? admission.reason_for_admission,
        payload.diagnosis ?? admission.diagnosis,
        payload.expectedDischargeDate ?? admission.expected_discharge_date,
        JSON.stringify({ updatedBy: payload.updatedBy || "", updatedAt: nowIso() })
      ]
    );

    return loadAdmissionBundle(client, admissionId);
  });
}

export async function dischargeAdmissionRecord(admissionId, payload) {
  return withTransaction(async (client) => {
    const admissionResult = await client.query("SELECT * FROM ipd_admissions WHERE id = $1 FOR UPDATE", [admissionId]);
    const admission = admissionResult.rows[0];

    if (!admission) return null;
    if (admission.status !== "active") return { conflict: "inactive" };

    await client.query("SELECT * FROM beds WHERE id = $1 FOR UPDATE", [admission.bed_id]);

    await client.query(
      `
      UPDATE ipd_admissions
      SET status = 'discharged', discharge_summary = $2::jsonb, bill_id = $3, updated_at = NOW()
      WHERE id = $1
      `,
      [admissionId, JSON.stringify(payload.dischargeSummary), payload.billId || null]
    );

    await client.query(
      `
      UPDATE beds
      SET status = $2, patient_id = NULL, patient_name = '', assigned_at = NULL,
          expected_discharge_date = NULL, note = $3, admission_type = '', assigned_by = NULL, updated_at = NOW()
      WHERE id = $1
      `,
      [admission.bed_id, payload.nextBedStatus || "cleaning", payload.bedNote || "Discharged from IPD"]
    );

    await client.query(
      `
      INSERT INTO ipd_notes (id, admission_id, note_date, category, note, author_id, metadata)
      VALUES ($1, $2, NOW(), 'discharge_plan', $3, $4, $5::jsonb)
      `,
      [payload.dischargeNoteId, admissionId, payload.dischargeSummary.dischargeNote, payload.dischargedBy || null, JSON.stringify({})]
    );

    return loadAdmissionBundle(client, admissionId);
  });
}

export async function updateAdmissionStatusRecord(admissionId, payload = {}) {
  return withTransaction(async (client) => {
    const admissionResult = await client.query("SELECT * FROM ipd_admissions WHERE id = $1 FOR UPDATE", [admissionId]);
    const admission = admissionResult.rows[0];

    if (!admission) return null;

    if (payload.status === "active" && !["cancelled", "transferred", "discharged"].includes(admission.status)) {
      return { conflict: "invalid_status" };
    }

    if (["cancelled", "transferred"].includes(payload.status) && admission.status !== "active") {
      return { conflict: "inactive" };
    }

    await client.query(
      `
      UPDATE ipd_admissions
      SET status = $2, metadata = metadata || $3::jsonb, updated_at = NOW()
      WHERE id = $1
      `,
      [admissionId, payload.status, JSON.stringify(payload.metadata || {})]
    );

    if (["cancelled", "transferred"].includes(payload.status) && admission.bed_id) {
      await client.query(
        `
        UPDATE beds
        SET status = $2, patient_id = NULL, patient_name = '', assigned_at = NULL,
            expected_discharge_date = NULL, note = $3, admission_type = '', assigned_by = NULL, updated_at = NOW()
        WHERE id = $1
        `,
        [admission.bed_id, payload.nextBedStatus || "cleaning", payload.bedNote || payload.metadata?.workflow?.reason || ""]
      );
    }

    return loadAdmissionBundle(client, admissionId);
  });
}

export async function loadIpdRelatedRecords() {
  const [admissions, notesResult, vitalsResult] = await Promise.all([
    listAdmissionRecords(),
    query("SELECT * FROM ipd_notes ORDER BY note_date DESC"),
    query("SELECT * FROM ipd_vitals ORDER BY recorded_at DESC")
  ]);

  const notesByAdmission = new Map();
  notesResult.rows.map(toCamelNote).forEach((note) => {
    notesByAdmission.set(note.admissionId, [...(notesByAdmission.get(note.admissionId) || []), note]);
  });

  const vitalsByAdmission = new Map();
  vitalsResult.rows.map(toCamelVital).forEach((vital) => {
    vitalsByAdmission.set(vital.admissionId, [...(vitalsByAdmission.get(vital.admissionId) || []), vital]);
  });

  return admissions.map((admission) => ({
    ...admission,
    notes: notesByAdmission.get(admission.id) || [],
    vitals: vitalsByAdmission.get(admission.id) || []
  }));
}

export async function getRoomAndBedSnapshot() {
  const [roomsResult, bedsResult] = await Promise.all([
    query("SELECT * FROM rooms WHERE deleted_at IS NULL AND is_active = true ORDER BY room_number ASC"),
    query(
      `
      SELECT beds.*
      FROM beds
      JOIN rooms ON rooms.id = beds.room_id
      WHERE rooms.deleted_at IS NULL AND rooms.is_active = true
      ORDER BY beds.bed_number ASC
      `
    )
  ]);

  return {
    rooms: roomsResult.rows.map(toCamelRoom),
    beds: bedsResult.rows.map(toCamelBed)
  };
}
