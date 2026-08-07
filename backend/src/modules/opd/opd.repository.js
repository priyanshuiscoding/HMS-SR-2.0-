import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toTime } from "../../utils/dateTime.js";
import { nullableUuid } from "../../utils/ids.js";

// Vitals are stored as free text so units typed by staff ("96bpm", "16/min") are
// preserved. Blank form fields arrive as "" (not null); coerce any empty/undefined
// value to null so an absent field keeps whatever is already stored.
function nullableText(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return value;
}

export function toCamelVisit(row) {
  if (!row) return null;

  return {
    id: row.id,
    opdNumber: row.opd_number,
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    doctorId: row.doctor_id || "",
    appointmentId: row.appointment_id || "",
    visitDate: toIsoDate(row.visit_date),
    visitType: row.visit_type || "new",
    chiefComplaint: row.chief_complaint || "",
    vitalsBp: row.vitals_bp || "",
    vitalsPulse: row.vitals_pulse,
    vitalsTemp: row.vitals_temp,
    vitalsWeight: row.vitals_weight,
    vitalsHeight: row.vitals_height,
    vitalsSpo2: row.vitals_spo2,
    vitalsRr: row.vitals_rr,
    status: row.status,
    consultationFee: Number(row.consultation_fee || 0),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCamelAssessment(row) {
  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id,
    doctorId: row.doctor_id || "",
    assessmentDate: toIsoDate(row.assessment_date),
    prakritiVata: row.prakriti_vata ?? "",
    prakritiPitta: row.prakriti_pitta ?? "",
    prakritiKapha: row.prakriti_kapha ?? "",
    prakritiDominant: row.prakriti_dominant || "",
    nadiPariksha: row.nadi_pariksha || "",
    nadiType: row.nadi_type || "",
    jihvaPariksha: row.jihva_pariksha || "",
    agniStatus: row.agni_status || "",
    koshthaNature: row.koshtha_nature || "",
    vikritiAssessment: row.vikriti_assessment || "",
    observations: row.observations || "",
    metadata: row.metadata || {}
  };
}

function toCamelGeneralExamination(row) {
  if (!row) return null;

  const vitalSigns = row.vital_sign_details || {};
  const appearance = row.general_appearance || {};
  const skin = row.skin_hair_nails || {};
  const eyes = row.eyes_tongue_mucosa || {};
  const rightBp = [row.bp_right_systolic, row.bp_right_diastolic].filter((value) => value !== null && value !== undefined).join("/");
  const leftBp = [row.bp_left_systolic, row.bp_left_diastolic].filter((value) => value !== null && value !== undefined).join("/");

  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id,
    examinedBy: row.examined_by || "",
    examDate: toIsoDate(row.examination_date),
    vitalsTemp: row.temperature_value ?? "",
    temperatureSite: vitalSigns.temperatureSite || "",
    temperatureUnit: vitalSigns.temperatureUnit || "",
    vitalsPulse: row.pulse_rate ?? "",
    pulseRhythm: vitalSigns.pulseRhythm || "",
    pulseVolume: vitalSigns.pulseVolume || "",
    pulseCharacter: vitalSigns.pulseCharacter || "",
    pulseTension: vitalSigns.pulseTension || "",
    pulseVesselWall: vitalSigns.pulseVesselWall || "",
    bpRightSystolic: row.bp_right_systolic ?? "",
    bpRightDiastolic: row.bp_right_diastolic ?? "",
    bpLeftSystolic: row.bp_left_systolic ?? "",
    bpLeftDiastolic: row.bp_left_diastolic ?? "",
    bpPosition: vitalSigns.bpPosition || "",
    vitalsBp: rightBp || leftBp,
    vitalsRr: row.respiratory_rate ?? "",
    respiratoryPattern: vitalSigns.respiratoryPattern || "",
    vitalsSpo2: row.spo2 ?? "",
    spo2Condition: vitalSigns.spo2Condition || "",
    vitalsWeight: row.weight_kg ?? "",
    vitalsHeight: row.height_cm ?? "",
    bmi: row.bmi ?? "",
    bmiCategory: row.bmi_category || "",
    waistCircumference: row.waist_circumference_cm ?? "",
    hipCircumference: row.hip_circumference_cm ?? "",
    waistHipRatio: row.waist_hip_ratio ?? "",
    bloodGlucoseValue: row.blood_glucose_mg_dl ?? "",
    bloodGlucoseType: row.blood_glucose_type || "",
    builtMorphology: appearance.builtMorphology || "",
    bodyBuild: appearance.bodyBuild || "",
    nourishment: appearance.nourishment || "",
    posture: appearance.posture || "",
    gait: appearance.gait || "",
    decubitus: appearance.decubitus || "",
    facialExpression: appearance.facialExpression || "",
    consciousLevel: appearance.consciousLevel || "",
    orientationTime: appearance.orientationTime || "",
    orientationPlace: appearance.orientationPlace || "",
    orientationPerson: appearance.orientationPerson || "",
    cooperation: appearance.cooperation || "",
    speech: appearance.speech || "",
    skinColour: skin.skinColour || "",
    skinTexture: skin.skinTexture || "",
    skinTurgor: skin.skinTurgor || "",
    rashesLesions: skin.rashesLesions || "",
    oedemaType: skin.oedemaType || "",
    oedemaDistribution: skin.oedemaDistribution || "",
    oedemaGrade: skin.oedemaGrade || "",
    lymphSite: skin.lymphSite || "",
    lymphSize: skin.lymphSize || "",
    lymphConsistency: skin.lymphConsistency || "",
    lymphTenderness: skin.lymphTenderness || "",
    lymphMobility: skin.lymphMobility || "",
    hair: skin.hair || "",
    nails: skin.nails || "",
    conjunctiva: eyes.conjunctiva || "",
    sclera: eyes.sclera || "",
    pupilsSize: eyes.pupilsSize || "",
    pupilsShape: eyes.pupilsShape || "",
    pupilsDirectReflex: eyes.pupilsDirectReflex || "",
    pupilsConsensualReflex: eyes.pupilsConsensualReflex || "",
    pupilsPerrla: eyes.pupilsPerrla || "",
    tongueAppearance: eyes.tongueAppearance || "",
    tongueCoatingColor: eyes.tongueCoatingColor || "",
    tongueMoisture: eyes.tongueMoisture || "",
    tongueTremors: eyes.tongueTremors || "",
    tongueMacroglossia: eyes.tongueMacroglossia || "",
    oralMucosa: eyes.oralMucosa || "",
    throatCongestion: eyes.throatCongestion || "",
    tonsillarGrade: eyes.tonsillarGrade || "",
    throatExudates: eyes.throatExudates || "",
    // Parikshan blobs are keyed by the same field names the form uses.
    ...(row.ashtavidha_pariksha || {}),
    ...(row.dashavidha_pariksha || {}),
    ...(row.srotas_pariksha || {}),
    ...(row.samprapti_ghatak || {}),
    ...(row.prakruti || {}),
    ayurvedaNotes: row.ayurveda_notes || "",
    physicalExam: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCamelSystemicExamination(row) {
  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id,
    examinedBy: row.examined_by || "",
    examDate: toIsoDate(row.examination_date),
    ...(row.cardiovascular || {}),
    ...(row.respiratory || {}),
    ...(row.gastrointestinal || {}),
    ...(row.central_nervous_system || {}),
    ...(row.musculoskeletal || {}),
    ...(row.genitourinary || {}),
    ...(row.endocrine || {}),
    ...(row.eye_ent || {}),
    systemicNotes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCamelHistoryTaking(row) {
  if (!row) return null;

  const drugHistory = row.drug_history || {};
  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id,
    recordedBy: row.recorded_by || "",
    historyDate: toIsoDate(row.history_date),
    complaints: Array.isArray(row.chief_complaints) ? row.chief_complaints : [],
    ...(row.past_history || {}),
    ...drugHistory,
    currentMedications: Array.isArray(drugHistory.currentMedications) ? drugHistory.currentMedications : [],
    ...(row.family_history || {}),
    ...(row.personal_history || {}),
    ...(row.obstetric_gynaecological || {}),
    ...(row.paediatric_history || {}),
    ...(row.mental_health_history || {}),
    ...(row.dietary_history || {}),
    ...(row.travel_history || {}),
    prescriptionSnapshot: row.prescription_snapshot || {},
    historyNotes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCamelPrescription(row, medicines = []) {
  if (!row) return null;

  return {
    id: row.id,
    prescriptionNumber: row.prescription_number,
    patientId: row.patient_id,
    patientName: row.patient_name,
    doctorId: row.doctor_id || "",
    visitId: row.visit_id || "",
    prescriptionDate: toIsoDate(row.prescription_date),
    diagnosis: row.diagnosis || "",
    diagnosisAyurvedic: row.diagnosis_ayurvedic || "",
    nidana: row.nidana || "",
    samprapti: row.samprapti || "",
    chikitsaSutra: row.chikitsa_sutra || "",
    dietRecommendations: row.diet_recommendations || "",
    dietToTake: Array.isArray(row.diet_to_take) ? row.diet_to_take : [],
    dietToAvoid: Array.isArray(row.diet_to_avoid) ? row.diet_to_avoid : [],
    followUpDate: toIsoDate(row.follow_up_date),
    isDispensed: Boolean(row.is_dispensed),
    medicines,
    metadata: row.metadata || {}
  };
}

function toCamelDischargeSummary(row) {
  if (!row) return null;

  return {
    id: row.id,
    summaryNumber: row.summary_number,
    visitId: row.visit_id,
    prescriptionId: row.prescription_id || "",
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    doctorId: row.doctor_id || "",
    summaryDate: toIsoDate(row.summary_date),
    status: row.status || "draft",
    clinicalCourse: row.clinical_course || "",
    finalDiagnosis: row.final_diagnosis || "",
    conditionOnDischarge: row.condition_on_discharge || "",
    advice: row.advice || "",
    followUpDate: toIsoDate(row.follow_up_date),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toCamelPrescriptionMedicine(row) {
  return {
    id: row.id,
    medicineId: row.metadata?.sourceMedicineId || row.medicine_id || "",
    medicineName: row.medicine_name || "",
    strength: row.metadata?.strength || "",
    dose: row.dose || "",
    frequency: row.frequency || "",
    route: row.route || "oral",
    timing: row.timing || "",
    durationDays: Number(row.duration_days || 0),
    anupana: row.anupana || "",
    quantityDispensed: Number(row.quantity_dispensed || 0),
    specialInstructions: row.special_instructions || "",
    metadata: row.metadata || {}
  };
}

function toCamelQueueItem(row) {
  return {
    id: row.appointment_id,
    appointmentNumber: row.appointment_number,
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    patientAge: row.patient_age,
    patientGender: row.patient_gender || "",
    patientMobile: row.patient_mobile || "",
    doctorId: row.doctor_id || "",
    appointmentDate: toIsoDate(row.appointment_date),
    appointmentTime: toTime(row.appointment_time),
    type: row.type,
    department: row.department,
    status: row.status,
    chiefComplaint: row.chief_complaint || "",
    tokenNumber: row.token_number,
    bookedBy: row.booked_by || "",
    source: row.source || "Reception",
    smsSent: Boolean(row.sms_sent),
    consultationPayment: row.metadata?.consultationPayment || null,
    queueStatus: row.metadata?.queueStatus || "",
    workflow: row.metadata?.workflow || null,
    visitMetadata: row.visit_metadata || {},
    doctorName: row.doctor_name || "Unassigned",
    visitId: row.visit_id || null,
    visitStatus: row.visit_status || null
  };
}

export async function listOpdQueue(date, doctorId = "") {
  const params = [date];
  const doctorFilter = doctorId ? "AND a.doctor_id = $2" : "";
  if (doctorId) params.push(doctorId);

  const result = await query(
    `
    SELECT
      a.id AS appointment_id,
      a.appointment_number,
      a.patient_id,
      a.patient_name,
      a.patient_age,
      a.patient_gender,
      a.patient_mobile,
      a.doctor_id,
      a.appointment_date,
      a.appointment_time,
      a.type,
      a.department,
      a.status,
      a.chief_complaint,
      a.token_number,
      a.booked_by,
      a.source,
      a.sms_sent,
      u.full_name AS doctor_name,
      v.id AS visit_id,
      v.status AS visit_status,
      v.metadata AS visit_metadata
    FROM appointments a
    LEFT JOIN users u ON u.id = a.doctor_id
    LEFT JOIN opd_visits v ON v.appointment_id = a.id
    WHERE a.appointment_date = $1
      ${doctorFilter}
      AND a.deleted_at IS NULL
      AND a.status NOT IN ('cancelled', 'no_show')
    ORDER BY a.token_number ASC, a.appointment_time ASC
    `,
    params
  );

  return result.rows.map(toCamelQueueItem);
}

export async function findVisitById(id) {
  const result = await query("SELECT * FROM opd_visits WHERE id = $1", [id]);
  return toCamelVisit(result.rows[0]);
}

export async function findVisitByAppointmentId(appointmentId) {
  const result = await query("SELECT * FROM opd_visits WHERE appointment_id = $1", [appointmentId]);
  return toCamelVisit(result.rows[0]);
}

export async function listVisitRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  const result = await query(
    `SELECT * FROM opd_visits WHERE ${conditions.join(" AND ")} ORDER BY visit_date DESC, created_at DESC`,
    params
  );
  return result.rows.map(toCamelVisit);
}

export async function findGeneralExaminationByVisitId(visitId) {
  const result = await query("SELECT * FROM opd_general_examinations WHERE visit_id = $1", [visitId]);
  return toCamelGeneralExamination(result.rows[0]);
}

export async function listGeneralExaminationRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  if (filters.visitId) {
    params.push(filters.visitId);
    conditions.push(`visit_id = $${params.length}`);
  }

  const result = await query(
    `SELECT * FROM opd_general_examinations WHERE ${conditions.join(" AND ")} ORDER BY examination_date DESC, created_at DESC`,
    params
  );
  return result.rows.map(toCamelGeneralExamination);
}

export async function upsertGeneralExaminationRecord(examination) {
  const result = await query(
    `
    INSERT INTO opd_general_examinations (
      id, patient_id, visit_id, examined_by, examination_date,
      temperature_value, pulse_rate, bp_right_systolic, bp_right_diastolic, bp_left_systolic, bp_left_diastolic,
      respiratory_rate, spo2, weight_kg, height_cm, bmi, bmi_category,
      waist_circumference_cm, hip_circumference_cm, waist_hip_ratio,
      blood_glucose_mg_dl, blood_glucose_type, vital_sign_details,
      general_appearance, skin_hair_nails, eyes_tongue_mucosa, notes,
      ashtavidha_pariksha, dashavidha_pariksha, srotas_pariksha, samprapti_ghatak, prakruti, ayurveda_notes
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17,
      $18, $19, $20,
      $21, $22, $23::jsonb,
      $24::jsonb, $25::jsonb, $26::jsonb, $27,
      $28::jsonb, $29::jsonb, $30::jsonb, $31::jsonb, $32::jsonb, $33
    )
    ON CONFLICT (visit_id) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      examined_by = EXCLUDED.examined_by,
      examination_date = EXCLUDED.examination_date,
      temperature_value = EXCLUDED.temperature_value,
      pulse_rate = EXCLUDED.pulse_rate,
      bp_right_systolic = EXCLUDED.bp_right_systolic,
      bp_right_diastolic = EXCLUDED.bp_right_diastolic,
      bp_left_systolic = EXCLUDED.bp_left_systolic,
      bp_left_diastolic = EXCLUDED.bp_left_diastolic,
      respiratory_rate = EXCLUDED.respiratory_rate,
      spo2 = EXCLUDED.spo2,
      weight_kg = EXCLUDED.weight_kg,
      height_cm = EXCLUDED.height_cm,
      bmi = EXCLUDED.bmi,
      bmi_category = EXCLUDED.bmi_category,
      waist_circumference_cm = EXCLUDED.waist_circumference_cm,
      hip_circumference_cm = EXCLUDED.hip_circumference_cm,
      waist_hip_ratio = EXCLUDED.waist_hip_ratio,
      blood_glucose_mg_dl = EXCLUDED.blood_glucose_mg_dl,
      blood_glucose_type = EXCLUDED.blood_glucose_type,
      vital_sign_details = EXCLUDED.vital_sign_details,
      general_appearance = EXCLUDED.general_appearance,
      skin_hair_nails = EXCLUDED.skin_hair_nails,
      eyes_tongue_mucosa = EXCLUDED.eyes_tongue_mucosa,
      notes = EXCLUDED.notes,
      ashtavidha_pariksha = EXCLUDED.ashtavidha_pariksha,
      dashavidha_pariksha = EXCLUDED.dashavidha_pariksha,
      srotas_pariksha = EXCLUDED.srotas_pariksha,
      samprapti_ghatak = EXCLUDED.samprapti_ghatak,
      prakruti = EXCLUDED.prakruti,
      ayurveda_notes = EXCLUDED.ayurveda_notes,
      updated_at = NOW()
    RETURNING *
    `,
    [
      examination.id,
      examination.patientId,
      examination.visitId,
      nullableUuid(examination.examinedBy),
      examination.examDate,
      examination.temperatureValue,
      examination.pulseRate,
      examination.bpRightSystolic,
      examination.bpRightDiastolic,
      examination.bpLeftSystolic,
      examination.bpLeftDiastolic,
      examination.respiratoryRate,
      examination.spo2,
      examination.weightKg,
      examination.heightCm,
      examination.bmi,
      examination.bmiCategory || "",
      examination.waistCircumference,
      examination.hipCircumference,
      examination.waistHipRatio,
      examination.bloodGlucoseValue,
      examination.bloodGlucoseType || "",
      JSON.stringify(examination.vitalSigns || {}),
      JSON.stringify(examination.generalAppearance || {}),
      JSON.stringify(examination.skinHairNails || {}),
      JSON.stringify(examination.eyesTongueMucosa || {}),
      examination.notes || "",
      JSON.stringify(examination.ashtavidhaPariksha || {}),
      JSON.stringify(examination.dashavidhaPariksha || {}),
      JSON.stringify(examination.srotasPariksha || {}),
      JSON.stringify(examination.sampraptiGhatak || {}),
      JSON.stringify(examination.prakruti || {}),
      examination.ayurvedaNotes || ""
    ]
  );

  return toCamelGeneralExamination(result.rows[0]);
}

export async function createVisitRecord(payload) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["opd:number"]);
    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM opd_visits");
    const opdNumber = `OPD-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;

    const result = await client.query(
      `
      INSERT INTO opd_visits (
        id, opd_number, patient_id, patient_name, doctor_id, appointment_id, visit_date, visit_type,
        chief_complaint, status, consultation_fee, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'waiting', $10, $11::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        opdNumber,
        payload.patientId || null,
        payload.patientName,
        payload.doctorId || null,
        payload.appointmentId || null,
        payload.visitDate,
        payload.visitType || "new",
        payload.chiefComplaint || "",
        payload.consultationFee || 0,
        JSON.stringify(payload.metadata || {})
      ]
    );

    return toCamelVisit(result.rows[0]);
  });
}

