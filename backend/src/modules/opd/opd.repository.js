import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toTime } from "../../utils/dateTime.js";
import { nullableUuid } from "../../utils/ids.js";

// Numeric vitals columns are INTEGER/NUMERIC in Postgres. Blank form fields arrive
// as "" (not null), which the DB rejects with "invalid input syntax". Coerce any
// empty/undefined value to null so COALESCE keeps the existing value.
function nullableNumber(value) {
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
    prakritiVata: row.prakriti_vata ?? 0,
    prakritiPitta: row.prakriti_pitta ?? 0,
    prakritiKapha: row.prakriti_kapha ?? 0,
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
      AND a.metadata->'consultationPayment'->>'status' = 'paid'
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

export async function listVisitRecords() {
  const result = await query("SELECT * FROM opd_visits ORDER BY visit_date DESC, created_at DESC");
  return result.rows.map(toCamelVisit);
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
  const result = await query(
    `
    UPDATE opd_visits
    SET
      vitals_bp = COALESCE($2, vitals_bp),
      vitals_pulse = COALESCE($3, vitals_pulse),
      vitals_temp = COALESCE($4, vitals_temp),
      vitals_weight = COALESCE($5, vitals_weight),
      vitals_height = COALESCE($6, vitals_height),
      vitals_spo2 = COALESCE($7, vitals_spo2),
      vitals_rr = COALESCE($8, vitals_rr),
      status = CASE WHEN status = 'waiting' THEN 'in_consultation' ELSE status END,
      metadata = COALESCE(metadata, '{}'::jsonb) || $9::jsonb,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      payload.vitalsBp === "" ? null : payload.vitalsBp ?? null,
      nullableNumber(payload.vitalsPulse),
      nullableNumber(payload.vitalsTemp),
      nullableNumber(payload.vitalsWeight),
      nullableNumber(payload.vitalsHeight),
      nullableNumber(payload.vitalsSpo2),
      nullableNumber(payload.vitalsRr),
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

export async function listAssessmentRecords() {
  const result = await query("SELECT * FROM ayurveda_assessments ORDER BY assessment_date DESC, created_at DESC");
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
      assessment.prakritiVata ?? 0,
      assessment.prakritiPitta ?? 0,
      assessment.prakritiKapha ?? 0,
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

export async function listPrescriptionRecords() {
  const prescriptionResult = await query("SELECT * FROM prescriptions ORDER BY prescription_date DESC, created_at DESC");
  const medicineResult = await query("SELECT * FROM prescription_medicines ORDER BY id");
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
      assessment.prakritiVata ?? 0,
      assessment.prakritiPitta ?? 0,
      assessment.prakritiKapha ?? 0,
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
