import { createId, db } from "../../data/store.js";
import { todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import { getPatientById } from "../patients/patients.service.js";
import { listDoctors, listTherapists } from "../users/users.service.js";
import {
  completeSessionRecord,
  createSessionRecord,
  findSessionRecord,
  findTherapyRecord,
  listMaterialMedicineRecords,
  listSessionRecords,
  listTherapyRecords,
  loadPanchkarmaMirrors,
  startSessionRecord
} from "./panchkarma.repository.js";

function syncById(collection, item, prepend = false) {
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    collection[index] = item;
    return;
  }
  if (prepend) {
    collection.unshift(item);
    return;
  }
  collection.push(item);
}

function syncScheduleMirror(schedule) {
  syncById(db.panchkarmaSchedules, schedule, true);
}

function syncBillMirror(bill) {
  if (bill) {
    syncById(db.bills, bill, true);
  }
}

export async function loadPanchkarmaMirrorsFromDatabase() {
  const { therapies, sessions } = await loadPanchkarmaMirrors();
  db.panchkarmaTherapies.splice(0, db.panchkarmaTherapies.length, ...therapies);
  db.panchkarmaSchedules.splice(0, db.panchkarmaSchedules.length, ...sessions);
  return { therapies, sessions };
}

async function therapistById(therapistId) {
  const therapists = await listTherapists();
  return therapists.find((entry) => entry.id === therapistId) || null;
}

async function doctorById(doctorId) {
  const doctors = await listDoctors();
  return doctors.find((entry) => entry.id === doctorId) || null;
}

async function scheduleOrThrow(scheduleId) {
  const schedule = await findSessionRecord(scheduleId);
  if (!schedule) {
    throw createError("Panchkarma session not found.", 404);
  }
  syncScheduleMirror(schedule);
  return schedule;
}

async function therapyOrThrow(therapyId) {
  const therapy = await findTherapyRecord(therapyId);
  if (!therapy) {
    throw createError("Therapy not found.", 404);
  }
  return therapy;
}

async function enrichSchedule(schedule) {
  const [therapies, therapists, doctors] = await Promise.all([
    listTherapyRecords(),
    listTherapists(),
    listDoctors()
  ]);
  const therapy = therapies.find((entry) => entry.id === schedule.therapyId) || null;
  const patient = schedule.patientId ? await getPatientById(schedule.patientId).catch(() => null) : null;
  const therapist = therapists.find((entry) => entry.id === schedule.therapistId) || null;
  const doctor = schedule.recommendedBy ? doctors.find((entry) => entry.id === schedule.recommendedBy) || null : null;
  const therapyRoom = schedule.therapyRoomId ? db.rooms.find((entry) => entry.id === schedule.therapyRoomId) || null : null;
  const recoveryBed = schedule.recoveryBedId ? db.beds.find((entry) => entry.id === schedule.recoveryBedId) || null : null;
  const recoveryRoom = recoveryBed ? db.rooms.find((entry) => entry.id === recoveryBed.roomId) || null : null;
  const bill = schedule.billId ? db.bills.find((entry) => entry.id === schedule.billId) || null : null;

  return {
    ...schedule,
    therapy,
    patient,
    therapist,
    doctor,
    therapyRoom,
    recoveryBed,
    recoveryRoom,
    bill
  };
}

export async function getPanchkarmaTherapies() {
  const therapies = await listTherapyRecords();
  db.panchkarmaTherapies.splice(0, db.panchkarmaTherapies.length, ...therapies);
  return therapies;
}

export async function getPanchkarmaMasters() {
  const [therapies, therapists, doctors, materialMedicines] = await Promise.all([
    getPanchkarmaTherapies(),
    listTherapists(),
    listDoctors(),
    listMaterialMedicineRecords()
  ]);
  const therapyRooms = db.rooms.filter((entry) => entry.roomType === "therapy");
  const recoveryBeds = db.beds
    .filter((bed) => ["available", "reserved"].includes(bed.status))
    .map((bed) => ({
      ...bed,
      room: db.rooms.find((room) => room.id === bed.roomId) || null
    }));

  return {
    therapies,
    therapists,
    doctors,
    therapyRooms,
    recoveryBeds,
    materialMedicines,
    rateListUpdatedFrom: "SR-AIIMS Panchakarma & Therapy Rate List",
    statuses: ["scheduled", "in_progress", "completed", "cancelled"]
  };
}