export async function updateVisitVitalsRecord(id, payload, metadata = {}) {
  // Only overwrite a vital when the caller actually sends that field: an explicit
  // blank clears it, while an absent field keeps whatever is already stored. Using
  // COALESCE here treated "" (a cleared field) as "keep old value", so corrections
  // back to blank never saved.
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const result = await query(
    `
    UPDATE opd_visits
    SET
      vitals_bp = CASE WHEN $3 THEN $2 ELSE vitals_bp END,
      vitals_pulse = CASE WHEN $5 THEN $4 ELSE vitals_pulse END,
      vitals_temp = CASE WHEN $7 THEN $6 ELSE vitals_temp END,
      vitals_weight = CASE WHEN $9 THEN $8 ELSE vitals_weight END,
      vitals_height = CASE WHEN $11 THEN $10 ELSE vitals_height END,
      vitals_spo2 = CASE WHEN $13 THEN $12 ELSE vitals_spo2 END,
      vitals_rr = CASE WHEN $15 THEN $14 ELSE vitals_rr END,
      status = CASE WHEN status = 'waiting' THEN 'in_consultation' ELSE status END,
      metadata = COALESCE(metadata, '{}'::jsonb) || $16::jsonb,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      payload.vitalsBp === "" ? null : payload.vitalsBp ?? null, has("vitalsBp"),
      nullableText(payload.vitalsPulse), has("vitalsPulse"),
      nullableText(payload.vitalsTemp), has("vitalsTemp"),
      nullableText(payload.vitalsWeight), has("vitalsWeight"),
      nullableText(payload.vitalsHeight), has("vitalsHeight"),
      nullableText(payload.vitalsSpo2), has("vitalsSpo2"),
      nullableText(payload.vitalsRr), has("vitalsRr"),
      JSON.stringify(metadata)
    ]
  );

  return toCamelVisit(result.rows[0]);
}

export async function updateVisitStatusRecord(id, status, metadata = {}) {
  const result = await query(
    `
    UPDATE opd_visits
    SET status = $2, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb, updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, status, JSON.stringify(metadata)]
  );

  return toCamelVisit(result.rows[0]);
}

