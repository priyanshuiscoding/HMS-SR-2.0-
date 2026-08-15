import { db, getDepartments, createId } from "../../data/store.js";
import { consultationCharge, opdOperatingHours } from "../../config/hospitalData.js";
import { createError } from "../../utils/errors.js";
import { getPatientById } from "../patients/patients.service.js";
import { listDoctors } from "../users/users.service.js";
import { appendWorkflowMetadata, workflowMetadata } from "../../utils/workflow.js";
import {
  cancelAppointmentRecord,
  countAppointmentsForDate,
  createAppointmentRecord,
  findAppointmentById,
  getBookedTimesForDoctor,
  listAppointmentRecords,
  updateAppointmentMetadataRecord,
  updateAppointmentRecord,
  updateAppointmentStatusRecord
} from "./appointments.repository.js";

const MAX_PATIENTS_PER_DAY = 100;
const SLOT_DURATION_MINUTES = 10;
const CONSULTATION_FEE = consultationCharge;
const BOOKING_TYPES = ["new", "follow_up"];
const BOOKING_SOURCES = ["Website", "Reception", "Call", "WhatsApp", "Walk-in"];
const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
const PAYMENT_MODES = ["cash", "upi", "card", "bank_transfer", "other"];
const STATUS_TRANSITIONS = {
  scheduled: ["confirmed", "in_progress", "completed", "cancelled", "no_show"],
  confirmed: ["in_progress", "completed", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: []
};
const QUEUE_ACTIONS = ["call", "hold", "requeue", "no_show", "cancel", "complete"];
const OPD_SCHEDULE = {
  weekday: opdOperatingHours.mondayToSaturday,
  sundayAndHoliday: opdOperatingHours.sunday
};
const OPD_HOLIDAYS = [];

function toMinutes(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw createError("Invalid appointment time.");
  }
  return (hours * 60) + minutes;
}

function toTimeString(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function normalizeDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError("Invalid appointment date.");
  }
  return value;
}

function getDateParts(date) {
  const [year, month, day] = normalizeDate(date).split("-").map(Number);
  return { year, month, day };
}

function isSunday(date) {
  const { year, month, day } = getDateParts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function isHoliday(date) {
  return OPD_HOLIDAYS.includes(date);
}

function getScheduleSessionsForDate(date) {
  return isSunday(date) || isHoliday(date) ? OPD_SCHEDULE.sundayAndHoliday : OPD_SCHEDULE.weekday;
}

function getSlotsForDate(date) {
  return getScheduleSessionsForDate(date).flatMap((session) => {
    const startMinutes = toMinutes(session.start);
    const endMinutes = toMinutes(session.end);
    const slots = [];

    for (let minute = startMinutes; minute < endMinutes; minute += SLOT_DURATION_MINUTES) {
      slots.push(toTimeString(minute));
    }

    return slots;
  });
}

function isPastDate(date) {
  const today = new Date().toISOString().slice(0, 10);
  return normalizeDate(date) < today;
}

function calculatePatientAge(patient) {
  if (Number.isFinite(Number(patient.ageYears)) && Number(patient.ageYears) > 0) {
    return Number(patient.ageYears);
  }

  if (!patient.dateOfBirth) {
    return null;
  }

  const [birthYear, birthMonth, birthDay] = patient.dateOfBirth.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const monthDiff = (now.getMonth() + 1) - birthMonth;
  const beforeBirthday = monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDay);

  if (beforeBirthday) {
    age -= 1;
  }

  return age > 0 ? age : null;
}

function normalizeType(type = "new") {
  if (!BOOKING_TYPES.includes(type)) {
    throw createError("Emergency override booking is not allowed. Use new or follow-up type.");
  }
  return type;
}

function normalizeStatus(status) {
  const nextStatus = String(status || "").trim().toLowerCase();

  if (!APPOINTMENT_STATUSES.includes(nextStatus)) {
    throw createError("Invalid appointment status.");
  }

  return nextStatus;
}

function normalizePaymentMode(value = "cash") {
  const mode = String(value || "").trim().toLowerCase();
  if (PAYMENT_MODES.includes(mode)) {
    return mode;
  }
  throw createError("Invalid consultation payment mode.");
}

// Booking only records what the consultation will cost. Nothing is collected
// here - the fee is billed and paid at the billing desk with the rest of the
// visit, so this no longer claims a payment that never reached accounts.
function normalizeConsultationPayment(payload = {}) {
  const amount = Number(payload.consultationFeeAmount ?? payload.paymentAmount ?? CONSULTATION_FEE);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createError("Consultation fee must be zero or greater.");
  }

  return {
    status: "billable",
    amount,
    preferredPaymentMode: normalizePaymentMode(payload.paymentMode || "cash"),
    referenceNumber: String(payload.paymentReference || "").trim(),
    recordedAt: new Date().toISOString()
  };
}

