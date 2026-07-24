import {
  createId,
  db,
  getMedicineMasters,
} from "../../data/store.js";
import { consultationCharge, opdOperatingHours } from "../../config/hospitalData.js";
import { todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import { appendWorkflowMetadata, workflowMetadata } from "../../utils/workflow.js";
import { getAppointmentById, updateAppointmentStatus } from "../appointments/appointments.service.js";
import { admitPatient } from "../ipd/ipd.service.js";
import { createLabOrder, getLabMasters } from "../laboratory/laboratory.service.js";
import { listDoctors } from "../users/users.service.js";
import {
  createVisitRecord,
  findAssessmentByVisitId,
  findDischargeSummaryByVisitId,
  findPrescriptionByVisitId,
  findOrCreateDietItemRecord,
  findVisitByAppointmentId,
  findVisitById,
  listAssessmentRecords,
  listDietItemRecords,
  listOpdQueue,
  listPrescriptionRecords,
  listVisitRecords,
  updateVisitStatusRecord,
  updateVisitVitalsRecord,
  upsertAssessmentRecord,
  upsertDischargeSummaryRecord,
  upsertPrescriptionRecord
} from "./opd.repository.js";

const CONSULTATION_FEE = consultationCharge;

async function getVisitById(visitId) {
  const visit = await findVisitById(visitId);

  if (!visit) {
    throw createError("OPD visit not found.", 404);
  }

  return visit;
}

function syncList(list, item) {
  const index = list.findIndex((entry) => entry.id === item.id);

  if (index >= 0) {
    list[index] = item;
    return;
  }

  list.push(item);
}

function syncVisitMirror(visit) {
  syncList(db.opdVisits, visit);
}

function syncAssessmentMirror(assessment) {
  syncList(db.ayurvedaAssessments, assessment);
}

function syncPrescriptionMirror(prescription) {
  syncList(db.prescriptions, prescription);
}

export function syncOpdMirrors({ visits = [], assessments = [], prescriptions = [] } = {}) {
  visits.forEach(syncVisitMirror);
  assessments.forEach(syncAssessmentMirror);
  prescriptions.forEach(syncPrescriptionMirror);
}

export async function loadOpdMirrorsFromDatabase() {
  const [visits, assessments, prescriptions] = await Promise.all([
    listVisitRecords(),
    listAssessmentRecords(),
    listPrescriptionRecords()
  ]);

  db.opdVisits.splice(0, db.opdVisits.length, ...visits);
  db.ayurvedaAssessments.splice(0, db.ayurvedaAssessments.length, ...assessments);
  db.prescriptions.splice(0, db.prescriptions.length, ...prescriptions);

  return { visits, assessments, prescriptions };
}

export async function getQueue(date = todayDate(), doctorId = "") {
  return listOpdQueue(date, doctorId);
}

export async function createVisit({ appointmentId }, actor = {}) {
  const appointment = await getAppointmentById(appointmentId);
  const existingVisit = await findVisitByAppointmentId(appointmentId);

  if (existingVisit) {
    syncVisitMirror(existingVisit);
    return existingVisit;
  }

  const visit = {
    id: createId(),
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    doctorId: appointment.doctorId,
    appointmentId: appointment.id,
    visitDate: appointment.appointmentDate,
    visitType: appointment.type,
    chiefComplaint: appointment.chiefComplaint || "",
    vitalsBp: "",
    vitalsPulse: null,
    vitalsTemp: null,
    vitalsWeight: null,
    vitalsHeight: null,
    vitalsSpo2: null,
    vitalsRr: null,
    status: "waiting",
    consultationFee: CONSULTATION_FEE,
    metadata: {
      workflowStage: "screening",
      receptionForwardedAt: new Date().toISOString(),
      receptionForwardedBy: actor.sub || "",
      forwardedTo: ["screening"]
    }
  };

  const savedVisit = await createVisitRecord(visit);
  syncVisitMirror(savedVisit);
  appointment.status = "in_progress";
  await updateAppointmentStatus(appointment.id, { status: "in_progress", note: `OPD visit ${savedVisit.opdNumber} created.` });

  return savedVisit;
}

export async function getVisitDetails(visitId) {
  const visit = await getVisitById(visitId);
  const doctors = await listDoctors();
  const assessment = await findAssessmentByVisitId(visitId);
  const prescription = await findPrescriptionByVisitId(visitId);
  const dischargeSummary = await findDischargeSummaryByVisitId(visitId);

  return {
    visit,
    doctorName: doctors.find((doctor) => doctor.id === visit.doctorId)?.fullName || "Unassigned",
    assessment,
    prescription,
    dischargeSummary,
    labOrders: db.labOrders.filter((entry) => entry.visitId === visitId),
    bills: db.bills.filter((entry) => entry.visitId === visitId)
  };
}

export async function saveVitals(visitId, payload, actor = {}) {
  await getVisitById(visitId);
  const visit = await updateVisitVitalsRecord(visitId, payload, {
    workflowStage: "doctor",
    screeningCompletedAt: new Date().toISOString(),
    screeningCompletedBy: actor.sub || "",
    physicalExam: payload.physicalExam || "",
    forwardedTo: ["doctor"]
  });
  syncVisitMirror(visit);
  return visit;
}

export async function saveAssessment(visitId, payload, doctorId) {
  const visit = await getVisitById(visitId);
  let assessment = await findAssessmentByVisitId(visitId);

  if (!assessment) {
    assessment = {
      id: createId(),
      patientId: visit.patientId,
      visitId,
      doctorId: doctorId || visit.doctorId,
      assessmentDate: todayDate()
    };
  }

  Object.assign(assessment, {
    patientId: visit.patientId,
    visitId,
    doctorId: doctorId || visit.doctorId,
    assessmentDate: payload.assessmentDate || assessment.assessmentDate || todayDate(),
    prakritiVata: payload.prakritiVata ?? assessment.prakritiVata ?? "",
    prakritiPitta: payload.prakritiPitta ?? assessment.prakritiPitta ?? "",
    prakritiKapha: payload.prakritiKapha ?? assessment.prakritiKapha ?? "",
    prakritiDominant: payload.prakritiDominant ?? assessment.prakritiDominant ?? "",
    nadiPariksha: payload.nadiPariksha ?? assessment.nadiPariksha ?? "",
    nadiType: payload.nadiType ?? assessment.nadiType ?? "",
    jihvaPariksha: payload.jihvaPariksha ?? assessment.jihvaPariksha ?? "",
    agniStatus: payload.agniStatus ?? assessment.agniStatus ?? "",
    koshthaNature: payload.koshthaNature ?? assessment.koshthaNature ?? "",
    vikritiAssessment: payload.vikritiAssessment ?? assessment.vikritiAssessment ?? "",
    observations: payload.observations ?? assessment.observations ?? ""
  });

  const savedAssessment = await upsertAssessmentRecord(assessment);
  syncAssessmentMirror(savedAssessment);
  return savedAssessment;
}

const DIET_ITEM_NAME_MAX = 120;

// Resolve every incoming selection against the diet master. Entries carrying a
// known id map straight through; anything else is treated as a name the doctor
// typed and is added to the master (tagged 'custom') so it is suggested next
// time. Returns null when the payload carries neither list, leaving whatever is
// stored untouched.
async function resolveDietSelections(payload) {
  const hasTake = Array.isArray(payload.dietToTake);
  const hasAvoid = Array.isArray(payload.dietToAvoid);

  if (!hasTake && !hasAvoid) {
    return null;
  }

  const master = await listDietItemRecords();
  const masterById = new Map(master.map((item) => [String(item.id), item]));

  async function resolve(selections, side) {
    const excludedSide = side === "take" ? "avoid" : "take";
    // Name lookup is scoped to this side so a typed item does not silently bind
    // to a same-named entry belonging to the other list.
    const masterByName = new Map(
      master
        .filter((item) => item.appliesTo !== excludedSide)
        .map((item) => [item.name.trim().toLowerCase(), item])
    );

    const resolved = [];
    const seen = new Set();

    for (const selection of selections || []) {
      const existing = masterById.get(String(selection?.id ?? selection));
      let item = existing && existing.appliesTo !== excludedSide ? existing : null;

      if (!item) {
        const typedName = String(selection?.name ?? "").trim().slice(0, DIET_ITEM_NAME_MAX);

        if (!typedName) {
          continue;
        }

        item = masterByName.get(typedName.toLowerCase());

        if (!item) {
          item = await findOrCreateDietItemRecord({ name: typedName, appliesTo: side });
          masterByName.set(item.name.trim().toLowerCase(), item);
          masterById.set(String(item.id), item);
        }
      }

      if (!seen.has(item.id)) {
        seen.add(item.id);
        resolved.push({ id: item.id, name: item.name, nameHi: item.nameHi });
      }
    }

    return resolved;
  }

  return {
    take: hasTake ? await resolve(payload.dietToTake, "take") : null,
    avoid: hasAvoid ? await resolve(payload.dietToAvoid, "avoid") : null
  };
}

export async function savePrescription(visitId, payload, doctorId) {
  const visit = await getVisitById(visitId);
  let prescription = await findPrescriptionByVisitId(visitId);

  if (!payload.diagnosis) {
    throw createError("Diagnosis is required to save a prescription.");
  }

  const dietSelections = await resolveDietSelections(payload);

  if (!prescription) {
    prescription = {
      id: createId(),
      prescriptionNumber: "",
      patientId: visit.patientId,
      patientName: visit.patientName,
      doctorId: doctorId || visit.doctorId,
      visitId,
      prescriptionDate: todayDate(),
      isDispensed: false,
      medicines: []
    };
  }

  Object.assign(prescription, {
    patientId: visit.patientId,
    patientName: visit.patientName,
    doctorId: doctorId || visit.doctorId,
    visitId,
    prescriptionDate: payload.prescriptionDate || prescription.prescriptionDate || todayDate(),
    diagnosis: payload.diagnosis,
    diagnosisAyurvedic: payload.diagnosisAyurvedic || "",
    nidana: payload.nidana || "",
    samprapti: payload.samprapti || "",
    chikitsaSutra: payload.chikitsaSutra || "",
    dietRecommendations: payload.dietRecommendations ?? prescription.dietRecommendations ?? "",
    dietToTake: dietSelections?.take ?? prescription.dietToTake ?? [],
    dietToAvoid: dietSelections?.avoid ?? prescription.dietToAvoid ?? [],
    followUpDate: payload.followUpDate || "",
    metadata: {
      ...(prescription.metadata || {}),
      ...(payload.metadata || {})
    },
    medicines: (payload.medicines || []).map((medicine) => ({
      id: medicine.id || createId(),
      medicineId: medicine.medicineId || "",
      medicineName: medicine.medicineName || "",
      dose: medicine.dose || "",
      frequency: medicine.frequency || "",
      route: medicine.route || "oral",
      timing: medicine.timing || "",
      durationDays: Number(medicine.durationDays || 0),
      anupana: medicine.anupana || "",
      quantityDispensed: Number(medicine.quantityDispensed || 0),
      specialInstructions: medicine.specialInstructions || ""
    }))
  });

  const savedPrescription = await upsertPrescriptionRecord(prescription);
  const savedVisit = await updateVisitStatusRecord(visitId, "in_consultation", {
    workflowStage: "doctor",
    prescriptionSavedAt: new Date().toISOString(),
    prescriptionSavedBy: doctorId || visit.doctorId || "",
    forwardedTo: ["doctor"]
  });
  syncVisitMirror(savedVisit);
  syncPrescriptionMirror(savedPrescription);
  return savedPrescription;
}

// Discharge advice used to be seeded from the free-text diet field; fold the
// picked diet lists in so the summary still carries the dietary plan.
export function dietAdviceText(prescription) {
  const take = (prescription?.dietToTake || []).map((item) => item.name).join(", ");
  const avoid = (prescription?.dietToAvoid || []).map((item) => item.name).join(", ");

  return [
    prescription?.dietRecommendations || "",
    take ? `Diet to take: ${take}` : "",
    avoid ? `Diet to avoid: ${avoid}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

function therapyRowsFromPrescription(prescription, key) {
  const rows = prescription?.metadata?.therapyPlan?.[key];
  return Array.isArray(rows) ? rows : [];
}

function medicineRowsFromPrescription(prescription) {
  return (prescription?.medicines || []).map((medicine) => ({
    medicineName: medicine.medicineName,
    strengthRoute: medicine.route,
    dosage: medicine.dose,
    duration: medicine.durationDays ? `${medicine.durationDays} days` : "",
    remarks: medicine.specialInstructions || medicine.timing || ""
  }));
}

export async function saveDischargeSummary(visitId, payload, doctorId) {
  const visit = await getVisitById(visitId);
  const prescription = await findPrescriptionByVisitId(visitId);

  if (!prescription) {
    throw createError("Prescription must be saved before creating the discharge summary.");
  }

  let summary = await findDischargeSummaryByVisitId(visitId);

  if (!summary) {
    summary = {
      id: createId(),
      summaryNumber: "",
      visitId,
      prescriptionId: prescription.id,
      patientId: visit.patientId,
      patientName: visit.patientName,
      doctorId: doctorId || visit.doctorId,
      summaryDate: todayDate(),
      status: "draft"
    };
  }

  const vitalsAtDischarge = {
    bp: visit.vitalsBp || "",
    pulse: visit.vitalsPulse || "",
    temp: visit.vitalsTemp || "",
    spo2: visit.vitalsSpo2 || "",
    weight: visit.vitalsWeight || ""
  };

  const metadata = {
    vitalsAtDischarge,
    patient: payload.metadata?.patient || {},
    clinicalImprovement: payload.metadata?.clinicalImprovement || {},
    dietAdvice: payload.metadata?.dietAdvice || prescription.metadata?.dietPlan || {},
    lifestyleAdvice: payload.metadata?.lifestyleAdvice || prescription.metadata?.lifestylePlan || {},
    investigations: payload.metadata?.investigations || prescription.metadata?.investigations || {},
    medicinesAdministered: payload.metadata?.medicinesAdministered || medicineRowsFromPrescription(prescription),
    dischargeMedicines: payload.metadata?.dischargeMedicines || medicineRowsFromPrescription(prescription),
    yogaTherapy: payload.metadata?.yogaTherapy || therapyRowsFromPrescription(prescription, "yoga"),
    panchkarmaTherapy: payload.metadata?.panchkarmaTherapy || therapyRowsFromPrescription(prescription, "panchkarma"),
    specializedTherapy: payload.metadata?.specializedTherapy || therapyRowsFromPrescription(prescription, "specialized"),
    forwardedTo: ["reception", "nursing"],
    forwardedAt: payload.status === "forwarded" ? new Date().toISOString() : summary.metadata?.forwardedAt || ""
  };

  Object.assign(summary, {
    prescriptionId: prescription.id,
    patientId: visit.patientId,
    patientName: visit.patientName,
    doctorId: doctorId || visit.doctorId,
    summaryDate: payload.summaryDate || summary.summaryDate || todayDate(),
    status: payload.status || summary.status || "draft",
    clinicalCourse: payload.clinicalCourse ?? summary.clinicalCourse ?? "",
    finalDiagnosis: payload.finalDiagnosis ?? prescription.diagnosis ?? "",
    conditionOnDischarge: payload.conditionOnDischarge ?? summary.conditionOnDischarge ?? "stable",
    advice: payload.advice ?? dietAdviceText(prescription),
    followUpDate: payload.followUpDate ?? prescription.followUpDate ?? "",
    metadata
  });

  return upsertDischargeSummaryRecord(summary);
}

export async function completeVisit(visitId, actor = {}) {
  const visit = await getVisitById(visitId);
  const prescription = await findPrescriptionByVisitId(visitId);

  if (!prescription) {
    throw createError("Prescription must be saved before completing and forwarding the OPD visit.");
  }

  const savedVisit = await updateVisitStatusRecord(visitId, "completed", {
    workflowStage: "pharmacy_reception",
    forwardedTo: ["pharmacy", "reception"],
    doctorCompletedAt: new Date().toISOString(),
    doctorCompletedBy: actor.sub || "",
    ...workflowMetadata({ reason: "Consultation completed" }, actor, "opd:complete")
  });
  syncVisitMirror(savedVisit);
  if (visit.appointmentId) {
    await updateAppointmentStatus(visit.appointmentId, { status: "completed", note: `Completed from OPD visit ${visit.opdNumber}` }, actor);
  }

  return savedVisit;
}

export async function updateVisitWorkflowStatus(visitId, payload = {}, actor = {}) {
  const visit = await getVisitById(visitId);
  const action = String(payload.action || "").trim().toLowerCase();
  const actionMap = {
    hold: "waiting",
    requeue: "waiting",
    cancel: "cancelled",
    reopen: "waiting",
    start: "in_consultation",
    complete: "completed"
  };

  if (!actionMap[action]) {
    throw createError("Invalid OPD workflow action.");
  }

  if (visit.status === "completed" && action !== "reopen") {
    throw createError("Completed OPD visits must be reopened before further action.");
  }

  const metadata = appendWorkflowMetadata(visit.metadata, payload, actor, `opd:${action}`);
  metadata.queueStatus = action === "hold" ? "hold" : action === "requeue" ? "waiting" : metadata.queueStatus || "";

  const savedVisit = await updateVisitStatusRecord(visitId, actionMap[action], metadata);
  syncVisitMirror(savedVisit);

  if (visit.appointmentId && ["cancel", "complete"].includes(action)) {
    await updateAppointmentStatus(visit.appointmentId, {
      status: action === "cancel" ? "cancelled" : "completed",
      reason: metadata.workflow.reason,
      note: metadata.workflow.note || metadata.workflow.reason
    }, actor);
  }

  return savedVisit;
}

export async function createVisitLabOrder(visitId, payload, userId) {
  const visit = await getVisitById(visitId);

  if (!visit.patientId) {
    throw createError("Lab order can only be created for a registered patient linked to this OPD visit.");
  }

  if (!payload.tests?.length) {
    throw createError("At least one lab test is required.");
  }

  return createLabOrder({
    visitId: visit.id,
    patientId: visit.patientId,
    patientName: visit.patientName,
    orderedBy: userId || visit.doctorId,
    priority: payload.priority || "routine",
    tests: payload.tests
  });
}

export async function referVisitToIpd(visitId, payload, userId) {
  const visit = await getVisitById(visitId);

  if (!visit.patientId) {
    throw createError("IPD referral requires a registered patient linked to this OPD visit.");
  }

  const admission = await admitPatient(
    {
      patientId: visit.patientId,
      roomId: payload.roomId,
      bedId: payload.bedId,
      attendingDoctorId: payload.attendingDoctorId || visit.doctorId,
      reasonForAdmission: payload.reasonForAdmission || visit.chiefComplaint || "Referred from OPD",
      diagnosis: payload.diagnosis || "",
      expectedDischargeDate: payload.expectedDischargeDate || "",
      admissionSource: "opd",
      admissionType: payload.admissionType || "ipd",
      initialNote: payload.initialNote || `Referred from OPD visit ${visit.opdNumber}`
    },
    userId
  );

  const savedVisit = await updateVisitStatusRecord(visitId, "completed", {
    referredIpdAdmissionId: admission.id,
    referredIpdAdmissionNumber: admission.admissionNumber,
    referredAt: new Date().toISOString()
  });
  syncVisitMirror(savedVisit);
  if (visit.appointmentId) {
    await updateAppointmentStatus(visit.appointmentId, { status: "completed", note: `Referred to IPD from OPD visit ${visit.opdNumber}` });
  }

  return {
    visit: savedVisit,
    admission
  };
}

export async function getOpdMasters() {
  const labMasters = await getLabMasters();
  const dietItems = await listDietItemRecords();

  return {
    doctors: await listDoctors(),
    medicines: getMedicineMasters(),
    labTests: labMasters.tests,
    dietItems: {
      take: dietItems.filter((item) => item.appliesTo !== "avoid"),
      avoid: dietItems.filter((item) => item.appliesTo !== "take")
    },
    nadiTypes: ["Vataja", "Pittaja", "Kaphaja", "Mixed"],
    agniStatuses: ["sama", "vishama", "tikshna", "manda"],
    koshthaTypes: ["mridu", "madhyama", "krura"],
    frequencies: ["OD", "BD", "TDS", "QID", "SOS"],
    routes: ["oral", "external", "nasya", "enema"],
    consultationFee: CONSULTATION_FEE,
    operatingHours: opdOperatingHours
  };
}