export async function findAssessmentByVisitId(visitId) {
  const result = await query("SELECT * FROM ayurveda_assessments WHERE visit_id = $1", [visitId]);
  return toCamelAssessment(result.rows[0]);
}

export async function listAssessmentRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  const result = await query(
    `SELECT * FROM ayurveda_assessments WHERE ${conditions.join(" AND ")} ORDER BY assessment_date DESC, created_at DESC`,
    params
  );
  return result.rows.map(toCamelAssessment);
}

export async function upsertAssessmentRecord(assessment) {
  const result = await query(
    `
    INSERT INTO ayurveda_assessments (
      id, patient_id, visit_id, doctor_id, assessment_date, prakriti_vata, prakriti_pitta, prakriti_kapha,
      prakriti_dominant, nadi_pariksha, nadi_type, jihva_pariksha, agni_status, koshtha_nature,
      vikriti_assessment, observations, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET
      doctor_id = EXCLUDED.doctor_id,
      assessment_date = EXCLUDED.assessment_date,
      prakriti_vata = EXCLUDED.prakriti_vata,
      prakriti_pitta = EXCLUDED.prakriti_pitta,
      prakriti_kapha = EXCLUDED.prakriti_kapha,
      prakriti_dominant = EXCLUDED.prakriti_dominant,
      nadi_pariksha = EXCLUDED.nadi_pariksha,
      nadi_type = EXCLUDED.nadi_type,
      jihva_pariksha = EXCLUDED.jihva_pariksha,
      agni_status = EXCLUDED.agni_status,
      koshtha_nature = EXCLUDED.koshtha_nature,
      vikriti_assessment = EXCLUDED.vikriti_assessment,
      observations = EXCLUDED.observations,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING *
    `,
    [
      assessment.id,
      assessment.patientId || null,
      assessment.visitId,
      assessment.doctorId || null,
      assessment.assessmentDate,
      assessment.prakritiVata ?? "",
      assessment.prakritiPitta ?? "",
      assessment.prakritiKapha ?? "",
      assessment.prakritiDominant || "",
      assessment.nadiPariksha || "",
      assessment.nadiType || "",
      assessment.jihvaPariksha || "",
      assessment.agniStatus || "",
      assessment.koshthaNature || "",
      assessment.vikritiAssessment || "",
      assessment.observations || "",
      JSON.stringify(assessment.metadata || {})
    ]
  );

  return toCamelAssessment(result.rows[0]);
}

