import { query } from "../../config/postgres.js";

function toIsoDateTime(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toCamelCalendarEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    eventType: row.event_type || "general",
    startsAt: toIsoDateTime(row.starts_at),
    endsAt: toIsoDateTime(row.ends_at),
    allDay: Boolean(row.all_day),
    location: row.location || "",
    patientId: row.patient_id || "",
    patientName: row.patient_name || "",
    assignedTo: row.assigned_to || "",
    assignedToName: row.assigned_to_name || "",
    reminderMinutes: row.reminder_minutes ?? "",
    status: row.status || "scheduled",
    source: row.source || "manual",
    sourceId: row.source_id || "",
    createdBy: row.created_by || "",
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function findCalendarEvents({ dateFrom, dateTo, eventType = "", patientId = "", assignedTo = "" }) {
  const params = [dateFrom, dateTo];
  const manualConditions = ["e.deleted_at IS NULL", "e.starts_at < ($2::date + INTERVAL '1 day')", "COALESCE(e.ends_at, e.starts_at) >= $1::date"];
  const syntheticConditions = ["starts_at < ($2::date + INTERVAL '1 day')", "COALESCE(ends_at, starts_at) >= $1::date"];

  if (eventType) {
    params.push(eventType);
    manualConditions.push(`e.event_type = $${params.length}`);
    syntheticConditions.push(`event_type = $${params.length}`);
  }

  if (patientId) {
    params.push(patientId);
    manualConditions.push(`e.patient_id = $${params.length}`);
    syntheticConditions.push(`patient_id = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    manualConditions.push(`e.assigned_to = $${params.length}`);
    syntheticConditions.push(`assigned_to = $${params.length}`);
  }

  const result = await query(
    `
    WITH synthetic_events AS (
      SELECT
        a.id,
        CONCAT('Appointment: ', a.patient_name) AS title,
        a.chief_complaint AS description,
        'appointment' AS event_type,
        (a.appointment_date::text || ' ' || a.appointment_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata' AS starts_at,
        ((a.appointment_date::text || ' ' || a.appointment_time::text)::timestamp + INTERVAL '30 minutes') AT TIME ZONE 'Asia/Kolkata' AS ends_at,
        false AS all_day,
        a.department AS location,
        a.patient_id,
        a.patient_name,
        a.doctor_id AS assigned_to,
        u.full_name AS assigned_to_name,
        30 AS reminder_minutes,
        a.status,
        'appointment' AS source,
        a.id AS source_id,
        a.booked_by AS created_by,
        a.metadata,
        a.created_at,
        a.updated_at
      FROM appointments a
      LEFT JOIN users u ON u.id = a.doctor_id
      WHERE a.deleted_at IS NULL AND a.status NOT IN ('cancelled', 'no_show')

      UNION ALL

      SELECT
        p.id,
        CONCAT('Panchkarma: ', p.therapy_name) AS title,
        COALESCE(NULLIF(p.complaint, ''), p.preparation_notes) AS description,
        'panchkarma' AS event_type,
        (p.scheduled_date::text || ' ' || p.scheduled_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata' AS starts_at,
        ((p.scheduled_date::text || ' ' || p.scheduled_time::text)::timestamp + (p.estimated_duration_minutes || ' minutes')::interval) AT TIME ZONE 'Asia/Kolkata' AS ends_at,
        false AS all_day,
        p.therapy_name AS location,
        p.patient_id,
        p.patient_name,
        p.therapist_id AS assigned_to,
        p.therapist_name AS assigned_to_name,
        60 AS reminder_minutes,
        p.status,
        'panchkarma' AS source,
        p.id AS source_id,
        p.created_by,
        p.metadata,
        p.created_at,
        p.updated_at
      FROM panchkarma_sessions p
      WHERE p.status != 'cancelled'

      UNION ALL

      SELECT
        l.id,
        CONCAT('Lab: ', l.order_number) AS title,
        CONCAT('Lab order for ', l.patient_name) AS description,
        'lab' AS event_type,
        l.order_date::timestamp AT TIME ZONE 'Asia/Kolkata' AS starts_at,
        (l.order_date::timestamp + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata' AS ends_at,
        true AS all_day,
        'Laboratory' AS location,
        l.patient_id,
        l.patient_name,
        l.ordered_by AS assigned_to,
        u.full_name AS assigned_to_name,
        120 AS reminder_minutes,
        l.status,
        'lab_order' AS source,
        l.id AS source_id,
        l.ordered_by AS created_by,
        l.metadata,
        l.created_at,
        l.updated_at
      FROM lab_orders l
      LEFT JOIN users u ON u.id = l.ordered_by
      WHERE l.status != 'cancelled'
    )
    SELECT
      e.id, e.title, e.description, e.event_type, e.starts_at, e.ends_at, e.all_day, e.location,
      e.patient_id, e.patient_name, e.assigned_to, u.full_name AS assigned_to_name, e.reminder_minutes,
      e.status, e.source, e.source_id, e.created_by, e.metadata, e.created_at, e.updated_at
    FROM calendar_events e
    LEFT JOIN users u ON u.id = e.assigned_to
    WHERE ${manualConditions.join(" AND ")}

    UNION ALL

    SELECT *
    FROM synthetic_events
    WHERE ${syntheticConditions.join(" AND ")}
    ORDER BY starts_at ASC, title ASC
    `,
    params
  );

  return result.rows.map(toCamelCalendarEvent);
}

export async function findManualCalendarEventById(id) {
  const result = await query(
    `
    SELECT e.*, u.full_name AS assigned_to_name
    FROM calendar_events e
    LEFT JOIN users u ON u.id = e.assigned_to
    WHERE e.id = $1 AND e.deleted_at IS NULL
    `,
    [id]
  );

  return toCamelCalendarEvent(result.rows[0]);
}

export async function insertCalendarEvent(event) {
  const result = await query(
    `
    INSERT INTO calendar_events (
      title, description, event_type, starts_at, ends_at, all_day, location, patient_id, patient_name,
      assigned_to, reminder_minutes, status, created_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
    RETURNING *
    `,
    [
      event.title,
      event.description || "",
      event.eventType || "general",
      event.startsAt,
      event.endsAt || null,
      Boolean(event.allDay),
      event.location || "",
      event.patientId || null,
      event.patientName || "",
      event.assignedTo || null,
      event.reminderMinutes || null,
      event.status || "scheduled",
      event.createdBy || null,
      JSON.stringify(event.metadata || {})
    ]
  );

  return toCamelCalendarEvent(result.rows[0]);
}

export async function updateCalendarEventRecord(id, event) {
  const result = await query(
    `
    UPDATE calendar_events
    SET
      title = $2,
      description = $3,
      event_type = $4,
      starts_at = $5,
      ends_at = $6,
      all_day = $7,
      location = $8,
      patient_id = $9,
      patient_name = $10,
      assigned_to = $11,
      reminder_minutes = $12,
      status = $13,
      metadata = $14::jsonb,
      updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      id,
      event.title,
      event.description || "",
      event.eventType || "general",
      event.startsAt,
      event.endsAt || null,
      Boolean(event.allDay),
      event.location || "",
      event.patientId || null,
      event.patientName || "",
      event.assignedTo || null,
      event.reminderMinutes || null,
      event.status || "scheduled",
      JSON.stringify(event.metadata || {})
    ]
  );

  return toCamelCalendarEvent(result.rows[0]);
}

export async function softDeleteCalendarEvent(id) {
  const result = await query(
    "UPDATE calendar_events SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [id]
  );
  return result.rowCount > 0;
}
