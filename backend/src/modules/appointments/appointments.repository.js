import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toTime } from "../../utils/dateTime.js";

function toCamelAppointment(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    appointmentNumber: row.appointment_number,
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    patientAge: row.patient_age,
    patientGender: row.patient_gender || "",
    patientMobile: row.patient_mobile || "",
    doctorId: row.doctor_id || "",
    appointmentDate: toIsoDate(row.appointment_date),
    appointmentTime: toTime(row.appointment_time),
    type: row.type,
    department: row.department,
    status: row.status,
    chiefComplaint: row.chief_complaint || "",
    tokenNumber: row.token_number,
    bookedBy: row.booked_by || "",
    source: row.source || "Reception",
    smsSent: Boolean(row.sms_sent),
    statusUpdatedAt: row.metadata?.statusUpdatedAt || "",
    statusUpdatedBy: row.metadata?.statusUpdatedBy || "",
    statusUpdateNote: row.metadata?.statusUpdateNote || "",
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function appointmentParams(appointment) {
  return [
    appointment.id,
    appointment.appointmentNumber,
    appointment.patientId || null,
    appointment.patientName,
    appointment.patientAge || null,
    appointment.patientGender || "",
    appointment.patientMobile || "",
    appointment.doctorId || null,
    appointment.appointmentDate,
    appointment.appointmentTime,
    appointment.type,
    appointment.department,
    appointment.status,
    appointment.chiefComplaint || "",
    appointment.tokenNumber,
    appointment.bookedBy || null,
    appointment.source || "Reception",
    appointment.smsSent || false,
    JSON.stringify(appointment.metadata || {})
  ];
}

export async function listAppointmentRecords(filters = {}) {
  const conditions = ["deleted_at IS NULL"];
  const params = [];

  if (filters.date) {
    params.push(filters.date);
    conditions.push(`appointment_date = $${params.length}`);
  }

  if (filters.doctorId) {
    params.push(filters.doctorId);
    conditions.push(`doctor_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const result = await query(
    `
    SELECT *
    FROM appointments
    WHERE ${conditions.join(" AND ")}
    ORDER BY appointment_date ASC, appointment_time ASC, token_number ASC
    `,
    params
  );

  return result.rows.map(toCamelAppointment);
}

export async function findAppointmentById(id) {
  const result = await query("SELECT * FROM appointments WHERE id = $1 AND deleted_at IS NULL", [id]);
  return toCamelAppointment(result.rows[0]);
}

export async function getBookedTimesForDoctor(date, doctorId, excludeAppointmentId = "") {
  const params = [date, doctorId];
  const excludeClause = excludeAppointmentId ? "AND id <> $3" : "";

  if (excludeAppointmentId) {
    params.push(excludeAppointmentId);
  }

  const result = await query(
    `
    SELECT appointment_time
    FROM appointments
    WHERE appointment_date = $1
      AND doctor_id = $2
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'no_show')
      ${excludeClause}
    ORDER BY appointment_time ASC
    `,
    params
  );

  return result.rows.map((row) => toTime(row.appointment_time));
}

export async function createAppointmentRecord(payload) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["appointments:number"]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`appointments:${payload.appointmentDate}`]);

    const dailyCountResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM appointments
      WHERE appointment_date = $1
        AND deleted_at IS NULL
        AND status <> 'cancelled'
      `,
      [payload.appointmentDate]
    );

    const appointmentCountResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM appointments");
    const tokenNumber = dailyCountResult.rows[0].count + 1;
    const appointmentNumber = `APT-${new Date().getFullYear()}-${String(appointmentCountResult.rows[0].next_number).padStart(5, "0")}`;

    const appointment = {
      ...payload,
      appointmentNumber,
      tokenNumber,
      status: payload.status || "scheduled",
      smsSent: false
    };

    const result = await client.query(
      `
      INSERT INTO appointments (
        id, appointment_number, patient_id, patient_name, patient_age, patient_gender, patient_mobile,
        doctor_id, appointment_date, appointment_time, type, department, status, chief_complaint,
        token_number, booked_by, source, sms_sent, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19::jsonb
      )
      RETURNING *
      `,
      appointmentParams(appointment)
    );

    return toCamelAppointment(result.rows[0]);
  });
}

export async function updateAppointmentRecord(id, payload) {
  const result = await query(
    `
    UPDATE appointments
    SET
      doctor_id = $2,
      appointment_date = $3,
      appointment_time = $4,
      type = $5,
      department = $6,
      chief_complaint = $7,
      source = $8,
      updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      id,
      payload.doctorId || null,
      payload.appointmentDate,
      payload.appointmentTime,
      payload.type,
      payload.department,
      payload.chiefComplaint || "",
      payload.source || "Reception"
    ]
  );

  return toCamelAppointment(result.rows[0]);
}

export async function updateAppointmentStatusRecord(id, status, metadata = {}) {
  const result = await query(
    `
    UPDATE appointments
    SET
      status = $2,
      metadata = metadata || $3::jsonb,
      updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [id, status, JSON.stringify(metadata)]
  );

  return toCamelAppointment(result.rows[0]);
}

export async function cancelAppointmentRecord(id) {
  return updateAppointmentStatusRecord(id, "cancelled", {
    statusUpdatedAt: new Date().toISOString()
  });
}

export async function countAppointmentsForDate(date) {
  const result = await query(
    `
    SELECT COUNT(*)::int AS count
    FROM appointments
    WHERE appointment_date = $1
      AND deleted_at IS NULL
      AND status <> 'cancelled'
    `,
    [date]
  );

  return result.rows[0].count;
}

export async function upsertSeedAppointment(client, appointment) {
  await client.query(
    `
    INSERT INTO appointments (
      id, appointment_number, patient_id, patient_name, patient_age, patient_gender, patient_mobile,
      doctor_id, appointment_date, appointment_time, type, department, status, chief_complaint,
      token_number, booked_by, source, sms_sent, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19::jsonb
    )
    ON CONFLICT (appointment_number) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      patient_age = EXCLUDED.patient_age,
      patient_gender = EXCLUDED.patient_gender,
      patient_mobile = EXCLUDED.patient_mobile,
      doctor_id = EXCLUDED.doctor_id,
      appointment_date = EXCLUDED.appointment_date,
      appointment_time = EXCLUDED.appointment_time,
      type = EXCLUDED.type,
      department = EXCLUDED.department,
      status = EXCLUDED.status,
      chief_complaint = EXCLUDED.chief_complaint,
      token_number = EXCLUDED.token_number,
      source = EXCLUDED.source,
      sms_sent = EXCLUDED.sms_sent,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    `,
    appointmentParams(appointment)
  );
}