export async function findSystemicExaminationByVisitId(visitId) {
  const result = await query("SELECT * FROM opd_systemic_examinations WHERE visit_id = $1", [visitId]);
  return toCamelSystemicExamination(result.rows[0]);
}

export async function listSystemicExaminationRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  const result = await query(
    `SELECT * FROM opd_systemic_examinations WHERE ${conditions.join(" AND ")} ORDER BY examination_date DESC, created_at DESC`,
    params
  );
  return result.rows.map(toCamelSystemicExamination);
}

export async function upsertSystemicExaminationRecord(examination) {
  const result = await query(
    `
    INSERT INTO opd_systemic_examinations (
      id, patient_id, visit_id, examined_by, examination_date,
      cardiovascular, respiratory, gastrointestinal, central_nervous_system,
      musculoskeletal, genitourinary, endocrine, eye_ent, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14)
    ON CONFLICT (visit_id) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      examined_by = EXCLUDED.examined_by,
      examination_date = EXCLUDED.examination_date,
      cardiovascular = EXCLUDED.cardiovascular,
      respiratory = EXCLUDED.respiratory,
      gastrointestinal = EXCLUDED.gastrointestinal,
      central_nervous_system = EXCLUDED.central_nervous_system,
      musculoskeletal = EXCLUDED.musculoskeletal,
      genitourinary = EXCLUDED.genitourinary,
      endocrine = EXCLUDED.endocrine,
      eye_ent = EXCLUDED.eye_ent,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
    `,
    [
      examination.id,
      examination.patientId,
      examination.visitId,
      examination.examinedBy || null,
      examination.examDate,
      JSON.stringify(examination.cardiovascular || {}),
      JSON.stringify(examination.respiratory || {}),
      JSON.stringify(examination.gastrointestinal || {}),
      JSON.stringify(examination.centralNervousSystem || {}),
      JSON.stringify(examination.musculoskeletal || {}),
      JSON.stringify(examination.genitourinary || {}),
      JSON.stringify(examination.endocrine || {}),
      JSON.stringify(examination.eyeEnt || {}),
      examination.systemicNotes || ""
    ]
  );

  return toCamelSystemicExamination(result.rows[0]);
}

