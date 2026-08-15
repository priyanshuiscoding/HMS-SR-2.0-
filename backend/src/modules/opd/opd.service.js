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
import { listBillRecords } from "../billing/billing.repository.js";
import { listLabOrderRecords } from "../laboratory/laboratory.repository.js";
import { createLabOrder, getLabMasters } from "../laboratory/laboratory.service.js";
import { findPatientById } from "../patients/patients.repository.js";
import { listDoctors } from "../users/users.service.js";
import { ayurvedaParikshanFromPayload } from "./ayurveda.parikshan.js";
import {
  createVisitRecord,
  findAssessmentByVisitId,
  findDischargeSummaryByVisitId,
  findGeneralExaminationByVisitId,
  findHistoryTakingByVisitId,
  findSystemicExaminationByVisitId,
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
  updateVisitChiefComplaintRecord,
  updateVisitVitalsRecord,
  upsertAssessmentRecord,
  upsertDischargeSummaryRecord,
  upsertGeneralExaminationRecord,
  upsertHistoryTakingRecord,
  mergePrescriptionMetadataByVisitId,
  upsertSystemicExaminationRecord,
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

function normalizePrescriptionTherapyPlan(therapyPlan = {}) {
  return {
    ...therapyPlan,
    panchkarma: (therapyPlan.panchkarma || []).map((row) => ({
      ...row,
      procedure: ["shiroabhyanga", "shiro abhyanga", "shiroabhayaya"].includes(String(row.procedure || "").toLowerCase())
        ? "Vaman/Virchak"
        : row.procedure
    })),
    specialized: (therapyPlan.specialized || []).map((row) => ({
      ...row,
      therapy: ["shirodhara", "shiro dhara"].includes(String(row.therapy || "").toLowerCase())
        ? "Abhayans"
        : row.therapy
    }))
  };
}

function prescriptionMetadata(existingMetadata = {}, incomingMetadata = {}) {
  const allowedIncomingMetadata = { ...(incomingMetadata || {}) };
  delete allowedIncomingMetadata.investigations;
  const metadata = {
    ...(existingMetadata || {}),
    ...allowedIncomingMetadata
  };

  if (existingMetadata?.investigations) {
    metadata.investigations = existingMetadata.investigations;
  } else {
    delete metadata.investigations;
  }

  if (metadata.therapyPlan) {
    metadata.therapyPlan = normalizePrescriptionTherapyPlan(metadata.therapyPlan);
  }

  return metadata;
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

  if (!appointment.patientId) {
    throw createError("Patient is not registered. Please register and link the patient before starting OPD.", 409);
  }

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
  const [
    doctors,
    patient,
    assessment,
    generalExamination,
    historyTaking,
    systemicExamination,
    prescription,
    dischargeSummary,
    labOrders,
    bills
  ] = await Promise.all([
    listDoctors(),
    visit.patientId ? findPatientById(visit.patientId) : Promise.resolve(null),
    findAssessmentByVisitId(visitId),
    findGeneralExaminationByVisitId(visitId),
    findHistoryTakingByVisitId(visitId),
    findSystemicExaminationByVisitId(visitId),
    findPrescriptionByVisitId(visitId),
    findDischargeSummaryByVisitId(visitId),
    listLabOrderRecords({ visitId }),
    listBillRecords({ visitId })
  ]);

  return {
    visit,
    patient,
    doctorName: doctors.find((doctor) => doctor.id === visit.doctorId)?.fullName || "Unassigned",
    generalExamination,
    historyTaking,
    systemicExamination,
    assessment,
    prescription,
    dischargeSummary,
    labOrders,
    bills
  };
}

function clinicalNumber(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createError(`${label} must be a valid number between ${min} and ${max}.`);
  }

  return integer ? Math.round(number) : number;
}

