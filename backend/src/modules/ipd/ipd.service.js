import { ipdTreatmentPackages, ipdWardCharges } from "../../config/hospitalData.js";
import { createId, db } from "../../data/store.js";
import { currentTime, nowIso, todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import { appendWorkflowMetadata } from "../../utils/workflow.js";
import { createBill } from "../billing/billing.service.js";
import { createPanchkarmaSchedule, getPanchkarmaMasters } from "../panchkarma/panchkarma.service.js";
import { listSessionRecords } from "../panchkarma/panchkarma.repository.js";
import { getPatientById } from "../patients/patients.service.js";
import { listDoctors } from "../users/users.service.js";
import {
  addNoteRecord,
  addVitalRecord,
  createAdmissionRecord,
  dischargeAdmissionRecord,
  findAdmissionRecord,
  getRoomAndBedSnapshot,
  listActiveAdmissionRecords,
  listAdmissionRecords,
  listNoteRecords,
  listVitalRecords,
  loadIpdRelatedRecords,
  updateAdmissionRecord,
  updateAdmissionStatusRecord
} from "./ipd.repository.js";

function formatPatientName(patient) {
  return patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
}

function calculateStayDays(admissionDate, dischargeDate, explicitStayDays) {
  if (explicitStayDays) {
    return Math.max(Number(explicitStayDays || 1), 1);
  }

  const start = new Date(admissionDate);
  const end = new Date(dischargeDate || todayDate());

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff || 1, 1);
}

function syncAdmissionMirror(admission) {
  const index = db.ipdAdmissions.findIndex((entry) => entry.id === admission.id);
  if (index >= 0) {
    db.ipdAdmissions[index] = admission;
    return;
  }
  db.ipdAdmissions.unshift(admission);
}

function syncRoomAndBedMirrors({ rooms = [], beds = [] } = {}) {
  db.rooms.splice(0, db.rooms.length, ...rooms);
  db.beds.splice(0, db.beds.length, ...beds);
}

export async function loadIpdMirrorsFromDatabase() {
  const [admissions, snapshot] = await Promise.all([
    loadIpdRelatedRecords(),
    getRoomAndBedSnapshot()
  ]);

  db.ipdAdmissions.splice(0, db.ipdAdmissions.length, ...admissions);
  syncRoomAndBedMirrors(snapshot);

  return { admissions, ...snapshot };
}

async function doctorsById() {
  const doctors = await listDoctors();
  return new Map(doctors.map((doctor) => [doctor.id, doctor]));
}

async function ensureDoctorExists(doctorId) {
  const doctors = await doctorsById();
  const doctor = doctors.get(doctorId);

  if (!doctor || doctor.role !== "doctor") {
    throw createError("Attending doctor not found.");
  }

  return doctor;
}

async function enrichAdmission(admission) {
  const [patient, doctors] = await Promise.all([
    admission.patientId ? getPatientById(admission.patientId).catch(() => null) : null,
    doctorsById()
  ]);
  const room = db.rooms.find((entry) => entry.id === admission.roomId) || null;
  const bed = db.beds.find((entry) => entry.id === admission.bedId) || null;
  const doctor = doctors.get(admission.attendingDoctorId) || null;
  const [bill, therapySessions] = await Promise.all([
    Promise.resolve(admission.billId ? db.bills.find((entry) => entry.id === admission.billId) || null : null),
    getAdmissionTherapySessions(admission.id).catch(() => [])
  ]);

  return {
    ...admission,
    patient,
    room,
    bed,
    doctor,
    bill,
    therapySessions,
    notes: [...(admission.notes || [])].sort((a, b) => b.noteDate.localeCompare(a.noteDate)),
    vitals: [...(admission.vitals || [])].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  };
}

async function getAdmissionById(admissionId) {
  const admission = await findAdmissionRecord(admissionId);

  if (!admission) {
    throw createError("IPD admission not found.", 404);
  }

  syncAdmissionMirror(admission);
  return admission;
}