function ensureValidTimeForDate(date, time) {
  const slots = getSlotsForDate(date);
  if (!slots.includes(time)) {
    throw createError("Selected time is outside OPD timings for the chosen date.");
  }
}

async function validateDailyCapacity(date) {
  const dailyCount = await countAppointmentsForDate(date);

  if (dailyCount >= MAX_PATIENTS_PER_DAY) {
    throw createError(`Daily booking limit reached (${MAX_PATIENTS_PER_DAY} patients).`);
  }
}

function syncAppointmentMirror(appointment) {
  const index = db.appointments.findIndex((entry) => entry.id === appointment.id);

  if (index >= 0) {
    db.appointments[index] = appointment;
    return;
  }

  db.appointments.push(appointment);
}

export async function listAppointments(query = {}) {
  return listAppointmentRecords(query);
}

export async function getAppointmentById(id) {
  const item = await findAppointmentById(id);

  if (!item) {
    throw createError("Appointment not found.", 404);
  }

  return item;
}

export async function createAppointment(payload, bookedBy) {
  if (!payload.patientId) {
    throw createError("Patient is not registered. Please register the patient first, then book the appointment.");
  }

  if (!payload.doctorId || !payload.appointmentDate || !payload.appointmentTime || !payload.department) {
    throw createError("Doctor, appointment date, time, and department are required.");
  }

  const appointmentDate = normalizeDate(payload.appointmentDate);
  const appointmentTime = payload.appointmentTime;

  if (isPastDate(appointmentDate)) {
    throw createError("Same-day and advance booking are allowed. Past-date booking is not allowed.");
  }

  ensureValidTimeForDate(appointmentDate, appointmentTime);
  normalizeType(payload.type);

  const bookedTimes = await getBookedTimesForDoctor(appointmentDate, payload.doctorId);
  if (bookedTimes.includes(appointmentTime)) {
    throw createError("This slot is already booked for the selected doctor.");
  }

  await validateDailyCapacity(appointmentDate);

  const patient = await getPatientById(payload.patientId);
  const patientId = patient.id;
  const patientName = `${patient.firstName} ${patient.lastName}`.trim();
  const patientAge = calculatePatientAge(patient);
  const patientGender = patient.gender || "";
  const patientMobile = patient.phone || "";
  const patientAddress = patient.address || [patient.houseStreet, patient.areaVillage, patient.cityDistrict || patient.city]
    .filter(Boolean)
    .join(", ");

  const item = {
    id: createId(),
    patientId,
    patientName: String(patientName).trim(),
    patientAge: patientAge ? Number(patientAge) : null,
    patientGender: patientGender || "",
    patientMobile: String(patientMobile || "").trim(),
    doctorId: payload.doctorId,
    appointmentDate,
    appointmentTime,
    type: normalizeType(payload.type || "new"),
    department: payload.department,
    status: "confirmed",
    chiefComplaint: String(payload.chiefComplaint || "").trim(),
    bookedBy,
    source: BOOKING_SOURCES.includes(payload.source) ? payload.source : "Reception",
    smsSent: false,
    metadata: {
      consultationPayment: normalizeConsultationPayment(payload),
      ...(patientAddress ? { patientAddress } : {})
    }
  };

  try {
    const savedAppointment = await createAppointmentRecord(item);
    syncAppointmentMirror(savedAppointment);
    return savedAppointment;
  } catch (error) {
    if (error.code === "23505") {
      throw createError("This slot is already booked for the selected doctor.");
    }

    throw error;
  }
}

export async function updateAppointment(id, payload) {
  const item = await getAppointmentById(id);

  if (payload.status !== undefined) {
    throw createError("Use the dedicated status endpoint to update appointment status.");
  }

  const nextDate = payload.appointmentDate ?? item.appointmentDate;
  const nextTime = payload.appointmentTime ?? item.appointmentTime;
  const nextDoctorId = payload.doctorId ?? item.doctorId;

  normalizeDate(nextDate);
  ensureValidTimeForDate(nextDate, nextTime);
  normalizeType(payload.type ?? item.type);

  if (
    (payload.appointmentDate || payload.doctorId || payload.appointmentTime) &&
    (await getBookedTimesForDoctor(nextDate, nextDoctorId, id)).includes(nextTime)
  ) {
    throw createError("The updated slot conflicts with an existing booking.");
  }

  const nextAppointment = {
    ...item,
    appointmentDate: nextDate,
    appointmentTime: nextTime,
    doctorId: nextDoctorId,
    type: normalizeType(payload.type ?? item.type),
    department: payload.department ?? item.department,
    chiefComplaint: payload.chiefComplaint ?? item.chiefComplaint,
    source: BOOKING_SOURCES.includes(payload.source) ? payload.source : (payload.source ?? item.source)
  };

  try {
    const savedAppointment = await updateAppointmentRecord(id, nextAppointment);
    syncAppointmentMirror(savedAppointment);
    return savedAppointment;
  } catch (error) {
    if (error.code === "23505") {
      throw createError("The updated slot conflicts with an existing booking.");
    }

    throw error;
  }
}

