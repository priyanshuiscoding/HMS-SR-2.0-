import { createId } from "../../data/store.js";
import { createError } from "../../utils/errors.js";
import { findUserById } from "../users/users.repository.js";
import { createPatient, getPatientById } from "../patients/patients.service.js";
import {
  findCertificateRecordById,
  insertCertificateRecord,
  listCertificateRecords
} from "./certificates.repository.js";

const certificateTypes = new Set([
  "fitness",
  "sick_leave",
  "insurance",
  "birth",
  "death",
  "disability",
  "treatment",
  "panchakarma",
  "medical_records",
  "wound",
  "post_mortem",
  "mlc",
  "accident_wound"
]);

const medicoLegalTypes = new Set(["wound", "post_mortem", "mlc", "accident_wound"]);

const patientCentricTypes = new Set([
  "birth",
  "death",
  "disability",
  "treatment",
  "panchakarma",
  "medical_records"
]);

function buildPatientCentricMetadata(payload) {
  return {
    // Birth
    childName: normalizeText(payload.childName),
    babySex: normalizeText(payload.babySex),
    birthDateTime: payload.birthDateTime || null,
    placeOfBirth: normalizeText(payload.placeOfBirth),
    fatherName: normalizeText(payload.fatherName),
    motherName: normalizeText(payload.motherName),
    birthWeight: normalizeText(payload.birthWeight),
    deliveryType: normalizeText(payload.deliveryType),
    // Death
    deathDateTime: payload.deathDateTime || null,
    placeOfDeath: normalizeText(payload.placeOfDeath),
    informantName: normalizeText(payload.informantName),
    causeOfDeath: normalizeText(payload.causeOfDeath),
    // Disability
    disabilityType: normalizeText(payload.disabilityType),
    disabilityPercentage: normalizeText(payload.disabilityPercentage),
    disabilityStatus: normalizeText(payload.disabilityStatus),
    boardMembers: normalizeText(payload.boardMembers),
    reassessmentDate: payload.reassessmentDate || null,
    // Treatment
    admissionType: normalizeText(payload.admissionType),
    therapiesAdministered: normalizeText(payload.therapiesAdministered),
    // Panchakarma
    panchakarmaTherapies: normalizeText(payload.panchakarmaTherapies),
    courseFrom: payload.courseFrom || null,
    courseTo: payload.courseTo || null,
    numberOfSessions: normalizeText(payload.numberOfSessions),
    medicinesUsed: normalizeText(payload.medicinesUsed),
    // Copy of medical records
    recordsProvided: normalizeText(payload.recordsProvided),
    periodFrom: payload.periodFrom || null,
    periodTo: payload.periodTo || null,
    purpose: normalizeText(payload.purpose),
    numberOfPages: normalizeText(payload.numberOfPages),
    requestedBy: normalizeText(payload.requestedBy)
  };
}