function adultBmiCategory(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function existingBpParts(value) {
  const [systolic = "", diastolic = ""] = String(value || "").split(/[\/\\-]/).map((part) => part.trim());
  return { systolic, diastolic };
}

function generalExaminationFromPayload(payload, visit, actor) {
  const existingBp = existingBpParts(payload.vitalsBp);
  const weightKg = clinicalNumber(payload.vitalsWeight, "Weight", { max: 500 });
  const heightCm = clinicalNumber(payload.vitalsHeight, "Height", { max: 300 });
  const waistCircumference = clinicalNumber(payload.waistCircumference, "Waist circumference", { max: 400 });
  const hipCircumference = clinicalNumber(payload.hipCircumference, "Hip circumference", { max: 400 });
  const bmi = weightKg && heightCm ? Number((weightKg / ((heightCm / 100) ** 2)).toFixed(2)) : null;
  const waistHipRatio = waistCircumference && hipCircumference
    ? Number((waistCircumference / hipCircumference).toFixed(3))
    : null;

  return {
    id: createId(),
    patientId: visit.patientId,
    visitId: visit.id,
    examinedBy: actor.sub || "",
    examDate: payload.examDate || visit.visitDate || todayDate(),
    temperatureValue: clinicalNumber(payload.vitalsTemp, "Temperature", { max: 120 }),
    pulseRate: clinicalNumber(payload.vitalsPulse, "Pulse rate", { max: 300, integer: true }),
    bpRightSystolic: clinicalNumber(payload.bpRightSystolic || existingBp.systolic, "Right-arm systolic pressure", { max: 300, integer: true }),
    bpRightDiastolic: clinicalNumber(payload.bpRightDiastolic || existingBp.diastolic, "Right-arm diastolic pressure", { max: 200, integer: true }),
    bpLeftSystolic: clinicalNumber(payload.bpLeftSystolic, "Left-arm systolic pressure", { max: 300, integer: true }),
    bpLeftDiastolic: clinicalNumber(payload.bpLeftDiastolic, "Left-arm diastolic pressure", { max: 200, integer: true }),
    respiratoryRate: clinicalNumber(payload.vitalsRr, "Respiratory rate", { max: 100, integer: true }),
    spo2: clinicalNumber(payload.vitalsSpo2, "SpO₂", { max: 100 }),
    weightKg,
    heightCm,
    bmi,
    bmiCategory: adultBmiCategory(bmi),
    waistCircumference,
    hipCircumference,
    waistHipRatio,
    bloodGlucoseValue: clinicalNumber(payload.bloodGlucoseValue, "Blood glucose", { max: 1000 }),
    bloodGlucoseType: payload.bloodGlucoseType || "",
    vitalSigns: {
      temperatureSite: payload.temperatureSite || "",
      temperatureUnit: payload.temperatureUnit || "",
      pulseRhythm: payload.pulseRhythm || "",
      pulseVolume: payload.pulseVolume || "",
      pulseCharacter: payload.pulseCharacter || "",
      pulseTension: payload.pulseTension || "",
      pulseVesselWall: payload.pulseVesselWall || "",
      bpPosition: payload.bpPosition || "",
      respiratoryPattern: payload.respiratoryPattern || "",
      spo2Condition: payload.spo2Condition || ""
    },
    generalAppearance: {
      builtMorphology: payload.builtMorphology || "",
      bodyBuild: payload.bodyBuild || "",
      nourishment: payload.nourishment || "",
      posture: payload.posture || "",
      gait: payload.gait || "",
      decubitus: payload.decubitus || "",
      facialExpression: payload.facialExpression || "",
      consciousLevel: payload.consciousLevel || "",
      orientationTime: payload.orientationTime || "",
      orientationPlace: payload.orientationPlace || "",
      orientationPerson: payload.orientationPerson || "",
      cooperation: payload.cooperation || "",
      speech: payload.speech || ""
    },
    skinHairNails: {
      skinColour: payload.skinColour || "",
      skinTexture: payload.skinTexture || "",
      skinTurgor: payload.skinTurgor || "",
      rashesLesions: payload.rashesLesions || "",
      oedemaType: payload.oedemaType || "",
      oedemaDistribution: payload.oedemaDistribution || "",
      oedemaGrade: payload.oedemaGrade || "",
      lymphSite: payload.lymphSite || "",
      lymphSize: payload.lymphSize || "",
      lymphConsistency: payload.lymphConsistency || "",
      lymphTenderness: payload.lymphTenderness || "",
      lymphMobility: payload.lymphMobility || "",
      hair: payload.hair || "",
      nails: payload.nails || ""
    },
    eyesTongueMucosa: {
      conjunctiva: payload.conjunctiva || "",
      sclera: payload.sclera || "",
      pupilsSize: payload.pupilsSize || "",
      pupilsShape: payload.pupilsShape || "",
      pupilsDirectReflex: payload.pupilsDirectReflex || "",
      pupilsConsensualReflex: payload.pupilsConsensualReflex || "",
      pupilsPerrla: payload.pupilsPerrla || "",
      tongueAppearance: payload.tongueAppearance || "",
      tongueCoatingColor: payload.tongueCoatingColor || "",
      tongueMoisture: payload.tongueMoisture || "",
      tongueTremors: payload.tongueTremors || "",
      tongueMacroglossia: payload.tongueMacroglossia || "",
      oralMucosa: payload.oralMucosa || "",
      throatCongestion: payload.throatCongestion || "",
      tonsillarGrade: payload.tonsillarGrade || "",
      throatExudates: payload.throatExudates || ""
    },
    ...ayurvedaParikshanFromPayload(payload),
    notes: payload.physicalExam || ""
  };
}

export async function saveVitals(visitId, payload, actor = {}) {
  const existingVisit = await getVisitById(visitId);
  const examination = generalExaminationFromPayload(payload, existingVisit, actor);
  const savedExamination = await upsertGeneralExaminationRecord(examination);
  const primaryBp = [savedExamination.bpRightSystolic || savedExamination.bpLeftSystolic, savedExamination.bpRightDiastolic || savedExamination.bpLeftDiastolic]
    .filter((value) => value !== "" && value !== null && value !== undefined)
    .join("/");
  const visit = await updateVisitVitalsRecord(visitId, {
    vitalsBp: primaryBp,
    vitalsPulse: savedExamination.vitalsPulse,
    vitalsTemp: savedExamination.vitalsTemp,
    vitalsWeight: savedExamination.vitalsWeight,
    vitalsHeight: savedExamination.vitalsHeight,
    // The legacy visit snapshot stores whole percentages; the examination table
    // retains the more precise value entered by the clinician.
    vitalsSpo2: savedExamination.vitalsSpo2 === "" ? "" : Math.round(Number(savedExamination.vitalsSpo2)),
    vitalsRr: savedExamination.vitalsRr
  }, {
    workflowStage: "doctor",
    screeningCompletedAt: new Date().toISOString(),
    screeningCompletedBy: actor.sub || "",
    physicalExam: savedExamination.physicalExam || "",
    generalExaminationId: savedExamination.id,
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

const systemicSectionFields = {
  cardiovascular: [
    "precordiumShape", "apexBeatLocation", "apexBeatCharacter", "heartSoundS1", "heartSoundS2", "additionalHeartSounds",
    "murmurTiming", "murmurSite", "murmurRadiation", "murmurGrade", "jvpStatus", "jvpWaveform", "pulseRadial",
    "pulseBrachial", "pulseCarotid", "pulseFemoral", "pulsePopliteal", "pulsePosteriorTibial", "pulseDorsalisPedis", "capillaryRefillTime"
  ],
  respiratory: [
    "chestShape", "chestMovement", "chestMovementSide", "tracheaPosition", "tracheaDeviationSide", "percussionNote",
    "percussionArea", "airEntry", "airEntryDistribution", "breathSounds", "addedSounds", "crepitationsType",
    "vocalResonance", "tactileFremitus"
  ],
  gastrointestinal: [
    "abdomenShape", "umbilicus", "umbilicalDischarge", "visiblePeristalsis", "dilatedVeins", "dilatedVeinPattern",
    "tendernessLocation", "guarding", "rigidity", "reboundTenderness", "liverSpan", "liverTexture", "liverTenderness",
    "liverSurface", "liverEdge", "spleenGrade", "kidneysBallotable", "ascitesFluidThrill", "ascitesShiftingDullness",
    "ascitesPuddleSign", "bowelSounds", "herniaOrifices", "dreFindings"
  ],
  centralNervousSystem: [
    "cnsConsciousness", "gcsEye", "gcsVerbal", "gcsMotor", "gcsTotal", "cnsOrientation", "memoryImmediate",
    "memoryRecent", "memoryRemote", "intelligence", "judgement", "behaviour", "mood", "cn1Olfactory", "cn2Optic",
    "cn346Ocular", "cn5Trigeminal", "cn7Facial", "cn8Vestibulocochlear", "cn910GlossopharyngealVagus",
    "cn11Accessory", "cn12Hypoglossal", "muscleBulk", "muscleTone", "musclePower", "coordination", "involuntaryMovements",
    "sensoryPain", "sensoryTemperature", "sensoryLightTouch", "sensoryVibration", "sensoryProprioception", "dermatomalMapping",
    "reflexBiceps", "reflexTriceps", "reflexSupinator", "reflexKnee", "reflexAnkle", "plantarResponse", "abdominalReflex",
    "cremastericReflex", "neckStiffness", "kernigSign", "brudzinskiSign"
  ],
  musculoskeletal: [
    "jointExamined1", "jointExamined2", "jointExamined3", "jointExamined4", "jointInspection", "jointPalpation",
    "activeRom", "passiveRom", "jointSpecialTests", "cervicalSpine", "thoracicSpine", "lumbarSpine", "spineMovements",
    "spineTenderness", "slrt", "fnst", "muscleWasting", "weaknessPattern", "mskSpecialTests"
  ],
  genitourinary: [
    "renalAngleRight", "renalAngleLeft", "bladderStatus", "urethralDischarge", "maleTestes", "maleEpididymis",
    "maleVaricocele", "maleHydrocele", "gynaecologyReferral", "genitourinaryNotes"
  ],
  endocrine: [
    "thyroidGoitre", "thyroidSize", "thyroidConsistency", "thyroidNodularity", "thyroidBruit", "hypothyroidSigns",
    "hyperthyroidSigns", "acanthosis", "diabeticFootExam", "cushingMoonFace", "cushingBuffaloHump", "cushingStriae",
    "addisonPigmentation", "addisonHypotension", "tannerStage"
  ],
  eyeEnt: [
    "eyeVisualAcuity", "eyeIop", "eyeFundoscopy", "eyeSlitLamp", "earExternalCanal", "earTmIntegrity", "earHearing",
    "earWhisperTest", "earRinne", "earWeber", "earDischarge", "noseSeptum", "noseTurbinates", "nosePolyp",
    "noseDischarge", "sinusTransillumination", "entTonsils", "entAdenoids", "posteriorPharyngealWall", "laryngoscopy"
  ]
};

function pickSystemicFields(payload, fields) {
  return Object.fromEntries(fields.map((field) => [field, payload[field] ?? ""]));
}

export async function saveSystemicExamination(visitId, payload, actor = {}) {
  const visit = await getVisitById(visitId);
  const current = await findSystemicExaminationByVisitId(visitId);
  const gcsParts = [payload.gcsEye, payload.gcsVerbal, payload.gcsMotor].map(Number);
  const gcsTotal = gcsParts.every((value) => Number.isFinite(value) && value > 0)
    ? String(gcsParts.reduce((sum, value) => sum + value, 0))
    : "";
  const normalizedPayload = { ...payload, gcsTotal };

  return upsertSystemicExaminationRecord({
    id: current?.id || createId(),
    patientId: visit.patientId,
    visitId,
    examinedBy: actor.sub || visit.doctorId,
    examDate: payload.examDate || visit.visitDate || todayDate(),
    cardiovascular: pickSystemicFields(normalizedPayload, systemicSectionFields.cardiovascular),
    respiratory: pickSystemicFields(normalizedPayload, systemicSectionFields.respiratory),
    gastrointestinal: pickSystemicFields(normalizedPayload, systemicSectionFields.gastrointestinal),
    centralNervousSystem: pickSystemicFields(normalizedPayload, systemicSectionFields.centralNervousSystem),
    musculoskeletal: pickSystemicFields(normalizedPayload, systemicSectionFields.musculoskeletal),
    genitourinary: pickSystemicFields(normalizedPayload, systemicSectionFields.genitourinary),
    endocrine: pickSystemicFields(normalizedPayload, systemicSectionFields.endocrine),
    eyeEnt: pickSystemicFields(normalizedPayload, systemicSectionFields.eyeEnt),
    systemicNotes: payload.systemicNotes || ""
  });
}

function pickHistoryFields(payload, prefixes) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
  );
}

function cleanRows(rows, fields, limit) {
  return (Array.isArray(rows) ? rows : []).slice(0, limit).map((row) =>
    Object.fromEntries(fields.map((field) => [field, String(row?.[field] ?? "").slice(0, 1000)]))
  );
}

function historyPrescriptionSnapshot(payload, complaints) {
  const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== "" && value !== null && value !== undefined && (!Array.isArray(value) || value.length)));
  const present = (value) => String(value || "").toLowerCase() === "yes";
  const conditions = [
    present(payload.pastDmStatus) && "dm",
    present(payload.pastHtnStatus) && "htn",
    present(payload.pastCadStatus) && "cad",
    present(payload.pastAsthmaStatus) && "respiratory",
    present(payload.pastTbStatus) && "respiratory",
    present(payload.pastEpilepsyStatus) && "neurological"
  ].filter(Boolean);
  const hereditaryText = String(payload.hereditaryConditions || "").toLowerCase();
  const familyConditions = [
    hereditaryText.includes("dm") || hereditaryText.includes("diabetes") ? "diabetes" : "",
    hereditaryText.includes("htn") || hereditaryText.includes("hypertension") ? "htn" : "",
    hereditaryText.includes("cad") ? "cad" : "",
    hereditaryText.includes("cancer") ? "cancer" : ""
  ].filter(Boolean);
  const gpal = [payload.obstetricGravida && `G${payload.obstetricGravida}`, payload.obstetricPara && `P${payload.obstetricPara}`, payload.obstetricAbortus && `A${payload.obstetricAbortus}`, payload.obstetricLiving && `L${payload.obstetricLiving}`].filter(Boolean).join(" ");

  const complaintRows = complaints.filter((item) => item.complaint.trim()).map((item) => ({
      complaint: item.complaint,
      duration: [item.durationValue, item.durationUnit].filter(Boolean).join(" "),
      severity: item.severity
    }));
  const medicalHistory = compact({
      conditions: [...new Set(conditions)],
      surgicalHistory: payload.previousSurgeryType || "",
      surgicalDetails: [payload.previousSurgeryYear, payload.previousSurgeryComplications].filter(Boolean).join(" · "),
      menstrualLmp: payload.menstrualLmp || "",
      menstrualPreviousLmp: payload.menstrualPreviousLmp || "",
      menstrualDays: payload.menstrualFlowDuration || "",
      menarche: payload.menarcheAge || "",
      menopause: [payload.menopausalStatus, payload.menopauseAge].filter(Boolean).join(" · "),
      menstrualCycle: String(payload.menstrualCycle || "").toLowerCase(),
      clotting: payload.intermenstrualBleeding || "",
      painSeverity: payload.dysmenorrhoea || "",
      obstetricHistory: gpal
    });
  const allergies = compact({
      drug: [payload.drugAllergyName, payload.drugAllergyReaction].filter(Boolean).join(" · ")
    });
  const familyHistory = compact({
      geneticConditions: payload.hereditaryConditions ? true : "",
      geneticDetails: payload.hereditaryConditions || "",
      conditions: familyConditions,
      others: payload.familyOtherIllnesses || payload.familyMentalHealth || ""
    });
  return {
    ...(complaintRows.length ? { complaintRows } : {}),
    ...(Object.keys(medicalHistory).length ? { medicalHistory } : {}),
    ...(Object.keys(allergies).length ? { allergies } : {}),
    ...(Object.keys(familyHistory).length ? { familyHistory } : {})
  };
}

