import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate } from "../../utils/dateTime.js";

function toCamelCertificate(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    certificateType: row.certificate_type,
    patientId: row.patient_id || null,
    patientName: row.patient_name,
    patientAge: row.patient_age ?? "",
    patientGender: row.patient_gender || "",
    patientMobile: row.patient_mobile || "",
    uhid: row.uhid || "",
    doctorId: row.doctor_id || "",
    doctorName: row.doctor_name || "",
    doctorRegistrationNumber: row.doctor_registration_number || "",
    certificateDate: toIsoDate(row.certificate_date),
    diagnosis: row.diagnosis || "",
    activity: row.activity || "",
    fitDate: toIsoDate(row.fit_date),
    leaveFromDate: toIsoDate(row.leave_from_date),
    leaveToDate: toIsoDate(row.leave_to_date),
    totalLeaveDays: row.total_leave_days ?? "",
    admissionDate: toIsoDate(row.admission_date),
    dischargeDate: toIsoDate(row.discharge_date),
    treatment: row.treatment || "",
    status: row.status || "issued",
    createdBy: row.created_by || "",
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function insertParams(certificate, certificateNumber) {
  return [
    certificate.id,
    certificateNumber,
    certificate.certificateType,
    certificate.patientId || null,
    certificate.patientName,
    certificate.patientAge || null,
    certificate.patientGender || "",
    certificate.patientMobile || "",
    certificate.uhid || "",
    certificate.doctorId || null,
    certificate.doctorName,
    certificate.doctorRegistrationNumber || "",
    certificate.certificateDate,
    certificate.diagnosis || "",
    certificate.activity || "",
    certificate.fitDate || null,
    certificate.leaveFromDate || null,
    certificate.leaveToDate || null,
    certificate.totalLeaveDays || null,
    certificate.admissionDate || null,
    certificate.dischargeDate || null,
    certificate.treatment || "",
    certificate.status || "issued",
    certificate.createdBy || null,
    JSON.stringify(certificate.metadata || {})
  ];
}

export async function listCertificateRecords(queryParams = {}) {
  const search = String(queryParams.search || "").trim().toLowerCase();
  const type = String(queryParams.type || "").trim();
  const patientId = String(queryParams.patientId || "").trim();
  const conditions = ["mc.deleted_at IS NULL"];
  const params = [];

  if (type) {
    params.push(type);
    conditions.push(`mc.certificate_type = $${params.length}`);
  }

  if (patientId) {
    params.push(patientId);
    conditions.push(`mc.patient_id::text = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`
      (
        LOWER(mc.certificate_number) LIKE $${params.length}
        OR LOWER(mc.patient_name) LIKE $${params.length}
        OR LOWER(mc.uhid) LIKE $${params.length}
        OR LOWER(mc.patient_mobile) LIKE $${params.length}
        OR LOWER(mc.diagnosis) LIKE $${params.length}
      )
    `);
  }

  const result = await query(
    `
    SELECT mc.*
    FROM medical_certificates mc
    WHERE ${conditions.join(" AND ")}
    ORDER BY mc.certificate_date DESC, mc.created_at DESC
    `,
    params
  );

  return result.rows.map(toCamelCertificate);
}

export async function findCertificateRecordById(id) {
  const result = await query(
    "SELECT * FROM medical_certificates WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );

  return toCamelCertificate(result.rows[0]);
}

export async function insertCertificateRecord(certificate) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["medical-certificate:number"]);
    const countResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM medical_certificates");
    const certificateNumber = `MC-${new Date().getFullYear()}-${String(countResult.rows[0].next_number).padStart(5, "0")}`;
    const result = await client.query(
      `
      INSERT INTO medical_certificates (
        id, certificate_number, certificate_type, patient_id, patient_name, patient_age, patient_gender,
        patient_mobile, uhid, doctor_id, doctor_name, doctor_registration_number, certificate_date,
        diagnosis, activity, fit_date, leave_from_date, leave_to_date, total_leave_days,
        admission_date, discharge_date, treatment, status, created_by, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25::jsonb
      )
      RETURNING *
      `,
      insertParams(certificate, certificateNumber)
    );

    return toCamelCertificate(result.rows[0]);
  });
}