export async function findHistoryTakingByVisitId(visitId) {
  const result = await query("SELECT * FROM opd_history_taking WHERE visit_id = $1", [visitId]);
  return toCamelHistoryTaking(result.rows[0]);
}

export async function listHistoryTakingRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }
  const result = await query(
    `SELECT * FROM opd_history_taking WHERE ${conditions.join(" AND ")} ORDER BY history_date DESC, created_at DESC`,
    params
  );
  return result.rows.map(toCamelHistoryTaking);
}

export async function upsertHistoryTakingRecord(history) {
  const result = await query(
    `
    INSERT INTO opd_history_taking (
      id, patient_id, visit_id, recorded_by, history_date, chief_complaints, past_history,
      drug_history, family_history, personal_history, obstetric_gynaecological,
      paediatric_history, mental_health_history, dietary_history, travel_history,
      prescription_snapshot, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17)
    ON CONFLICT (visit_id) DO UPDATE SET
      patient_id = EXCLUDED.patient_id,
      recorded_by = EXCLUDED.recorded_by,
      history_date = EXCLUDED.history_date,
      chief_complaints = EXCLUDED.chief_complaints,
      past_history = EXCLUDED.past_history,
      drug_history = EXCLUDED.drug_history,
      family_history = EXCLUDED.family_history,
      personal_history = EXCLUDED.personal_history,
      obstetric_gynaecological = EXCLUDED.obstetric_gynaecological,
      paediatric_history = EXCLUDED.paediatric_history,
      mental_health_history = EXCLUDED.mental_health_history,
      dietary_history = EXCLUDED.dietary_history,
      travel_history = EXCLUDED.travel_history,
      prescription_snapshot = EXCLUDED.prescription_snapshot,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
    `,
    [
      history.id, history.patientId, history.visitId, history.recordedBy || null, history.historyDate,
      JSON.stringify(history.complaints || []), JSON.stringify(history.pastHistory || {}), JSON.stringify(history.drugHistory || {}),
      JSON.stringify(history.familyHistory || {}), JSON.stringify(history.personalHistory || {}), JSON.stringify(history.obstetricGynaecological || {}),
      JSON.stringify(history.paediatricHistory || {}), JSON.stringify(history.mentalHealthHistory || {}), JSON.stringify(history.dietaryHistory || {}),
      JSON.stringify(history.travelHistory || {}), JSON.stringify(history.prescriptionSnapshot || {}), history.historyNotes || ""
    ]
  );
  return toCamelHistoryTaking(result.rows[0]);
}

