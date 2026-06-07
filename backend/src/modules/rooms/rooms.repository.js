import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";

function toNumber(value) {
  return Number(value || 0);
}

export function toCamelRoom(row) {
  if (!row) return null;

  return {
    id: row.id,
    roomNumber: row.room_number,
    ward: row.ward,
    roomType: row.room_type,
    floor: row.floor || "",
    chargePerDay: toNumber(row.daily_rate),
    nursingStation: row.nursing_station || "",
    notes: row.notes || "",
    isActive: row.is_active !== false,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toCamelBed(row) {
  if (!row) return null;

  return {
    id: row.id,
    roomId: row.room_id,
    bedNumber: row.bed_number,
    bedLabel: row.bed_label || "",
    status: row.status,
    patientId: row.patient_id || null,
    patientName: row.patient_name || "",
    assignedAt: toIsoDateTime(row.assigned_at),
    expectedDischargeDate: toIsoDate(row.expected_discharge_date),
    note: row.note || "",
    admissionType: row.admission_type || "",
    assignedBy: row.assigned_by || "",
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listRoomRecords() {
  const result = await query(
    `
    SELECT *
    FROM rooms
    WHERE deleted_at IS NULL AND is_active = true
    ORDER BY room_number ASC
    `
  );

  return result.rows.map(toCamelRoom);
}

export async function listBedRecords() {
  const result = await query("SELECT * FROM beds ORDER BY bed_number ASC");
  return result.rows.map(toCamelBed);
}

export async function findRoomRecord(roomId) {
  const result = await query("SELECT * FROM rooms WHERE id = $1 AND deleted_at IS NULL", [roomId]);
  return toCamelRoom(result.rows[0]);
}

export async function findBedRecord(bedId) {
  const result = await query("SELECT * FROM beds WHERE id = $1", [bedId]);
  return toCamelBed(result.rows[0]);
}

export async function roomNumberExists(roomNumber) {
  const result = await query("SELECT 1 FROM rooms WHERE room_number = $1 AND deleted_at IS NULL LIMIT 1", [roomNumber]);
  return result.rowCount > 0;
}

export async function createRoomRecord(payload) {
  return withTransaction(async (client) => {
    const roomResult = await client.query(
      `
      INSERT INTO rooms (
        id, room_number, room_type, floor, ward, total_beds, daily_rate, nursing_station, notes, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        payload.roomNumber,
        payload.roomType,
        payload.floor,
        payload.ward,
        payload.beds.length,
        payload.chargePerDay,
        payload.nursingStation,
        payload.notes,
        JSON.stringify(payload.metadata || {})
      ]
    );

    const beds = [];
    for (const bed of payload.beds) {
      const bedResult = await client.query(
        `
        INSERT INTO beds (
          id, room_id, bed_number, bed_label, status, patient_id, patient_name,
          assigned_at, expected_discharge_date, note, admission_type, assigned_by, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        RETURNING *
        `,
        [
          bed.id,
          roomResult.rows[0].id,
          bed.bedNumber,
          bed.bedLabel,
          bed.status || "available",
          bed.patientId || null,
          bed.patientName || "",
          bed.assignedAt || null,
          bed.expectedDischargeDate || null,
          bed.note || "",
          bed.admissionType || "",
          bed.assignedBy || null,
          JSON.stringify(bed.metadata || {})
        ]
      );
      beds.push(toCamelBed(bedResult.rows[0]));
    }

    return {
      item: toCamelRoom(roomResult.rows[0]),
      beds
    };
  });
}

export async function assignBedRecord(roomId, bedId, payload) {
  return withTransaction(async (client) => {
    const bedResult = await client.query(
      "SELECT * FROM beds WHERE id = $1 AND room_id = $2 FOR UPDATE",
      [bedId, roomId]
    );
    const bed = bedResult.rows[0];

    if (!bed) return null;
    if (!["available", "reserved"].includes(bed.status)) {
      return { conflict: "unassignable" };
    }

    const existingResult = await client.query(
      `
      SELECT id
      FROM beds
      WHERE patient_id = $1 AND status = 'occupied' AND id <> $2
      LIMIT 1
      `,
      [payload.patientId, bedId]
    );

    if (existingResult.rowCount) {
      return { conflict: "patient_occupied" };
    }

    const updated = await client.query(
      `
      UPDATE beds
      SET
        status = 'occupied',
        patient_id = $3,
        patient_name = $4,
        assigned_at = NOW(),
        expected_discharge_date = $5,
        note = $6,
        admission_type = $7,
        assigned_by = $8,
        updated_at = NOW()
      WHERE id = $1 AND room_id = $2
      RETURNING *
      `,
      [
        bedId,
        roomId,
        payload.patientId,
        payload.patientName,
        payload.expectedDischargeDate || null,
        payload.note || "",
        payload.admissionType || "observation",
        payload.assignedBy || null
      ]
    );

    return toCamelBed(updated.rows[0]);
  });
}

export async function dischargeBedRecord(roomId, bedId, payload = {}) {
  return withTransaction(async (client) => {
    const bedResult = await client.query(
      "SELECT * FROM beds WHERE id = $1 AND room_id = $2 FOR UPDATE",
      [bedId, roomId]
    );
    const bed = bedResult.rows[0];

    if (!bed) return null;
    if (bed.status !== "occupied") {
      return { conflict: "not_occupied" };
    }

    const updated = await client.query(
      `
      UPDATE beds
      SET
        status = $3,
        patient_id = NULL,
        patient_name = '',
        assigned_at = NULL,
        expected_discharge_date = NULL,
        note = $4,
        admission_type = '',
        assigned_by = NULL,
        updated_at = NOW()
      WHERE id = $1 AND room_id = $2
      RETURNING *
      `,
      [bedId, roomId, payload.nextStatus || "cleaning", payload.note || ""]
    );

    return toCamelBed(updated.rows[0]);
  });
}

export async function updateBedStatusRecord(roomId, bedId, payload = {}) {
  const result = await query(
    `
    UPDATE beds
    SET
      status = $3,
      patient_id = CASE WHEN $3 IN ('available', 'reserved', 'cleaning', 'maintenance') THEN NULL ELSE patient_id END,
      patient_name = CASE WHEN $3 IN ('available', 'reserved', 'cleaning', 'maintenance') THEN '' ELSE patient_name END,
      assigned_at = CASE WHEN $3 IN ('available', 'reserved', 'cleaning', 'maintenance') THEN NULL ELSE assigned_at END,
      expected_discharge_date = CASE WHEN $3 IN ('available', 'reserved', 'cleaning', 'maintenance') THEN NULL ELSE expected_discharge_date END,
      note = $4,
      admission_type = CASE WHEN $3 IN ('available', 'reserved', 'cleaning', 'maintenance') THEN '' ELSE admission_type END,
      assigned_by = CASE WHEN $3 IN ('available', 'reserved', 'cleaning', 'maintenance') THEN NULL ELSE assigned_by END,
      metadata = metadata || $5::jsonb,
      updated_at = NOW()
    WHERE id = $1 AND room_id = $2
    RETURNING *
    `,
    [bedId, roomId, payload.status, payload.note || "", JSON.stringify(payload.metadata || {})]
  );

  return toCamelBed(result.rows[0]);
}
