import { db, createId } from "../../data/store.js";
import { createError } from "../../utils/errors.js";
import {
  findPatientById,
  findPatients,
  generateNextUhid,
  insertPatient,
  patientPhoneExists,
  softDeletePatientRecord,
  updatePatientRecord
} from "./patients.repository.js";
import {
  findPatientDocumentById,
  findPatientDocuments,
  insertPatientDocument,
  softDeletePatientDocument
} from "./patientDocuments.repository.js";
import { listCertificateRecords } from "../certificates/certificates.repository.js";
import { listAppointmentRecords } from "../appointments/appointments.repository.js";
import { listBillRecords, listPaymentRecords } from "../billing/billing.repository.js";
import { listAdmissionRecords } from "../ipd/ipd.repository.js";
import { listLabOrderRecords } from "../laboratory/laboratory.repository.js";
import { listAssessmentRecords, listGeneralExaminationRecords, listHistoryTakingRecords, listPrescriptionRecords, listSystemicExaminationRecords, listVisitRecords } from "../opd/opd.repository.js";
import { listSessionRecords } from "../panchkarma/panchkarma.repository.js";
import { listDispensationRecords } from "../pharmacy/pharmacy.repository.js";

const MAX_PATIENT_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_PATIENT_DOCUMENT_TYPES = new Set(["application/pdf"]);

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return "";
  }

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return "";
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function normalizeAgeYears(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const age = Number(value);
  if (!Number.isFinite(age) || age < 0 || age > 130) {
    throw createError("Age must be a valid number between 0 and 130.");
  }

  return Math.floor(age);
}

function buildAddress(payload) {
  const segments = [payload.houseStreet, payload.areaVillage, payload.cityDistrict || payload.city, payload.state]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return payload.address?.trim() || segments.join(", ");
}

function nextRegistrationNumber() {
  return `REG-${new Date().getFullYear()}-${String(db.patients.length + 1).padStart(5, "0")}`;
}

async function nextDatabaseUhid(registrationDate) {
  return generateNextUhid(registrationDate);
}

function syncPatientMirror(patient) {
  const index = db.patients.findIndex((entry) => entry.id === patient.id);

  if (index >= 0) {
    db.patients[index] = patient;
    return;
  }

  db.patients.unshift(patient);
}

function toDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

export async function listPatients(query = {}) {
  return findPatients(query);
}

export async function getPatientById(id) {
  const patient = await findPatientById(id);

  if (!patient) {
    throw createError("Patient not found.", 404);
  }

  return patient;
}

