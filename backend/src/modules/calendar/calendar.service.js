import { createError } from "../../utils/errors.js";
import { findPatientById } from "../patients/patients.repository.js";
import { findUserById } from "../users/users.repository.js";
import {
  findCalendarEvents,
  findManualCalendarEventById,
  insertCalendarEvent,
  softDeleteCalendarEvent,
  updateCalendarEventRecord
} from "./calendar.repository.js";

const EVENT_TYPES = new Set(["general", "appointment", "follow_up", "meeting", "task", "reminder", "lab", "panchkarma", "ipd", "maintenance"]);
const STATUSES = new Set(["scheduled", "completed", "cancelled"]);

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultDateRange(query = {}) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    dateFrom: query.dateFrom || first.toISOString().slice(0, 10),
    dateTo: query.dateTo || last.toISOString().slice(0, 10)
  };
}

async function normalizeEventPayload(payload, createdBy = "") {
  const title = String(payload.title || "").trim();
  const startsAt = toDate(payload.startsAt);
  const endsAt = payload.endsAt ? toDate(payload.endsAt) : null;
  const eventType = payload.eventType || "general";
  const status = payload.status || "scheduled";
  const reminderMinutes = payload.reminderMinutes === "" || payload.reminderMinutes === undefined ? null : Number(payload.reminderMinutes);

  if (!title) {
    throw createError("Calendar event title is required.");
  }

  if (!startsAt) {
    throw createError("Calendar event start date/time is required.");
  }

  if (endsAt && endsAt < startsAt) {
    throw createError("Calendar event end time cannot be before the start time.");
  }

  if (!EVENT_TYPES.has(eventType)) {
    throw createError("Calendar event type is invalid.");
  }

  if (!STATUSES.has(status)) {
    throw createError("Calendar event status is invalid.");
  }

  if (reminderMinutes !== null && (!Number.isFinite(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > 10080)) {
    throw createError("Reminder must be between 0 minutes and 7 days.");
  }

  let patientName = String(payload.patientName || "").trim();
  if (payload.patientId) {
    const patient = await findPatientById(payload.patientId);
    if (!patient) {
      throw createError("Selected patient was not found.", 404);
    }
    patientName = patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  }

  if (payload.assignedTo) {
    const user = await findUserById(payload.assignedTo);
    if (!user) {
      throw createError("Assigned user was not found.", 404);
    }
  }

  return {
    title,
    description: String(payload.description || "").trim(),
    eventType,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt ? endsAt.toISOString() : null,
    allDay: Boolean(payload.allDay),
    location: String(payload.location || "").trim(),
    patientId: payload.patientId || null,
    patientName,
    assignedTo: payload.assignedTo || null,
    reminderMinutes,
    status,
    createdBy,
    metadata: {
      ...(payload.metadata || {}),
      reminderEnabled: reminderMinutes !== null
    }
  };
}

export async function listCalendarEvents(query = {}) {
  const range = defaultDateRange(query);
  const dateFrom = toDate(range.dateFrom);
  const dateTo = toDate(range.dateTo);

  if (!dateFrom || !dateTo) {
    throw createError("Valid dateFrom and dateTo are required.");
  }

  return findCalendarEvents({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    eventType: query.eventType || "",
    patientId: query.patientId || "",
    assignedTo: query.assignedTo || ""
  });
}

export async function createCalendarEvent(payload, createdBy) {
  const event = await normalizeEventPayload(payload, createdBy);
  return insertCalendarEvent(event);
}

export async function updateCalendarEvent(id, payload) {
  const existing = await findManualCalendarEventById(id);

  if (!existing) {
    throw createError("Calendar event not found.", 404);
  }

  if (existing.source !== "manual") {
    throw createError("System-generated calendar items must be changed from their original module.");
  }

  const event = await normalizeEventPayload({ ...existing, ...payload });
  return updateCalendarEventRecord(id, event);
}

export async function deleteCalendarEvent(id) {
  const existing = await findManualCalendarEventById(id);

  if (!existing) {
    throw createError("Calendar event not found.", 404);
  }

  if (existing.source !== "manual") {
    throw createError("System-generated calendar items must be cancelled or updated from their original module.");
  }

  await softDeleteCalendarEvent(id);
  return { id };
}
