import { db, createId } from "../../data/store.js";
import { createError } from "../../utils/errors.js";
import {
  findPatientById,
  findPatients,
  generateNextUhid,
  insertPatient,
  patientPhoneExists,
  updatePatientRecord
} from "./patients.repository.js";
import {
  findPatientDocumentById,
  findPatientDocuments,
  insertPatientDocument,
  softDeletePatientDocument
} from "./patientDocuments.repository.js";

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
  const documents = await findPatientDocuments(id);

  const appointmentHistory = db.appointments
    .filter((appointment) => appointment.patientId === id)
    .sort((a, b) => `${b.appointmentDate} ${b.appointmentTime}`.localeCompare(`${a.appointmentDate} ${a.appointmentTime}`));

  const opdVisits = db.opdVisits
    .filter((visit) => visit.patientId === id)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const assessments = db.ayurvedaAssessments
    .filter((assessment) => assessment.patientId === id)
    .sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate));

  const prescriptions = db.prescriptions
    .filter((prescription) => prescription.patientId === id)
    .sort((a, b) => b.prescriptionDate.localeCompare(a.prescriptionDate));

  const ipdAdmissions = db.ipdAdmissions
    .filter((admission) => admission.patientId === id)
    .sort((a, b) => `${b.admissionDate} ${b.admissionTime || ""}`.localeCompare(`${a.admissionDate} ${a.admissionTime || ""}`));

  const labOrders = db.labOrders
    .filter((order) => order.patientId === id)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  const panchkarmaSchedules = db.panchkarmaSchedules
    .filter((schedule) => schedule.patientId === id)
    .sort((a, b) => `${b.scheduledDate} ${b.scheduledTime || ""}`.localeCompare(`${a.scheduledDate} ${a.scheduledTime || ""}`));

  const bills = db.bills
    .filter((bill) => bill.patientId === id)
    .sort((a, b) => b.billDate.localeCompare(a.billDate));

  const dispensations = db.dispensations
    .filter((dispense) => dispense.patientId === id)
    .sort((a, b) => b.dispensedDate.localeCompare(a.dispensedDate));

  const payments = db.payments
    .filter((payment) => payment.patientId === id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

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
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    patient,
    appointments: appointmentHistory,
    opdVisits,
    assessments,
    prescriptions,
    ipdAdmissions,
    labOrders,
    panchkarmaSchedules,
    bills,
    dispensations,
    payments,
    documents,
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
  if (!payload.firstName || !payload.lastName || !payload.phone || !payload.dateOfBirth || !payload.gender) {
    throw createError("First name, last name, phone, date of birth, and gender are required.");
  }

  if (!payload.houseStreet && !payload.address) {
    throw createError("House/street or address is required.");
  }

  const phoneExists = await patientPhoneExists(payload.phone);

  if (phoneExists) {
    throw createError("A patient with this phone number already exists.");
  }

  const registrationDate = new Date().toISOString().slice(0, 10);
  const registrationTime = new Date().toTimeString().slice(0, 5);
  const address = buildAddress(payload);
  const cityDistrict = payload.cityDistrict?.trim() || payload.city?.trim() || "Sagar";

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
    lastName: payload.lastName.trim(),
    fullName: `${payload.firstName.trim()} ${payload.lastName.trim()}`,
    fatherName: payload.fatherName?.trim() || "",
    gender: payload.gender,
    dateOfBirth: payload.dateOfBirth,
    ageYears: calculateAge(payload.dateOfBirth),
    bloodGroup: payload.bloodGroup || "",
    maritalStatus: payload.maritalStatus || "",
    occupation: payload.occupation || "",
    phone: payload.phone.trim(),
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
  const nextDateOfBirth = payload.dateOfBirth ?? patient.dateOfBirth;
  const nextCityDistrict = payload.cityDistrict ?? payload.city ?? patient.cityDistrict ?? patient.city;

  Object.assign(patient, {
    registrationNumber: payload.registrationNumber ?? patient.registrationNumber,
    opdIpdNumber: payload.opdIpdNumber ?? patient.opdIpdNumber,
    patientType: payload.patientType ?? patient.patientType,
    title: payload.title ?? patient.title,
    firstName: payload.firstName ?? patient.firstName,
    lastName: payload.lastName ?? patient.lastName,
    fullName: `${payload.firstName ?? patient.firstName} ${payload.lastName ?? patient.lastName}`,
    fatherName: payload.fatherName ?? patient.fatherName,
    dateOfBirth: nextDateOfBirth,
    ageYears: calculateAge(nextDateOfBirth),
    gender: payload.gender ?? patient.gender,
    bloodGroup: payload.bloodGroup ?? patient.bloodGroup,
    maritalStatus: payload.maritalStatus ?? patient.maritalStatus,
    occupation: payload.occupation ?? patient.occupation,
    phone: payload.phone ?? patient.phone,
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