export async function getPatientHistory(id) {
  const patient = await getPatientById(id);

  // Everything here reads straight from the database. This used to filter the
  // in-memory mirrors, which are only ever populated by whatever the running
  // process happened to write - so a patient's vitals, prescriptions and bills
  // vanished from their profile after every restart.
  const [
    documents,
    certificates,
    appointmentHistory,
    opdVisits,
    generalExaminations,
    systemicExaminations,
    historyTakingRecords,
    assessments,
    prescriptions,
    ipdAdmissions,
    labOrders,
    panchkarmaSchedules,
    bills,
    dispensations,
    payments
  ] = await Promise.all([
    findPatientDocuments(id),
    listCertificateRecords({ patientId: id }),
    listAppointmentRecords({ patientId: id }),
    listVisitRecords({ patientId: id }),
    listGeneralExaminationRecords({ patientId: id }),
    listSystemicExaminationRecords({ patientId: id }),
    listHistoryTakingRecords({ patientId: id }),
    listAssessmentRecords({ patientId: id }),
    listPrescriptionRecords({ patientId: id }),
    listAdmissionRecords({ patientId: id }),
    listLabOrderRecords({ patientId: id }),
    listSessionRecords({ patientId: id }),
    listBillRecords({ patientId: id }),
    listDispensationRecords({ patientId: id }),
    listPaymentRecords({ patientId: id })
  ]);

  appointmentHistory.sort((a, b) =>
    `${b.appointmentDate} ${b.appointmentTime}`.localeCompare(`${a.appointmentDate} ${a.appointmentTime}`)
  );
  opdVisits.sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
  generalExaminations.sort((a, b) => String(b.examDate).localeCompare(String(a.examDate)));
  systemicExaminations.sort((a, b) => String(b.examDate).localeCompare(String(a.examDate)));
  historyTakingRecords.sort((a, b) => String(b.historyDate).localeCompare(String(a.historyDate)));
  assessments.sort((a, b) => String(b.assessmentDate).localeCompare(String(a.assessmentDate)));
  prescriptions.sort((a, b) => String(b.prescriptionDate).localeCompare(String(a.prescriptionDate)));
  ipdAdmissions.sort((a, b) =>
    `${b.admissionDate} ${b.admissionTime || ""}`.localeCompare(`${a.admissionDate} ${a.admissionTime || ""}`)
  );
  labOrders.sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
  panchkarmaSchedules.sort((a, b) =>
    `${b.scheduledDate} ${b.scheduledTime || ""}`.localeCompare(`${a.scheduledDate} ${a.scheduledTime || ""}`)
  );
  bills.sort((a, b) => String(b.billDate).localeCompare(String(a.billDate)));
  dispensations.sort((a, b) => String(b.dispensedDate).localeCompare(String(a.dispensedDate)));
  payments.sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));

  const timeline = [
    ...appointmentHistory.map((appointment) => ({
      id: `apt-${appointment.id}`,
      type: "appointment",
      date: appointment.appointmentDate,
      title: appointment.appointmentNumber,
      summary: `${appointment.department} appointment - ${appointment.status}`,
      detail: appointment.chiefComplaint || "General consultation"
    })),
    ...opdVisits.map((visit) => ({
      id: `opd-${visit.id}`,
      type: "opd_visit",
      date: visit.visitDate,
      title: visit.opdNumber,
      summary: `OPD visit - ${visit.status}`,
      detail: visit.chiefComplaint || "Consultation visit"
    })),
    ...generalExaminations.map((examination) => ({
      id: `general-exam-${examination.id}`,
      type: "general_examination",
      date: examination.examDate,
      title: "General Examination",
      summary: `BP ${examination.vitalsBp || "-"} | Pulse ${examination.vitalsPulse || "-"} | SpO₂ ${examination.vitalsSpo2 || "-"}%`,
      detail: `BMI ${examination.bmi || "-"}${examination.bmiCategory ? ` (${examination.bmiCategory})` : ""} | ${examination.physicalExam || "Clinical examination recorded"}`
    })),
    ...systemicExaminations.map((examination) => ({
      id: `systemic-exam-${examination.id}`,
      type: "systemic_examination",
      date: examination.examDate,
      title: "Systemic Examination",
      summary: `CVS ${examination.heartSoundS1 || "-"}/${examination.heartSoundS2 || "-"} | RS ${examination.breathSounds || "-"} | GIT ${examination.abdomenShape || "-"}`,
      detail: examination.systemicNotes || examination.cnsConsciousness || examination.mskSpecialTests || "System-wise examination recorded"
    })),
    ...historyTakingRecords.map((history) => ({
      id: `history-taking-${history.id}`,
      type: "history_taking",
      date: history.historyDate,
      title: "History Taking",
      summary: history.complaints.filter((item) => item.complaint).slice(0, 3).map((item) => item.complaint).join(" | ") || "Structured history recorded",
      detail: history.historyNotes || history.previousSimilarComplaints || "Clinical history saved"
    })),
    ...assessments.map((assessment) => ({
      id: `ayu-${assessment.id}`,
      type: "assessment",
      date: assessment.assessmentDate,
      title: "Ayurvedic Assessment",
      summary: `${assessment.prakritiDominant || "Clinical"} dosha review`,
      detail: assessment.vikritiAssessment || assessment.observations || "Assessment recorded"
    })),
    ...prescriptions.map((prescription) => ({
      id: `rx-${prescription.id}`,
      type: "prescription",
      date: prescription.prescriptionDate,
      title: prescription.prescriptionNumber,
      summary: "Prescription issued",
      detail: prescription.diagnosis
    })),
    ...ipdAdmissions.map((admission) => ({
      id: `ipd-${admission.id}`,
      type: "ipd_admission",
      date: admission.dischargeSummary?.dischargeDate || admission.admissionDate,
      title: admission.admissionNumber,
      summary: `IPD ${admission.status} - ${admission.reasonForAdmission}`,
      detail: `${admission.diagnosis || "Clinical observation"}${admission.dischargeSummary?.billId ? ` | Bill: ${admission.dischargeSummary.billId}` : ""}`
    })),
    ...labOrders.map((order) => ({
      id: `lab-${order.id}`,
      type: "lab_order",
      date: order.orderDate,
      title: order.orderNumber,
      summary: `Lab order - ${order.status}`,
      detail: order.tests.map((test) => test.testName).join(", ")
    })),
    ...panchkarmaSchedules.map((schedule) => ({
      id: `pk-${schedule.id}`,
      type: "panchkarma",
      date: schedule.scheduledDate,
      title: schedule.scheduleNumber,
      summary: `${schedule.therapyName} - ${schedule.status}`,
      detail: schedule.outcome || schedule.complaint || "Panchkarma session scheduled"
    })),
    ...bills.map((bill) => ({
      id: `bill-${bill.id}`,
      type: "bill",
      date: bill.billDate,
      title: bill.billNumber,
      summary: `Billing - ${bill.paymentStatus}`,
      detail: `Rs. ${bill.totalAmount}`
    })),
    ...dispensations.map((dispense) => ({
      id: `disp-${dispense.id}`,
      type: "dispensation",
      date: dispense.dispensedDate.slice(0, 10),
      title: dispense.dispenseNumber,
      summary: "Pharmacy dispensing completed",
      detail: dispense.items.map((item) => `${item.medicineName} x${item.quantity}`).join(", ")
    })),
    ...payments.map((payment) => ({
      id: `pay-${payment.id}`,
      type: "payment",
      date: payment.paymentDate.slice(0, 10),
      title: payment.receiptNumber,
      summary: `Payment received via ${payment.paymentMode}`,
      detail: `Rs. ${payment.amount}`
    })),
    ...documents.map((document) => ({
      id: `doc-${document.id}`,
      type: "document",
      date: toDateLabel(document.createdAt),
      title: document.title,
      summary: `${document.documentType.replaceAll("_", " ")} PDF uploaded`,
      detail: document.notes || document.fileName
    })),
    ...certificates.map((certificate) => ({
      id: `cert-${certificate.id}`,
      type: "medical_certificate",
      date: certificate.certificateDate,
      title: certificate.certificateNumber,
      summary: `${certificate.certificateType.replaceAll("_", " ")} certificate issued`,
      detail: certificate.diagnosis || certificate.activity || certificate.treatment || "Medical certificate"
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    patient,
    appointments: appointmentHistory,
    opdVisits,
    generalExaminations,
    systemicExaminations,
    historyTakingRecords,
    assessments,
    prescriptions,
    ipdAdmissions,
    labOrders,
    panchkarmaSchedules,
    bills,
    dispensations,
    payments,
    documents,
    certificates,
    timeline
  };
}

export async function listPatientDocuments(patientId) {
  await getPatientById(patientId);
  return findPatientDocuments(patientId);
}

export async function uploadPatientDocument(patientId, payload, uploadedBy) {
  await getPatientById(patientId);

  const title = String(payload.title || "").trim();
  const fileName = String(payload.fileName || "").trim();
  const mimeType = String(payload.mimeType || "").trim().toLowerCase();
  const base64Data = String(payload.fileBase64 || "").trim();

  if (!title || !fileName || !mimeType || !base64Data) {
    throw createError("Document title, file name, file type, and file data are required.");
  }

  if (!ALLOWED_PATIENT_DOCUMENT_TYPES.has(mimeType) || !fileName.toLowerCase().endsWith(".pdf")) {
    throw createError("Only PDF documents can be uploaded.");
  }

  let fileData;
  try {
    fileData = Buffer.from(base64Data, "base64");
  } catch {
    throw createError("Uploaded document data is invalid.");
  }

  if (!fileData.length || fileData.length > MAX_PATIENT_DOCUMENT_BYTES) {
    throw createError("PDF must be larger than 0 bytes and not more than 8 MB.");
  }

  const document = await insertPatientDocument({
    patientId,
    title,
    documentType: payload.documentType || "old_prescription",
    fileName,
    mimeType,
    fileSize: fileData.length,
    fileData,
    notes: payload.notes || "",
    uploadedBy,
    metadata: {
      source: payload.source || "patient_profile_upload"
    }
  });

  return document;
}

export async function getPatientDocumentFile(patientId, documentId) {
  await getPatientById(patientId);
  const document = await findPatientDocumentById(patientId, documentId);

  if (!document) {
    throw createError("Patient document not found.", 404);
  }

  return document;
}

export async function deletePatientDocument(patientId, documentId) {
  await getPatientById(patientId);
  const deleted = await softDeletePatientDocument(patientId, documentId);

  if (!deleted) {
    throw createError("Patient document not found.", 404);
  }

  return { id: documentId };
}

export async function createPatient(payload, createdBy) {
  if (!payload.firstName || !String(payload.firstName).trim()) {
    throw createError("Patient name is required.");
  }

  if (!payload.houseStreet && !payload.address && !payload.areaVillage && !payload.cityDistrict && !payload.city) {
    throw createError("Address, area/village, or city is required.");
  }

  const normalizedPhone = String(payload.phone || "").trim();
  const phoneExists = normalizedPhone ? await patientPhoneExists(normalizedPhone) : false;

  if (phoneExists) {
    throw createError("A patient with this phone number already exists.");
  }

  const registrationDate = new Date().toISOString().slice(0, 10);
  const registrationTime = new Date().toTimeString().slice(0, 5);
  const address = buildAddress(payload);
  const cityDistrict = payload.cityDistrict?.trim() || payload.city?.trim() || "Sagar";

  const ageYears = payload.dateOfBirth ? calculateAge(payload.dateOfBirth) : normalizeAgeYears(payload.ageYears);

  const patient = {
    id: createId(),
    uhid: await nextDatabaseUhid(registrationDate),
    registrationNumber: nextRegistrationNumber(),
    opdIpdNumber: payload.opdIpdNumber?.trim() || "",
    registrationDate,
    registrationTime,
    patientType: payload.patientType || "new",
    title: payload.title || "Mr",
    firstName: payload.firstName.trim(),
    lastName: payload.lastName?.trim() || "",
    fullName: `${payload.firstName.trim()} ${payload.lastName?.trim() || ""}`.trim(),
    fatherName: payload.fatherName?.trim() || "",
    gender: payload.gender || "",
    dateOfBirth: payload.dateOfBirth || null,
    ageYears,
    bloodGroup: payload.bloodGroup || "",
    maritalStatus: payload.maritalStatus || "",
    occupation: payload.occupation || "",
    phone: normalizedPhone,
    altPhone: payload.altPhone || "",
    email: payload.email || "",
    houseStreet: payload.houseStreet?.trim() || "",
    areaVillage: payload.areaVillage?.trim() || "",
    cityDistrict,
    city: cityDistrict,
    state: payload.state || "Madhya Pradesh",
    pincode: payload.pincode || "",
    address,
    idType: payload.idType || "",
    idNumber: payload.idNumber || "",
    emergencyContactName: payload.emergencyContactName || "",
    emergencyContactPhone: payload.emergencyContactPhone || "",
    referredBy: payload.referredBy || "Front Desk",
    createdBy
  };

  const savedPatient = await insertPatient(patient);
  syncPatientMirror(savedPatient);
  return savedPatient;
}

export async function updatePatient(id, payload) {
  const patient = await getPatientById(id);
  const nextFirstName = String(payload.firstName ?? patient.firstName ?? "").trim();
  const nextLastName = String(payload.lastName ?? patient.lastName ?? "").trim();
  const nextPhone = String(payload.phone ?? patient.phone ?? "").trim();

  if (!nextFirstName) {
    throw createError("Patient name is required.");
  }

  if (nextPhone && nextPhone !== patient.phone && await patientPhoneExists(nextPhone, id)) {
    throw createError("A patient with this phone number already exists.");
  }

  const nextDateOfBirth = payload.dateOfBirth ?? patient.dateOfBirth;
  const nextAgeYears = nextDateOfBirth ? calculateAge(nextDateOfBirth) : normalizeAgeYears(payload.ageYears ?? patient.ageYears);
  const nextCityDistrict = payload.cityDistrict ?? payload.city ?? patient.cityDistrict ?? patient.city;

  Object.assign(patient, {
    registrationNumber: payload.registrationNumber ?? patient.registrationNumber,
    opdIpdNumber: payload.opdIpdNumber ?? patient.opdIpdNumber,
    patientType: payload.patientType ?? patient.patientType,
    title: payload.title ?? patient.title,
    firstName: nextFirstName,
    lastName: nextLastName,
    fullName: `${nextFirstName} ${nextLastName}`.trim(),
    fatherName: payload.fatherName ?? patient.fatherName,
    dateOfBirth: nextDateOfBirth,
    ageYears: nextAgeYears,
    gender: payload.gender ?? patient.gender,
    bloodGroup: payload.bloodGroup ?? patient.bloodGroup,
    maritalStatus: payload.maritalStatus ?? patient.maritalStatus,
    occupation: payload.occupation ?? patient.occupation,
    phone: nextPhone,
    altPhone: payload.altPhone ?? patient.altPhone,
    email: payload.email ?? patient.email,
    houseStreet: payload.houseStreet ?? patient.houseStreet,
    areaVillage: payload.areaVillage ?? patient.areaVillage,
    address: buildAddress({
      address: payload.address ?? patient.address,
      houseStreet: payload.houseStreet ?? patient.houseStreet,
      areaVillage: payload.areaVillage ?? patient.areaVillage,
      cityDistrict: nextCityDistrict,
      state: payload.state ?? patient.state,
      city: nextCityDistrict
    }),
    cityDistrict: nextCityDistrict,
    city: nextCityDistrict,
    state: payload.state ?? patient.state,
    pincode: payload.pincode ?? patient.pincode,
    idType: payload.idType ?? patient.idType,
    idNumber: payload.idNumber ?? patient.idNumber,
    emergencyContactName: payload.emergencyContactName ?? patient.emergencyContactName,
    emergencyContactPhone: payload.emergencyContactPhone ?? patient.emergencyContactPhone,
    referredBy: payload.referredBy ?? patient.referredBy
  });

  const savedPatient = await updatePatientRecord(id, patient);
  syncPatientMirror(savedPatient);
  return savedPatient;
}

export async function deletePatient(id) {
  const deletedPatient = await softDeletePatientRecord(id);

  if (!deletedPatient) {
    throw createError("Patient not found.", 404);
  }

  const index = db.patients.findIndex((entry) => entry.id === deletedPatient.id);
  if (index >= 0) {
    db.patients.splice(index, 1);
  }

  return deletedPatient;
}
