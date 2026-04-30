import { db, getDepartments, createId } from "../../data/store.js";
import { consultationCharge, opdOperatingHours } from "../../config/hospitalData.js";
import { createError } from "../../utils/errors.js";
import { getPatientById } from "../patients/patients.service.js";
import { listDoctors } from "../users/users.service.js";
import {
  cancelAppointmentRecord,
  countAppointmentsForDate,
  createAppointmentRecord,
  findAppointmentById,
  getBookedTimesForDoctor,
  listAppointmentRecords,
  updateAppointmentRecord,
  updateAppointmentStatusRecord
} from "./appointments.repository.js";

const MAX_PATIENTS_PER_DAY = 100;
const SLOT_DURATION_MINUTES = 10;
const CONSULTATION_FEE = consultationCharge;
const BOOKING_TYPES = ["new", "follow_up"];
const BOOKING_SOURCES = ["Website", "Reception", "Call", "WhatsApp", "Walk-in"];
const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
const STATUS_TRANSITIONS = {
  scheduled: ["confirmed", "in_progress", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: []
};
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

function normalizeGender(gender = "") {
  const value = String(gender).trim().toLowerCase();
  if (!value) {
    return "";
  }
  if (["male", "female", "other"].includes(value)) {
    return value;
  }
  throw createError("Gender must be male, female, or other.");
}

function normalizeStatus(status) {
  const nextStatus = String(status || "").trim().toLowerCase();

  if (!APPOINTMENT_STATUSES.includes(nextStatus)) {
    throw createError("Invalid appointment status.");
  }

  return nextStatus;
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

  const hasExistingPatient = Boolean(payload.patientId);
  let patientId = payload.patientId || null;
  let patientName = payload.patientName || "";
  let patientAge = payload.patientAge ? Number(payload.patientAge) : null;
  let patientGender = payload.patientGender || "";
  let patientMobile = payload.patientMobile || "";

  if (hasExistingPatient) {
    const patient = await getPatientById(patientId);
    patientName = `${patient.firstName} ${patient.lastName}`.trim();
    patientAge = calculatePatientAge(patient);
    patientGender = patient.gender || "";
    patientMobile = patient.phone || "";
  } else {
    if (!patientName || !patientName.trim()) {
      throw createError("Patient name is required for new booking.");
    }
    if (!Number.isFinite(patientAge) || patientAge <= 0) {
      throw createError("Valid patient age is required for new booking.");
    }
    if (!patientGender) {
      throw createError("Patient gender is required for new booking.");
    }
    if (!patientMobile || String(patientMobile).trim().length < 10) {
      throw createError("Valid patient mobile number is required for new booking.");
    }
    patientGender = normalizeGender(patientGender);
  }

  if (!payload.chiefComplaint || !String(payload.chiefComplaint).trim()) {
    throw createError("Problem / chief complaint is required.");
  }

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
    status: payload.status || "scheduled",
    chiefComplaint: String(payload.chiefComplaint || "").trim(),
    bookedBy,
    source: BOOKING_SOURCES.includes(payload.source) ? payload.source : "Reception",
    smsSent: false
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
    statusUpdateNote: String(payload.note || "").trim()
  });
  syncAppointmentMirror(savedAppointment);
  return savedAppointment;
}

export async function cancelAppointment(id) {
  const item = await getAppointmentById(id);
  if (item.status === "cancelled") {
    return item;
  }

  const savedAppointment = await cancelAppointmentRecord(id);
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