export async function updateAppointmentStatus(id, payload = {}, actor = {}) {
  const item = await getAppointmentById(id);
  const nextStatus = normalizeStatus(payload.status);
  const currentStatus = normalizeStatus(item.status);

  if (currentStatus === nextStatus) {
    return item;
  }

  const allowedNext = STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedNext.includes(nextStatus)) {
    throw createError(`Cannot move appointment from ${currentStatus} to ${nextStatus}.`);
  }

  const savedAppointment = await updateAppointmentStatusRecord(id, nextStatus, {
    statusUpdatedAt: new Date().toISOString(),
    statusUpdatedBy: actor.sub || "",
    statusUpdateNote: String(payload.note || "").trim(),
    ...workflowMetadata(payload, actor, `appointment:${nextStatus}`)
  });
  syncAppointmentMirror(savedAppointment);
  return savedAppointment;
}

export async function updateAppointmentQueueAction(id, payload = {}, actor = {}) {
  const item = await getAppointmentById(id);
  const action = String(payload.action || "").trim().toLowerCase();

  if (!QUEUE_ACTIONS.includes(action)) {
    throw createError("Invalid queue action.");
  }

  if (["cancelled", "no_show", "completed"].includes(item.status) && action !== "requeue") {
    throw createError("This appointment is already closed.");
  }

  const metadata = appendWorkflowMetadata(item.metadata, payload, actor, `appointment:${action}`);
  const queueStatusByAction = {
    call: "called",
    hold: "hold",
    requeue: "waiting",
    no_show: "closed",
    cancel: "closed",
    complete: "closed"
  };

  metadata.queueStatus = queueStatusByAction[action];
  metadata.statusUpdatedAt = new Date().toISOString();
  metadata.statusUpdatedBy = actor.sub || "";
  metadata.statusUpdateNote = metadata.workflow.reason;

  if (action === "requeue" && ["cancelled", "no_show"].includes(item.status)) {
    const savedAppointment = await updateAppointmentStatusRecord(id, "confirmed", metadata);
    syncAppointmentMirror(savedAppointment);
    return savedAppointment;
  }

  if (action === "call" || action === "hold" || action === "requeue") {
    const savedAppointment = await updateAppointmentMetadataRecord(id, metadata);
    syncAppointmentMirror(savedAppointment);
    return savedAppointment;
  }

  const statusByAction = {
    no_show: "no_show",
    cancel: "cancelled",
    complete: "completed"
  };

  const savedAppointment = await updateAppointmentStatusRecord(id, statusByAction[action], metadata);
  syncAppointmentMirror(savedAppointment);
  return savedAppointment;
}

export async function cancelAppointment(id, payload = {}, actor = {}) {
  const item = await getAppointmentById(id);
  if (item.status === "cancelled") {
    return item;
  }

  const savedAppointment = await cancelAppointmentRecord(id, workflowMetadata(payload, actor, "appointment:cancel"));
  syncAppointmentMirror(savedAppointment);
  return savedAppointment;
}

export async function getTodayAppointments() {
  const today = new Date().toISOString().slice(0, 10);
  return listAppointments({ date: today });
}

export async function getAvailableSlots(date, doctorId) {
  if (!date || !doctorId) {
    throw createError("Date and doctor are required.");
  }
  const normalizedDate = normalizeDate(date);
  const slots = getSlotsForDate(normalizedDate);

  const bookedTimes = await getBookedTimesForDoctor(normalizedDate, doctorId);

  return slots.map((time) => ({
    time,
    isBooked: bookedTimes.includes(time)
  }));
}

export async function getAppointmentMasters() {
  return {
    doctors: await listDoctors(),
    departments: getDepartments(),
    types: BOOKING_TYPES,
    statuses: APPOINTMENT_STATUSES,
    paymentModes: PAYMENT_MODES,
    sources: BOOKING_SOURCES,
    slotDurationMinutes: SLOT_DURATION_MINUTES,
    consultationFee: CONSULTATION_FEE,
    bookingRules: {
      maxPatientsPerDay: MAX_PATIENTS_PER_DAY,
      advanceBookingAllowed: true,
      sameDayBookingAllowed: true,
      emergencyOverrideAllowed: false,
      walkInAllowed: true
    },
    opdTimings: OPD_SCHEDULE
  };
}