export async function mergePrescriptionMetadataByVisitId(visitId, metadata) {
  const result = await query(
    `
    UPDATE prescriptions
    SET metadata = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(metadata, '{}'::jsonb), '{complaintRows}', COALESCE($2::jsonb->'complaintRows', metadata->'complaintRows', '[]'::jsonb), true),
          '{medicalHistory}', COALESCE(metadata->'medicalHistory', '{}'::jsonb) || COALESCE($2::jsonb->'medicalHistory', '{}'::jsonb), true
        ),
        '{allergies}', COALESCE(metadata->'allergies', '{}'::jsonb) || COALESCE($2::jsonb->'allergies', '{}'::jsonb), true
      ),
      '{familyHistory}', COALESCE(metadata->'familyHistory', '{}'::jsonb) || COALESCE($2::jsonb->'familyHistory', '{}'::jsonb), true
    ), updated_at = NOW()
    WHERE visit_id = $1
    RETURNING id
    `,
    [visitId, JSON.stringify(metadata || {})]
  );
  return Boolean(result.rowCount);
}

export async function updateVisitChiefComplaintRecord(visitId, chiefComplaint) {
  const result = await query(
    "UPDATE opd_visits SET chief_complaint = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
    [visitId, chiefComplaint]
  );
  return toCamelVisit(result.rows[0]);
}

export async function findPrescriptionByVisitId(visitId) {
  const prescriptionResult = await query("SELECT * FROM prescriptions WHERE visit_id = $1", [visitId]);
  const prescription = prescriptionResult.rows[0];

  if (!prescription) return null;

  const medicineResult = await query("SELECT * FROM prescription_medicines WHERE prescription_id = $1 ORDER BY id", [prescription.id]);
  return toCamelPrescription(prescription, medicineResult.rows.map(toCamelPrescriptionMedicine));
}

export async function findDischargeSummaryByVisitId(visitId) {
  const result = await query("SELECT * FROM opd_discharge_summaries WHERE visit_id = $1", [visitId]);
  return toCamelDischargeSummary(result.rows[0]);
}

export async function listPrescriptionRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`patient_id = $${params.length}`);
  }

  const prescriptionResult = await query(
    `SELECT * FROM prescriptions WHERE ${conditions.join(" AND ")} ORDER BY prescription_date DESC, created_at DESC`,
    params
  );

  if (!prescriptionResult.rows.length) {
    return [];
  }

  const medicineResult = await query(
    "SELECT * FROM prescription_medicines WHERE prescription_id = ANY($1::uuid[]) ORDER BY id",
    [prescriptionResult.rows.map((row) => row.id)]
  );
  const medicinesByPrescription = medicineResult.rows.reduce((lookup, medicine) => {
    if (!lookup[medicine.prescription_id]) {
      lookup[medicine.prescription_id] = [];
    }

    lookup[medicine.prescription_id].push(toCamelPrescriptionMedicine(medicine));
    return lookup;
  }, {});

  return prescriptionResult.rows.map((prescription) =>
    toCamelPrescription(prescription, medicinesByPrescription[prescription.id] || [])
  );
}

export async function listDischargeSummaryRecords() {
  const result = await query("SELECT * FROM opd_discharge_summaries ORDER BY summary_date DESC, created_at DESC");
  return result.rows.map(toCamelDischargeSummary);
}

function toCamelDietItem(row) {
  return {
    id: row.id,
    name: row.name,
    nameHi: row.name_hi || "",
    appliesTo: row.applies_to,
    source: row.source || "seed"
  };
}

export async function listDietItemRecords() {
  const result = await query(
    "SELECT id, name, name_hi, applies_to, source FROM diet_items WHERE is_active ORDER BY name"
  );

  return result.rows.map(toCamelDietItem);
}

// Used when a doctor types an item that is not in the master list yet. The
// unique index is on (lower(name), applies_to), so a repeat of the same typed
// name resolves to the existing row instead of creating a duplicate.
export async function findOrCreateDietItemRecord({ name, appliesTo }) {
  const result = await query(
    `
    INSERT INTO diet_items (name, applies_to, source)
    VALUES ($1, $2, 'custom')
    ON CONFLICT (lower(name), applies_to) DO UPDATE
      SET is_active = true, updated_at = NOW()
    RETURNING id, name, name_hi, applies_to, source
    `,
    [name, appliesTo]
  );

  return toCamelDietItem(result.rows[0]);
}