export async function getPanchkarmaSummary() {
  const today = todayDate();
  const sessions = await listSessionRecords();
  db.panchkarmaSchedules.splice(0, db.panchkarmaSchedules.length, ...sessions);

  return {
    totalSessions: sessions.length,
    todaySessions: sessions.filter((entry) => entry.scheduledDate === today).length,
    scheduled: sessions.filter((entry) => entry.status === "scheduled").length,
    inProgress: sessions.filter((entry) => entry.status === "in_progress").length,
    completed: sessions.filter((entry) => entry.status === "completed").length,
    pendingBilling: sessions.filter((entry) => entry.status === "completed" && !entry.billId).length
  };
}

export async function listPanchkarmaSchedules(query = {}) {
  const search = String(query.search || "").trim().toLowerCase();
  const sessions = await listSessionRecords(query);
  db.panchkarmaSchedules.splice(0, db.panchkarmaSchedules.length, ...sessions);
  let items = await Promise.all(sessions.map(enrichSchedule));

  if (search) {
    items = items.filter((entry) =>
      [
        entry.scheduleNumber,
        entry.patientName,
        entry.therapyName,
        entry.therapistName,
        entry.complaint,
        entry.outcome
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  return items.sort((left, right) =>
    `${right.scheduledDate} ${right.scheduledTime}`.localeCompare(`${left.scheduledDate} ${left.scheduledTime}`)
  );
}

export async function getPanchkarmaScheduleDetails(scheduleId) {
  return enrichSchedule(await scheduleOrThrow(scheduleId));
}

export async function createPanchkarmaSchedule(payload, userId) {
  if (!payload.patientId || !payload.therapyId || !payload.therapistId || !payload.scheduledDate || !payload.scheduledTime) {
    throw createError("Patient, therapy, therapist, date, and time are required.");
  }

  const [patient, therapy, therapist] = await Promise.all([
    getPatientById(payload.patientId),
    therapyOrThrow(payload.therapyId),
    therapistById(payload.therapistId)
  ]);

  if (!therapist) {
    throw createError("Therapist not found.", 404);
  }

  const therapyRoom = payload.therapyRoomId ? db.rooms.find((entry) => entry.id === payload.therapyRoomId) || null : null;
  if (payload.therapyRoomId && !therapyRoom) {
    throw createError("Room not found.", 404);
  }
  if (therapyRoom && therapyRoom.roomType !== "therapy") {
    throw createError("Selected room is not a therapy room.");
  }

  const recoveryBed = payload.recoveryBedId ? db.beds.find((entry) => entry.id === payload.recoveryBedId) || null : null;
  if (payload.recoveryBedId && !recoveryBed) {
    throw createError("Bed not found.", 404);
  }
  if (recoveryBed?.status === "occupied") {
    throw createError("Selected recovery bed is currently occupied.");
  }

  let recommendedByName = "";
  if (payload.recommendedBy) {
    const doctor = await doctorById(payload.recommendedBy);
    if (!doctor) {
      throw createError("Recommending doctor not found.");
    }
    recommendedByName = doctor.fullName;
  }

  const patientName = patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  const schedule = await createSessionRecord({
    id: createId(),
    patientId: patient.id,
    patientName,
    therapyId: therapy.id,
    therapyName: therapy.name,
    recommendedBy: payload.recommendedBy || "",
    linkedVisitId: payload.linkedVisitId || "",
    prescriptionId: payload.prescriptionId || "",
    therapyRoomId: therapyRoom?.id || "",
    recoveryBedId: recoveryBed?.id || "",
    therapistId: therapist.id,
    therapistName: therapist.fullName,
    scheduledDate: payload.scheduledDate,
    scheduledTime: payload.scheduledTime,
    estimatedDurationMinutes: Number(payload.estimatedDurationMinutes || therapy.defaultDurationMinutes || 30),
    complaint: payload.complaint || "",
    preparationNotes: payload.preparationNotes || "",
    createdBy: userId,
    metadata: {
      recommendedByName
    }
  });

  syncScheduleMirror(schedule);
  return enrichSchedule(schedule);
}

export async function startPanchkarmaSession(scheduleId, payload = {}, userId) {
  const schedule = await scheduleOrThrow(scheduleId);

  if (schedule.status !== "scheduled") {
    throw createError("Only scheduled sessions can be started.");
  }

  let therapist = null;
  if (payload?.therapistId) {
    therapist = await therapistById(payload.therapistId);
    if (!therapist) {
      throw createError("Therapist not found.", 404);
    }
  }

  const result = await startSessionRecord(scheduleId, {
    therapistId: therapist?.id || "",
    therapistName: therapist?.fullName || "",
    sessionStartedAt: payload?.sessionStartedAt || "",
    executionNotes: payload?.executionNotes || "",
    startedBy: userId
  });

  if (!result) throw createError("Panchkarma session not found.", 404);
  if (result.conflict === "invalid_status") throw createError("Only scheduled sessions can be started.");

  syncScheduleMirror(result);
  return enrichSchedule(result);
}

function materialConflictToError(result) {
  if (result.conflict === "medicine_missing") throw createError("Material medicine not found.", 404);
  if (result.conflict === "invalid_quantity") throw createError(`Material quantity must be greater than zero for ${result.medicineName}.`);
  if (result.conflict === "insufficient_stock") throw createError(`Insufficient stock for ${result.medicineName}.`);
  if (result.conflict === "invalid_status") throw createError("Only scheduled or in-progress sessions can be completed.");
}

function billItemsForCompletion({ therapy, materialsUsed, materialMedicines, payload }) {
  const sessionCharge = Number(payload.sessionCharge || therapy.price || 0);
  const items = [
    {
      id: createId(),
      description: `${therapy.name} Panchkarma session`,
      category: "therapy",
      quantity: 1,
      unitPrice: sessionCharge,
      amount: sessionCharge
    }
  ];

  if (payload.addMaterialCharges) {
    materialsUsed.forEach((item) => {
      const medicine = materialMedicines.find((entry) => entry.id === item.medicineId);
      const unitPrice = Number(medicine?.price || 0);
      items.push({
        id: createId(),
        description: `${item.medicineName} therapy material`,
        category: "therapy",
        quantity: Number(item.quantity || 0),
        unitPrice,
        amount: Number(item.quantity || 0) * unitPrice
      });
    });
  }

  return items;
}

export async function completePanchkarmaSession(scheduleId, payload, userId) {
  const schedule = await scheduleOrThrow(scheduleId);

  if (!["scheduled", "in_progress"].includes(schedule.status)) {
    throw createError("Only scheduled or in-progress sessions can be completed.");
  }

  if (!payload.outcome) {
    throw createError("Session outcome is required.");
  }

  const [therapy, materialMedicines] = await Promise.all([
    therapyOrThrow(schedule.therapyId),
    listMaterialMedicineRecords()
  ]);
  const materialInputs = payload.materialsUsed || [];
  const materialPreview = materialInputs.map((item) => {
    const medicine = materialMedicines.find((entry) => entry.id === item.medicineId);
    return {
      medicineId: item.medicineId,
      medicineName: medicine?.name || "",
      quantity: Number(item.quantity || 0),
      notes: item.notes || ""
    };
  });
  const billItems = payload.createBill
    ? billItemsForCompletion({ therapy, materialsUsed: materialPreview, materialMedicines, payload })
    : [];
  const subtotal = billItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const result = await completeSessionRecord(scheduleId, {
    createId,
    materialsUsed: materialInputs,
    bill: payload.createBill
      ? {
          id: createId(),
          patientId: schedule.patientId,
          patientName: schedule.patientName,
          billType: "therapy",
          billDate: payload.billDate || todayDate(),
          subtotal,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: subtotal,
          paymentStatus: payload.paymentStatus || "unpaid",
          createdBy: userId,
          notes: `Generated from Panchkarma session ${schedule.scheduleNumber}`,
          invoiceMeta: {},
          metadata: {
            panchkarmaSessionId: schedule.id,
            panchkarmaScheduleNumber: schedule.scheduleNumber
          },
          items: billItems
        }
      : null,
    sessionCompletedAt: payload.sessionCompletedAt || "",
    executionNotes: payload.executionNotes || "",
    followUpAdvice: payload.followUpAdvice || "",
    outcome: payload.outcome,
    billedAmount: subtotal || Number(payload.sessionCharge || therapy.price || 0),
    completedBy: userId
  });

  if (!result) throw createError("Panchkarma session not found.", 404);
  if (result.conflict) materialConflictToError(result);

  syncScheduleMirror(result.session);
  syncBillMirror(result.bill);
  return enrichSchedule(result.session);
}