function buildMedicoLegalMetadata(payload) {
  return {
    policeStation: normalizeText(payload.policeStation),
    mlcNumber: normalizeText(payload.mlcNumber),
    broughtBy: normalizeText(payload.broughtBy),
    incidentDate: payload.incidentDate || null,
    incidentPlace: normalizeText(payload.incidentPlace),
    examinationDateTime: payload.examinationDateTime || null,
    injuryDetails: normalizeText(payload.injuryDetails),
    natureOfInjury: normalizeText(payload.natureOfInjury),
    weaponType: normalizeText(payload.weaponType),
    causeOfDeath: normalizeText(payload.causeOfDeath),
    identificationMarks: normalizeText(payload.identificationMarks)
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeAge(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const age = Number(value);
  if (!Number.isFinite(age) || age < 0 || age > 130) {
    throw createError("Patient age must be between 0 and 130.");
  }

  return Math.floor(age);
}

function daysInclusive(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return null;
  }

  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

async function resolvePatient(payload, createdBy) {
  if (payload.patientId) {
    const patient = await getPatientById(payload.patientId);
    return { patient, createdNewPatient: false };
  }

  if (!payload.createPatient) {
    return { patient: null, createdNewPatient: false };
  }

  const patient = await createPatient({
    firstName: normalizeText(payload.patientFirstName || payload.patientName),
    lastName: normalizeText(payload.patientLastName),
    ageYears: payload.patientAge,
    gender: payload.patientGender || "",
    phone: normalizeText(payload.patientMobile),
    address: normalizeText(payload.patientAddress || "Recorded from medical certificate"),
    cityDistrict: normalizeText(payload.patientCity || "Sagar"),
    state: normalizeText(payload.patientState || "Madhya Pradesh"),
    referredBy: "Medical certificate"
  }, createdBy);

  return { patient, createdNewPatient: true };
}

function fullPatientName(payload, patient) {
  if (patient) {
    return patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  }

  return normalizeText(payload.patientName || `${payload.patientFirstName || ""} ${payload.patientLastName || ""}`);
}

export async function listCertificates(query = {}) {
  return listCertificateRecords(query);
}

export async function getCertificate(id) {
  const certificate = await findCertificateRecordById(id);

  if (!certificate) {
    throw createError("Medical certificate not found.", 404);
  }

  return certificate;
}

export async function createCertificate(payload, createdBy) {
  const certificateType = normalizeText(payload.certificateType);

  if (!certificateTypes.has(certificateType)) {
    throw createError("Select a valid certificate type.");
  }

  const { patient, createdNewPatient } = await resolvePatient(payload, createdBy);
  const doctorId = payload.doctorId || createdBy;
  const doctor = doctorId ? await findUserById(doctorId) : null;
  const patientName = fullPatientName(payload, patient);

  if (!patientName) {
    throw createError("Patient name is required.");
  }

  if (!doctor && !payload.doctorName) {
    throw createError("Doctor is required.");
  }

  const certificate = {
    id: createId(),
    certificateType,
    patientId: patient?.id || null,
    patientName,
    patientAge: normalizeAge(patient?.ageYears ?? payload.patientAge),
    patientGender: patient?.gender || payload.patientGender || "",
    patientMobile: patient?.phone || normalizeText(payload.patientMobile),
    uhid: patient?.uhid || normalizeText(payload.uhid),
    doctorId: doctor?.id || null,
    doctorName: doctor?.fullName || normalizeText(payload.doctorName),
    doctorRegistrationNumber: normalizeText(payload.doctorRegistrationNumber || doctor?.metadata?.registrationNumber || doctor?.metadata?.regNo),
    certificateDate: payload.certificateDate || todayIso(),
    diagnosis: normalizeText(payload.diagnosis),
    activity: normalizeText(payload.activity),
    fitDate: payload.fitDate || null,
    leaveFromDate: payload.leaveFromDate || null,
    leaveToDate: payload.leaveToDate || null,
    totalLeaveDays: normalizeAge(payload.totalLeaveDays) || daysInclusive(payload.leaveFromDate, payload.leaveToDate),
    admissionDate: payload.admissionDate || null,
    dischargeDate: payload.dischargeDate || null,
    treatment: normalizeText(payload.treatment),
    status: payload.status || "issued",
    createdBy,
    metadata: {
      createdNewPatient,
      source: "medical_certificates",
      patientAddress: normalizeText(payload.patientAddress),
      notes: normalizeText(payload.notes),
      ...(medicoLegalTypes.has(certificateType) ? { medicoLegal: buildMedicoLegalMetadata(payload) } : {}),
      ...(patientCentricTypes.has(certificateType) ? { patientCentric: buildPatientCentricMetadata(payload) } : {})
    }
  };

  if (certificateType === "fitness" && !certificate.fitDate) {
    throw createError("Fit from date is required for medical fitness certificates.");
  }

  if (certificateType === "sick_leave" && (!certificate.diagnosis || !certificate.leaveFromDate || !certificate.leaveToDate)) {
    throw createError("Diagnosis and leave dates are required for sick leave certificates.");
  }

  if (certificateType === "insurance" && (!certificate.admissionDate || !certificate.dischargeDate || !certificate.diagnosis || !certificate.treatment)) {
    throw createError("Admission date, discharge date, diagnosis, and treatment are required for insurance certificates.");
  }

  if (medicoLegalTypes.has(certificateType)) {
    const medicoLegal = certificate.metadata.medicoLegal;

    if (certificateType === "post_mortem" && !medicoLegal.causeOfDeath) {
      throw createError("Cause of death is required for post mortem certificates.");
    }

    if (certificateType !== "post_mortem" && !medicoLegal.injuryDetails) {
      throw createError("Injury / incident details are required for medico-legal certificates.");
    }
  }

  if (patientCentricTypes.has(certificateType)) {
    const patientCentric = certificate.metadata.patientCentric;

    if (certificateType === "birth" && !patientCentric.birthDateTime) {
      throw createError("Date and time of birth is required for birth certificates.");
    }

    if (certificateType === "death" && (!patientCentric.deathDateTime || !patientCentric.causeOfDeath)) {
      throw createError("Date of death and cause of death are required for death certificates.");
    }

    if (certificateType === "disability" && (!patientCentric.disabilityType || !certificate.diagnosis)) {
      throw createError("Disability type and diagnosis are required for disability certificates.");
    }

    if (certificateType === "treatment" && (!certificate.diagnosis || !certificate.treatment)) {
      throw createError("Diagnosis and treatment details are required for treatment certificates.");
    }

    if (certificateType === "panchakarma" && !patientCentric.panchakarmaTherapies) {
      throw createError("Panchakarma therapy details are required for Panchakarma certificates.");
    }

    if (certificateType === "medical_records" && !patientCentric.recordsProvided) {
      throw createError("List of records provided is required for a copy of medical records.");
    }
  }

  return insertCertificateRecord(certificate);
}