export async function getIpdMasters() {
  const [doctors, snapshot] = await Promise.all([listDoctors(), getRoomAndBedSnapshot()]);
  syncRoomAndBedMirrors(snapshot);
  const panchkarmaMasters = await getPanchkarmaMasters();

  const bedsByRoom = snapshot.rooms.map((room) => ({
    roomId: room.id,
    roomNumber: room.roomNumber,
    ward: room.ward,
    roomType: room.roomType,
    chargePerDay: room.chargePerDay,
    beds: snapshot.beds
      .filter((bed) => bed.roomId === room.id && ["available", "reserved"].includes(bed.status))
      .sort((a, b) => a.bedNumber.localeCompare(b.bedNumber))
  }));

  return {
    doctors,
    admissionSources: ["opd", "direct", "emergency", "referral"],
    noteCategories: ["admission", "progress", "doctor_round", "nursing", "diet", "discharge_plan"],
    dischargeStatuses: ["recovered", "referred", "discharged_on_request", "absconded"],
    wardCharges: ipdWardCharges,
    treatmentPackages: ipdTreatmentPackages,
    therapies: panchkarmaMasters.therapies,
    therapists: panchkarmaMasters.therapists,
    therapyRooms: panchkarmaMasters.therapyRooms,
    rooms: bedsByRoom
  };
}

export async function getAdmissionTherapySessions(admissionId) {
  const sessions = await listSessionRecords();
  return sessions
    .filter((session) => session.metadata?.admissionId === admissionId)
    .sort((left, right) => `${right.scheduledDate} ${right.scheduledTime}`.localeCompare(`${left.scheduledDate} ${left.scheduledTime}`));
}

export async function getIpdSummary() {
  const admissions = await listAdmissionRecords();
  admissions.forEach(syncAdmissionMirror);
  const activeAdmissions = admissions.filter((entry) => entry.status === "active");
  const dischargedAdmissions = admissions.filter((entry) => entry.status === "discharged");

  return {
    totalAdmissions: admissions.length,
    activeAdmissions: activeAdmissions.length,
    dischargedAdmissions: dischargedAdmissions.length,
    todayAdmissions: admissions.filter((entry) => entry.admissionDate === todayDate()).length,
    pendingDischarges: activeAdmissions.filter((entry) => entry.expectedDischargeDate && entry.expectedDischargeDate <= todayDate()).length,
    activeRooms: Array.from(new Set(activeAdmissions.map((entry) => entry.roomId))).length
  };
}