export async function saveHistoryTaking(visitId, payload, actor = {}) {
  const visit = await getVisitById(visitId);
  const current = await findHistoryTakingByVisitId(visitId);
  const complaints = cleanRows(payload.complaints, [
    "complaint", "durationValue", "durationUnit", "onset", "site", "spread", "onsetDate", "triggeringEvent",
    "character", "radiation", "associations", "timeCourse", "coursePattern", "exacerbatingFactors", "relievingFactors",
    "severity", "functionalImpairment", "previousEpisodes", "episodeFrequency", "previousTreatment", "progression", "relevantNegatives"
  ], 10);
  const currentMedications = cleanRows(payload.currentMedications, ["name", "dose", "frequency", "duration", "prescribingDoctor", "medicineSystem"], 20);
  const prescriptionSnapshot = historyPrescriptionSnapshot(payload, complaints);
  const saved = await upsertHistoryTakingRecord({
    id: current?.id || createId(), patientId: visit.patientId, visitId,
    recordedBy: actor.sub || visit.doctorId, historyDate: payload.historyDate || visit.visitDate || todayDate(), complaints,
    pastHistory: pickHistoryFields(payload, ["past", "previousHospital", "previousSurgery", "previousSimilar", "recurrence", "trauma", "bloodTransfusion", "vaccination", "covid", "flu", "hepatitis", "otherVaccinations", "previousInvestigation"]),
    drugHistory: { ...pickHistoryFields(payload, ["medicineSystem", "steroid", "anticoagulant", "nsaid", "drugAllergy", "drugInteraction", "previousAyurvedic", "medicationCompliance", "selfMedication"]), currentMedications },
    familyHistory: pickHistoryFields(payload, ["parent", "sibling", "children", "hereditary", "consanguinity", "family"]),
    personalHistory: pickHistoryFields(payload, ["dietType", "appetite", "foodTiming", "waterIntake", "junkFood", "saltIntake", "dairy", "bowel", "bladder", "urine", "sleep", "dream", "tobacco", "alcohol", "otherSubstance", "caffeine", "addiction", "physicalActivity", "exercise", "yoga", "occupation", "work", "income", "housing", "waterSource", "sanitation", "marriage", "relationship", "sexual", "sti"]),
    obstetricGynaecological: pickHistoryFields(payload, ["menstrual", "menarche", "dysmenorrhoea", "intermenstrual", "postCoital", "premenstrual", "menopausal", "menopause", "hotFlash", "nightSweat", "vaginal", "obstetric", "pregnancy", "stillbirth", "neonatalDeath", "ectopic", "hydatidiform", "currentPregnancy", "edd", "contraception", "artava", "yoni", "garbhashaya", "pradara", "kashtartava"]),
    paediatricHistory: pickHistoryFields(payload, ["birth", "antenatal", "neonatal", "development", "immunisation", "breastfeeding", "weaning", "paediatric"]),
    mentalHealthHistory: pickHistoryFields(payload, ["psychiatric", "mental", "currentStress", "suicidal", "screeningTool", "sleepMood", "manasika"]),
    dietaryHistory: pickHistoryFields(payload, ["dietaryRecall", "ahara", "viruddha", "seasonalDiet", "tridoshaDiet", "heavyLight", "ushnaSheeta", "snigdhaRooksha"]),
    travelHistory: pickHistoryFields(payload, ["recentTravel", "travelCountries", "malariaExposure", "hivZoneExposure", "travelExposure"]),
    prescriptionSnapshot,
    historyNotes: payload.historyNotes || ""
  });

  const firstComplaint = complaints.find((item) => item.complaint.trim())?.complaint.trim();
  if (firstComplaint) await updateVisitChiefComplaintRecord(visitId, firstComplaint);
  await mergePrescriptionMetadataByVisitId(visitId, prescriptionSnapshot);
  return { ...saved, prescriptionSnapshot };
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
    // Legacy values remain readable for older prescriptions, but the removed
    // fields are no longer accepted from new Prescription saves.
    nidana: prescription.nidana || "",
    samprapti: prescription.samprapti || "",
    chikitsaSutra: payload.chikitsaSutra || "",
    dietRecommendations: payload.dietRecommendations ?? prescription.dietRecommendations ?? "",
    dietToTake: dietSelections?.take ?? prescription.dietToTake ?? [],
    dietToAvoid: dietSelections?.avoid ?? prescription.dietToAvoid ?? [],
    followUpDate: payload.followUpDate || "",
    metadata: prescriptionMetadata(prescription.metadata, payload.metadata),
    medicines: (payload.medicines || []).map((medicine) => ({
      id: medicine.id || createId(),
      medicineId: medicine.medicineId || "",
      medicineName: medicine.medicineName || "",
      strength: medicine.strength || "",
      dose: medicine.dose || "",
      frequency: medicine.frequency || "",
      route: medicine.route || "oral",
      timing: medicine.timing || "",
      durationDays: Number(medicine.durationDays || 0),
      anupana: medicine.anupana || "",
      quantityDispensed: Number(medicine.quantityDispensed || 0),
      specialInstructions: medicine.specialInstructions || "",
      metadata: {
        ...(medicine.metadata || {}),
        strength: medicine.strength || medicine.metadata?.strength || ""
      }
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