export async function upsertPrescriptionRecord(prescription) {
  return withTransaction(async (client) => {
    let prescriptionNumber = prescription.prescriptionNumber;
    if (!prescriptionNumber) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["rx:number"]);
      const countResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM prescriptions");
      prescriptionNumber = `RX-${new Date().getFullYear()}-${String(countResult.rows[0].next_number).padStart(5, "0")}`;
    }

    const prescriptionResult = await client.query(
      `
      INSERT INTO prescriptions (
        id, prescription_number, patient_id, patient_name, doctor_id, visit_id, prescription_date,
        diagnosis, diagnosis_ayurvedic, nidana, samprapti, chikitsa_sutra, diet_recommendations,
        diet_to_take, diet_to_avoid, follow_up_date, is_dispensed, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18::jsonb)
      ON CONFLICT (prescription_number) DO UPDATE
      SET
        patient_id = EXCLUDED.patient_id,
        patient_name = EXCLUDED.patient_name,
        doctor_id = EXCLUDED.doctor_id,
        visit_id = EXCLUDED.visit_id,
        prescription_date = EXCLUDED.prescription_date,
        diagnosis = EXCLUDED.diagnosis,
        diagnosis_ayurvedic = EXCLUDED.diagnosis_ayurvedic,
        nidana = EXCLUDED.nidana,
        samprapti = EXCLUDED.samprapti,
        chikitsa_sutra = EXCLUDED.chikitsa_sutra,
        diet_recommendations = EXCLUDED.diet_recommendations,
        diet_to_take = EXCLUDED.diet_to_take,
        diet_to_avoid = EXCLUDED.diet_to_avoid,
        follow_up_date = EXCLUDED.follow_up_date,
        is_dispensed = EXCLUDED.is_dispensed,
        metadata = COALESCE(prescriptions.metadata, '{}'::jsonb) || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
      `,
      [
        prescription.id,
        prescriptionNumber,
        prescription.patientId || null,
        prescription.patientName,
        prescription.doctorId || null,
        prescription.visitId || null,
        prescription.prescriptionDate,
        prescription.diagnosis,
        prescription.diagnosisAyurvedic || "",
        prescription.nidana || "",
        prescription.samprapti || "",
        prescription.chikitsaSutra || "",
        prescription.dietRecommendations || "",
        JSON.stringify(prescription.dietToTake || []),
        JSON.stringify(prescription.dietToAvoid || []),
        prescription.followUpDate || null,
        prescription.isDispensed || false,
        JSON.stringify(prescription.metadata || {})
      ]
    );

    const savedPrescription = prescriptionResult.rows[0];
    await client.query("DELETE FROM prescription_medicines WHERE prescription_id = $1", [savedPrescription.id]);

    for (const medicine of prescription.medicines || []) {
      await client.query(
        `
        INSERT INTO prescription_medicines (
          id, prescription_id, medicine_id, medicine_name, dose, frequency, route, timing, duration_days,
          anupana, quantity_dispensed, special_instructions, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        `,
        [
          medicine.id,
          savedPrescription.id,
          nullableUuid(medicine.medicineId),
          medicine.medicineName || "",
          medicine.dose || "",
          medicine.frequency || "",
          medicine.route || "oral",
          medicine.timing || "",
          Number(medicine.durationDays || 0),
          medicine.anupana || "",
          Number(medicine.quantityDispensed || 0),
          medicine.specialInstructions || "",
          JSON.stringify({ ...(medicine.metadata || {}), sourceMedicineId: medicine.medicineId || "" })
        ]
      );
    }

    const medicineResult = await client.query("SELECT * FROM prescription_medicines WHERE prescription_id = $1 ORDER BY id", [
      savedPrescription.id
    ]);

    return toCamelPrescription(savedPrescription, medicineResult.rows.map(toCamelPrescriptionMedicine));
  });
}

export async function upsertDischargeSummaryRecord(summary) {
  return withTransaction(async (client) => {
    let summaryNumber = summary.summaryNumber;
    if (!summaryNumber) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["opd:discharge-summary-number"]);
      const countResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM opd_discharge_summaries");
      summaryNumber = `DS-${new Date().getFullYear()}-${String(countResult.rows[0].next_number).padStart(5, "0")}`;
    }

    const result = await client.query(
      `
      INSERT INTO opd_discharge_summaries (
        id, summary_number, visit_id, prescription_id, patient_id, patient_name, doctor_id,
        summary_date, status, clinical_course, final_diagnosis, condition_on_discharge,
        advice, follow_up_date, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      ON CONFLICT (visit_id) DO UPDATE
      SET
        summary_number = opd_discharge_summaries.summary_number,
        prescription_id = EXCLUDED.prescription_id,
        patient_id = EXCLUDED.patient_id,
        patient_name = EXCLUDED.patient_name,
        doctor_id = EXCLUDED.doctor_id,
        summary_date = EXCLUDED.summary_date,
        status = EXCLUDED.status,
        clinical_course = EXCLUDED.clinical_course,
        final_diagnosis = EXCLUDED.final_diagnosis,
        condition_on_discharge = EXCLUDED.condition_on_discharge,
        advice = EXCLUDED.advice,
        follow_up_date = EXCLUDED.follow_up_date,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
      `,
      [
        summary.id,
        summaryNumber,
        summary.visitId,
        summary.prescriptionId || null,
        summary.patientId || null,
        summary.patientName,
        summary.doctorId || null,
        summary.summaryDate,
        summary.status || "draft",
        summary.clinicalCourse || "",
        summary.finalDiagnosis || "",
        summary.conditionOnDischarge || "",
        summary.advice || "",
        summary.followUpDate || null,
        JSON.stringify(summary.metadata || {})
      ]
    );

    return toCamelDischargeSummary(result.rows[0]);
  });
}