export async function getIpdCensus() {
  const [activeAdmissions, snapshot] = await Promise.all([
    listActiveAdmissionRecords(),
    getRoomAndBedSnapshot()
  ]);
  syncRoomAndBedMirrors(snapshot);

  const enrichedAdmissions = await Promise.all(activeAdmissions.map(enrichAdmission));
  const roomCensus = snapshot.rooms
    .map((room) => {
      const beds = snapshot.beds.filter((bed) => bed.roomId === room.id);
      const occupiedBeds = beds.filter((bed) => bed.status === "occupied").length;
      const availableBeds = beds.filter((bed) => bed.status === "available").length;
      const blockedBeds = beds.filter((bed) => ["cleaning", "maintenance"].includes(bed.status)).length;

      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        ward: room.ward,
        roomType: room.roomType,
        totalBeds: beds.length,
        occupiedBeds,
        availableBeds,
        blockedBeds,
        occupancyPercent: beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0
      };
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

  return {
    date: todayDate(),
    summary: {
      activeAdmissions: activeAdmissions.length,
      totalBeds: snapshot.beds.length,
      occupiedBeds: snapshot.beds.filter((bed) => bed.status === "occupied").length,
      availableBeds: snapshot.beds.filter((bed) => bed.status === "available").length,
      blockedBeds: snapshot.beds.filter((bed) => ["cleaning", "maintenance"].includes(bed.status)).length
    },
    activePatients: enrichedAdmissions.map((entry) => ({
      admissionId: entry.id,
      admissionNumber: entry.admissionNumber,
      patientId: entry.patientId,
      patientName: entry.patientName,
      attendingDoctorId: entry.attendingDoctorId,
      diagnosis: entry.diagnosis,
      roomId: entry.roomId,
      roomNumber: entry.room?.roomNumber || "",
      bedId: entry.bedId,
      bedNumber: entry.bed?.bedNumber || "",
      expectedDischargeDate: entry.expectedDischargeDate || ""
    })),
    roomCensus
  };
}

export async function listAdmissions(query = {}) {
  const search = String(query.search || "").trim().toLowerCase();
  const records = await listAdmissionRecords(query);
  records.forEach(syncAdmissionMirror);
  let items = await Promise.all(records.map(enrichAdmission));

  if (search) {
    items = items.filter((entry) =>
      [entry.admissionNumber, entry.patientName, entry.reasonForAdmission, entry.diagnosis, entry.room?.roomNumber]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  return items.sort((a, b) => `${b.admissionDate} ${b.admissionTime}`.localeCompare(`${a.admissionDate} ${a.admissionTime}`));
}

export async function getAdmissionDetails(admissionId) {
  return enrichAdmission(await getAdmissionById(admissionId));
}

export async function getAdmissionNotes(admissionId) {
  const admission = await getAdmissionById(admissionId);
  const notes = await listNoteRecords(admissionId);

  return {
    admissionId: admission.id,
    admissionNumber: admission.admissionNumber,
    status: admission.status,
    items: notes
  };
}

export async function getAdmissionVitals(admissionId) {
  const admission = await getAdmissionById(admissionId);
  const vitals = await listVitalRecords(admissionId);

  return {
    admissionId: admission.id,
    admissionNumber: admission.admissionNumber,
    status: admission.status,
    items: vitals
  };
}

function admissionConflictToError(result) {
  if (result.conflict === "room_missing") throw createError("Room not found.", 404);
  if (result.conflict === "bed_missing") throw createError("Bed not found.", 404);
  if (result.conflict === "bed_room_mismatch") throw createError("Selected bed does not belong to the selected room.");
  if (result.conflict === "bed_unavailable") throw createError("Selected bed is not available for admission.");
  if (result.conflict === "patient_active") throw createError("This patient already has an active IPD admission.");
  if (result.conflict === "inactive") throw createError("Only active admissions can be updated.");
}

export async function admitPatient(payload, userId) {
  if (!payload.patientId || !payload.roomId || !payload.bedId || !payload.attendingDoctorId || !payload.reasonForAdmission) {
    throw createError("Patient, room, bed, doctor, and admission reason are required.");
  }

  const [patient] = await Promise.all([
    getPatientById(payload.patientId),
    ensureDoctorExists(payload.attendingDoctorId)
  ]);

  const patientName = formatPatientName(patient);
  const result = await createAdmissionRecord({
    id: createId(),
    patientId: patient.id,
    patientName,
    roomId: payload.roomId,
    bedId: payload.bedId,
    attendingDoctorId: payload.attendingDoctorId,
    admissionDate: payload.admissionDate || todayDate(),
    admissionTime: payload.admissionTime || currentTime(),
    admissionSource: payload.admissionSource || "opd",
    admissionType: payload.admissionType || "ipd",
    reasonForAdmission: payload.reasonForAdmission,
    diagnosis: payload.diagnosis || "",
    expectedDischargeDate: payload.expectedDischargeDate || "",
    depositAmount: Number(payload.depositAmount || 0),
    mlcCase: Boolean(payload.mlcCase),
    admittedBy: userId,
    initialNote: payload.initialNote ? { id: createId(), note: payload.initialNote } : null
  });

  if (!result || result.conflict) {
    admissionConflictToError(result || { conflict: "bed_missing" });
  }

  syncAdmissionMirror(result);
  await loadIpdMirrorsFromDatabase();
  return enrichAdmission(result);
}

export async function addAdmissionNote(admissionId, payload, userId) {
  if (!payload.note) {
    throw createError("Clinical note is required.");
  }

  const result = await addNoteRecord(admissionId, {
    id: createId(),
    noteDate: nowIso(),
    category: payload.category || "progress",
    note: payload.note,
    authorId: userId
  });

  if (!result) throw createError("IPD admission not found.", 404);
  if (result.conflict === "inactive") throw createError("Notes can only be added to active admissions.");

  syncAdmissionMirror(result);
  return enrichAdmission(result);
}

export async function addAdmissionVitals(admissionId, payload, userId) {
  if (!payload.bp && !payload.pulse && !payload.temp && !payload.spo2 && !payload.rr && !payload.weight) {
    throw createError("At least one vital measurement is required.");
  }

  const result = await addVitalRecord(admissionId, {
    id: createId(),
    recordedAt: nowIso(),
    bp: payload.bp || "",
    pulse: payload.pulse ? Number(payload.pulse) : null,
    temp: payload.temp ? Number(payload.temp) : null,
    spo2: payload.spo2 ? Number(payload.spo2) : null,
    rr: payload.rr ? Number(payload.rr) : null,
    weight: payload.weight ? Number(payload.weight) : null,
    notes: payload.notes || "",
    recordedBy: userId
  });

  if (!result) throw createError("IPD admission not found.", 404);
  if (result.conflict === "inactive") throw createError("Vitals can only be recorded for active admissions.");

  syncAdmissionMirror(result);
  return enrichAdmission(result);
}

export async function scheduleAdmissionTherapy(admissionId, payload, userId) {
  const admission = await getAdmissionById(admissionId);

  if (admission.status !== "active") {
    throw createError("Therapies can only be scheduled for active IPD admissions.");
  }

  if (!payload.therapyId || !payload.therapistId || !payload.scheduledDate || !payload.scheduledTime) {
    throw createError("Therapy, therapist, date, and time are required.");
  }

  const schedule = await createPanchkarmaSchedule(
    {
      patientId: admission.patientId,
      therapyId: payload.therapyId,
      therapistId: payload.therapistId,
      recommendedBy: payload.recommendedBy || admission.attendingDoctorId,
      therapyRoomId: payload.therapyRoomId || "",
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      estimatedDurationMinutes: payload.estimatedDurationMinutes,
      complaint: payload.complaint || admission.reasonForAdmission,
      preparationNotes: payload.preparationNotes || "",
      metadata: {
        admissionId,
        admissionNumber: admission.admissionNumber,
        packageId: payload.packageId || "",
        packageName: ipdTreatmentPackages.find((item) => item.id === payload.packageId)?.name || "",
        source: "ipd_therapy_order"
      }
    },
    userId
  );

  await addNoteRecord(admissionId, {
    id: createId(),
    noteDate: nowIso(),
    category: "doctor_round",
    note: `Therapy scheduled: ${schedule.therapyName} on ${schedule.scheduledDate} at ${schedule.scheduledTime}.`,
    authorId: userId
  });

  const refreshed = await getAdmissionById(admissionId);
  syncAdmissionMirror(refreshed);
  syncScheduleMirrorIfAvailable(schedule);
  return enrichAdmission(refreshed);
}

function syncScheduleMirrorIfAvailable(schedule) {
  if (!schedule?.id) return;
  const index = db.panchkarmaSchedules.findIndex((entry) => entry.id === schedule.id);
  if (index >= 0) {
    db.panchkarmaSchedules[index] = schedule;
  } else {
    db.panchkarmaSchedules.unshift(schedule);
  }
}

export async function updateAdmission(admissionId, payload, userId) {
  const admission = await getAdmissionById(admissionId);

  if (admission.status !== "active") {
    throw createError("Only active admissions can be updated.");
  }

  if ((payload.roomId !== undefined || payload.bedId !== undefined) && (!payload.roomId || !payload.bedId)) {
    throw createError("Both roomId and bedId are required to update bed assignment.");
  }

  if (payload.attendingDoctorId) {
    await ensureDoctorExists(payload.attendingDoctorId);
  }

  const result = await updateAdmissionRecord(admissionId, {
    attendingDoctorId: payload.attendingDoctorId,
    roomId: payload.roomId,
    bedId: payload.bedId,
    reasonForAdmission: payload.reasonForAdmission,
    diagnosis: payload.diagnosis,
    expectedDischargeDate: payload.expectedDischargeDate,
    admissionSource: payload.admissionSource,
    admissionType: payload.admissionType,
    updatedBy: userId
  });

  if (!result) throw createError("IPD admission not found.", 404);
  if (result.conflict) admissionConflictToError(result);

  syncAdmissionMirror(result);
  await loadIpdMirrorsFromDatabase();
  return enrichAdmission(result);
}

export async function dischargeAdmission(admissionId, payload, userId) {
  const admission = await getAdmissionById(admissionId);

  if (admission.status !== "active") {
    throw createError("This admission is already discharged.");
  }

  if (!payload.dischargeNote) {
    throw createError("Discharge summary note is required.");
  }

  const patient = admission.patientId ? await getPatientById(admission.patientId) : null;
  const room = db.rooms.find((entry) => entry.id === admission.roomId) || null;
  const bed = db.beds.find((entry) => entry.id === admission.bedId) || null;
  const dischargeDate = payload.dischargeDate || todayDate();
  const stayDays = calculateStayDays(admission.admissionDate, dischargeDate, payload.stayDays);
  const roomCharge = Number(room?.chargePerDay || 0) * stayDays;
  const extraCharge = Number(payload.extraCharge || 0);
  let bill = null;

  if (payload.createBill && patient) {
    const linkedTherapies = await getAdmissionTherapySessions(admissionId);
    const unbilledCompletedTherapies = linkedTherapies.filter((session) => session.status === "completed" && !session.billId);
    const billItems = [
      {
        description: `IPD Room Charges (${room?.roomNumber || admission.roomId})`,
        category: "room",
        quantity: stayDays,
        unitPrice: Number(room?.chargePerDay || 0)
      }
    ];

    if (extraCharge > 0) {
      billItems.push({
        description: payload.extraChargeLabel || "IPD Additional Charges",
        category: "service",
        quantity: 1,
        unitPrice: extraCharge
      });
    }

    unbilledCompletedTherapies.forEach((session) => {
      billItems.push({
        description: `${session.therapyName} IPD therapy (${session.scheduleNumber})`,
        category: "therapy",
        quantity: 1,
        unitPrice: Number(session.billedAmount || 0)
      });
    });

    bill = await createBill({
      patientId: patient.id,
      patientName: admission.patientName,
      bedId: bed?.id || admission.bedId,
      billType: "ipd",
      billDate: dischargeDate,
      notes: `Generated from discharge ${admission.admissionNumber}`,
      items: billItems,
      createdBy: userId
    });
  }

  const dischargeSummary = {
    dischargeDate,
    dischargeTime: payload.dischargeTime || currentTime(),
    dischargeStatus: payload.dischargeStatus || "recovered",
    dischargeNote: payload.dischargeNote,
    conditionOnDischarge: payload.conditionOnDischarge || "stable",
    advice: payload.advice || "",
    followUpDate: payload.followUpDate || "",
    followUpWithOpd: payload.followUpWithOpd !== false,
    followUpWithPhone: Boolean(payload.followUpWithPhone),
    stayDays,
    roomCharge,
    extraCharge,
    dischargedBy: userId,
    billId: bill?.id || admission.billId || "",
    metadata: payload.metadata || {}
  };

  const result = await dischargeAdmissionRecord(admissionId, {
    dischargeSummary,
    billId: bill?.id || admission.billId || "",
    nextBedStatus: payload.nextBedStatus || "cleaning",
    bedNote: payload.bedNote || "Discharged from IPD",
    dischargeNoteId: createId(),
    dischargedBy: userId
  });

  if (!result) throw createError("IPD admission not found.", 404);
  if (result.conflict === "inactive") throw createError("This admission is already discharged.");

  syncAdmissionMirror(result);
  await loadIpdMirrorsFromDatabase();
  return enrichAdmission(result);
}

export async function updateAdmissionWorkflowStatus(admissionId, payload = {}, user = {}) {
  const admission = await getAdmissionDetails(admissionId);
  const action = String(payload.action || "").trim().toLowerCase();
  const statusByAction = {
    cancel: "cancelled",
    transfer: "transferred",
    reopen: "active"
  };

  if (!statusByAction[action]) {
    throw createError("Invalid IPD workflow action.");
  }

  const metadata = appendWorkflowMetadata(admission.metadata, payload, user, `ipd:${action}`);
  const result = await updateAdmissionStatusRecord(admissionId, {
    status: statusByAction[action],
    metadata,
    nextBedStatus: payload.nextBedStatus || "cleaning",
    bedNote: payload.bedNote || metadata.workflow.reason
  });

  if (!result) throw createError("IPD admission not found.", 404);
  if (result.conflict === "inactive") throw createError("Only active IPD admissions can be cancelled or transferred.");
  if (result.conflict === "invalid_status") throw createError("This admission cannot be reopened from its current state.");

  syncAdmissionMirror(result);
  await loadIpdMirrorsFromDatabase();
  return enrichAdmission(result);
}