export async function upsertSeedVisit(client, visit) {
  await client.query(
    `
    INSERT INTO opd_visits (
      id, opd_number, patient_id, patient_name, doctor_id, appointment_id, visit_date, visit_type,
      chief_complaint, vitals_bp, vitals_pulse, vitals_temp, vitals_weight, vitals_height,
      vitals_spo2, vitals_rr, status, consultation_fee, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19::jsonb
    )
    ON CONFLICT (opd_number) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      doctor_id = EXCLUDED.doctor_id,
      appointment_id = EXCLUDED.appointment_id,
      visit_date = EXCLUDED.visit_date,
      visit_type = EXCLUDED.visit_type,
      chief_complaint = EXCLUDED.chief_complaint,
      vitals_bp = EXCLUDED.vitals_bp,
      vitals_pulse = EXCLUDED.vitals_pulse,
      vitals_temp = EXCLUDED.vitals_temp,
      vitals_weight = EXCLUDED.vitals_weight,
      vitals_height = EXCLUDED.vitals_height,
      vitals_spo2 = EXCLUDED.vitals_spo2,
      vitals_rr = EXCLUDED.vitals_rr,
      status = EXCLUDED.status,
      consultation_fee = EXCLUDED.consultation_fee,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    `,
    [
      visit.id,
      visit.opdNumber,
      visit.patientId || null,
      visit.patientName,
      visit.doctorId || null,
      visit.appointmentId || null,
      visit.visitDate,
      visit.visitType || "new",
      visit.chiefComplaint || "",
      visit.vitalsBp || "",
      visit.vitalsPulse || null,
      visit.vitalsTemp || null,
      visit.vitalsWeight || null,
      visit.vitalsHeight || null,
      visit.vitalsSpo2 || null,
      visit.vitalsRr || null,
      visit.status,
      visit.consultationFee || 0,
      JSON.stringify(visit.metadata || {})
    ]
  );
}

export async function upsertSeedAssessment(client, assessment) {
  await client.query(
    `
    INSERT INTO ayurveda_assessments (
      id, patient_id, visit_id, doctor_id, assessment_date, prakriti_vata, prakriti_pitta, prakriti_kapha,
      prakriti_dominant, nadi_pariksha, nadi_type, jihva_pariksha, agni_status, koshtha_nature,
      vikriti_assessment, observations, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      $15, $16, $17::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      visit_id = EXCLUDED.visit_id,
      doctor_id = EXCLUDED.doctor_id,
      assessment_date = EXCLUDED.assessment_date,
      prakriti_vata = EXCLUDED.prakriti_vata,
      prakriti_pitta = EXCLUDED.prakriti_pitta,
      prakriti_kapha = EXCLUDED.prakriti_kapha,
      prakriti_dominant = EXCLUDED.prakriti_dominant,
      nadi_pariksha = EXCLUDED.nadi_pariksha,
      nadi_type = EXCLUDED.nadi_type,
      jihva_pariksha = EXCLUDED.jihva_pariksha,
      agni_status = EXCLUDED.agni_status,
      koshtha_nature = EXCLUDED.koshtha_nature,
      vikriti_assessment = EXCLUDED.vikriti_assessment,
      observations = EXCLUDED.observations,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    `,
    [
      assessment.id,
      assessment.patientId || null,
      assessment.visitId || null,
      assessment.doctorId || null,
      assessment.assessmentDate,
      assessment.prakritiVata ?? "",
      assessment.prakritiPitta ?? "",
      assessment.prakritiKapha ?? "",
      assessment.prakritiDominant || "",
      assessment.nadiPariksha || "",
      assessment.nadiType || "",
      assessment.jihvaPariksha || "",
      assessment.agniStatus || "",
      assessment.koshthaNature || "",
      assessment.vikritiAssessment || "",
      assessment.observations || "",
      JSON.stringify(assessment.metadata || {})
    ]
  );
}

export async function upsertSeedPrescription(client, prescription) {
  await client.query(
    `
    INSERT INTO prescriptions (
      id, prescription_number, patient_id, patient_name, doctor_id, visit_id, prescription_date,
      diagnosis, diagnosis_ayurvedic, nidana, samprapti, chikitsa_sutra, diet_recommendations,
      follow_up_date, is_dispensed, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
    ON CONFLICT (prescription_number) DO UPDATE
    SET
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      doctor_id = EXCLUDED.doctor_id,
      visit_id = EXCLUDED.visit_id,
      prescription_date = EXCLUDED.prescription_date,
      diagnosis = EXCLUDED.diagnosis,
      diagnosis_ayurvedic = EXCLUDED.diagnosis_ayurvedic,
      nidana = EXCLUDED.nidana,
      samprapti = EXCLUDED.samprapti,
      chikitsa_sutra = EXCLUDED.chikitsa_sutra,
      diet_recommendations = EXCLUDED.diet_recommendations,
      follow_up_date = EXCLUDED.follow_up_date,
      is_dispensed = EXCLUDED.is_dispensed,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    `,
    [
      prescription.id,
      prescription.prescriptionNumber,
      prescription.patientId || null,
      prescription.patientName,
      prescription.doctorId || null,
      prescription.visitId || null,
      prescription.prescriptionDate,
      prescription.diagnosis,
      prescription.diagnosisAyurvedic || "",
      prescription.nidana || "",
      prescription.samprapti || "",
      prescription.chikitsaSutra || "",
      prescription.dietRecommendations || "",
      prescription.followUpDate || null,
      prescription.isDispensed || false,
      JSON.stringify(prescription.metadata || {})
    ]
  );

  await client.query("DELETE FROM prescription_medicines WHERE prescription_id = $1", [prescription.id]);
  for (const medicine of prescription.medicines || []) {
    await client.query(
      `
      INSERT INTO prescription_medicines (
        id, prescription_id, medicine_id, medicine_name, dose, frequency, route, timing, duration_days,
        anupana, quantity_dispensed, special_instructions, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      `,
      [
        medicine.id,
        prescription.id,
        nullableUuid(medicine.medicineId),
        medicine.medicineName || "",
        medicine.dose || "",
        medicine.frequency || "",
        medicine.route || "oral",
        medicine.timing || "",
        Number(medicine.durationDays || 0),
        medicine.anupana || "",
        Number(medicine.quantityDispensed || 0),
        medicine.specialInstructions || "",
        JSON.stringify({ ...(medicine.metadata || {}), sourceMedicineId: medicine.medicineId || "" })
      ]
    );
  }
}
