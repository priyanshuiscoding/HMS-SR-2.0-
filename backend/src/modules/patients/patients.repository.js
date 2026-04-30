import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toTime } from "../../utils/dateTime.js";

export function toCamelPatient(row) {
  if (!row) {
    return null;
  }

  const metadata = row.metadata || {};

  return {
    id: row.id,
    uhid: row.uhid,
    registrationNumber: row.registration_number || "",
    opdIpdNumber: row.opd_ipd_number || "",
    patientType: row.patient_type || "new",
    title: row.title || "",
    firstName: row.first_name,
    lastName: row.last_name || "",
    fullName: row.full_name,
    dateOfBirth: toIsoDate(row.date_of_birth),
    ageYears: row.age_years || "",
    gender: row.gender || "",
    bloodGroup: row.blood_group || "",
    maritalStatus: row.marital_status || "",
    occupation: row.occupation || "",
    phone: row.phone || "",
    altPhone: row.alt_phone || "",
    email: row.email || "",
    address: row.address || "",
    houseStreet: row.house_street || "",
    areaVillage: row.area_village || "",
    cityDistrict: row.city || "",
    city: row.city || "",
    state: row.state || "",
    pincode: row.pincode || "",
    idType: row.id_type || "",
    idNumber: metadata.idNumber || "",
    emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "",
    registrationDate: toIsoDate(row.registration_date),
    registrationTime: toTime(row.registration_time),
    referredBy: row.referred_by || "",
    photoUrl: row.photo_url || "",
    sourceDocument: row.source_document || "",
    clinicalNotes: row.clinical_notes || [],
    createdBy: row.created_by || "",
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowParams(patient) {
  return [
    patient.id,
    patient.uhid,
    patient.registrationNumber || "",
    patient.opdIpdNumber || "",
    patient.patientType || "new",
    patient.title || "",
    patient.firstName,
    patient.lastName || "",
    patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
    patient.dateOfBirth || null,
    patient.ageYears || null,
    patient.gender || "",
    patient.bloodGroup || "",
    patient.maritalStatus || "",
    patient.occupation || "",
    patient.phone,
    patient.altPhone || "",
    patient.email || "",
    patient.address || "",
    patient.houseStreet || "",
    patient.areaVillage || "",
    patient.cityDistrict || patient.city || "",
    patient.state || "Madhya Pradesh",
    patient.pincode || "",
    patient.idType || "",
    patient.emergencyContactName || "",
    patient.emergencyContactPhone || "",
    patient.registrationDate || null,
    patient.registrationTime || null,
    patient.referredBy || "",
    patient.photoUrl || "",
    patient.sourceDocument || "",
    JSON.stringify(patient.clinicalNotes || []),
    patient.createdBy || null,
    JSON.stringify({ ...(patient.metadata || {}), idNumber: patient.idNumber || "" })
  ];
}

export async function findPatients(queryParams = {}) {
  const search = String(queryParams.search || "").trim().toLowerCase();
  const city = String(queryParams.city || "").trim().toLowerCase();
  const conditions = ["deleted_at IS NULL"];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`
      (
        LOWER(uhid) LIKE $${params.length}
        OR LOWER(COALESCE(registration_number, '')) LIKE $${params.length}
        OR LOWER(COALESCE(opd_ipd_number, '')) LIKE $${params.length}
        OR LOWER(full_name) LIKE $${params.length}
        OR LOWER(phone) LIKE $${params.length}
        OR LOWER(COALESCE(metadata->>'idNumber', '')) LIKE $${params.length}
      )
    `);
  }

  if (city) {
    params.push(city);
    conditions.push(`LOWER(city) = $${params.length}`);
  }

  const result = await query(
    `
    SELECT *
    FROM patients
    WHERE ${conditions.join(" AND ")}
    ORDER BY registration_date DESC NULLS LAST, registration_time DESC NULLS LAST, created_at DESC
    `,
    params
  );

  return result.rows.map(toCamelPatient);
}

export async function findPatientById(id) {
  const result = await query("SELECT * FROM patients WHERE id = $1 AND deleted_at IS NULL", [id]);
  return toCamelPatient(result.rows[0]);
}

export async function patientPhoneExists(phone, excludeId = "") {
  const result = await query(
    "SELECT 1 FROM patients WHERE phone = $1 AND id::text <> COALESCE($2, '') AND deleted_at IS NULL LIMIT 1",
    [phone, excludeId || ""]
  );
  return result.rowCount > 0;
}

export async function insertPatient(patient) {
  const result = await query(
    `
    INSERT INTO patients (
      id, uhid, registration_number, opd_ipd_number, patient_type, title, first_name, last_name, full_name,
      date_of_birth, age_years, gender, blood_group, marital_status, occupation, phone, alt_phone, email,
      address, house_street, area_village, city, state, pincode, id_type, emergency_contact_name,
      emergency_contact_phone, registration_date, registration_time, referred_by, photo_url, source_document,
      clinical_notes, created_by, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26,
      $27, $28, $29, $30, $31, $32,
      $33::jsonb, $34, $35::jsonb
    )
    RETURNING *
    `,
    rowParams(patient)
  );

  return toCamelPatient(result.rows[0]);
}

export async function upsertSeedPatient(client, patient) {
  await client.query(
    `
    INSERT INTO patients (
      id, uhid, registration_number, opd_ipd_number, patient_type, title, first_name, last_name, full_name,
      date_of_birth, age_years, gender, blood_group, marital_status, occupation, phone, alt_phone, email,
      address, house_street, area_village, city, state, pincode, id_type, emergency_contact_name,
      emergency_contact_phone, registration_date, registration_time, referred_by, photo_url, source_document,
      clinical_notes, created_by, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26,
      $27, $28, $29, $30, $31, $32,
      $33::jsonb, $34, $35::jsonb
    )
    ON CONFLICT (uhid) DO UPDATE
    SET
      registration_number = EXCLUDED.registration_number,
      opd_ipd_number = EXCLUDED.opd_ipd_number,
      patient_type = EXCLUDED.patient_type,
      title = EXCLUDED.title,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      date_of_birth = EXCLUDED.date_of_birth,
      age_years = EXCLUDED.age_years,
      gender = EXCLUDED.gender,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      referred_by = EXCLUDED.referred_by,
      source_document = EXCLUDED.source_document,
      clinical_notes = EXCLUDED.clinical_notes,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    `,
    rowParams(patient)
  );
}

export async function updatePatientRecord(id, patient) {
  const result = await query(
    `
    UPDATE patients
    SET
      registration_number = $2,
      opd_ipd_number = $3,
      patient_type = $4,
      title = $5,
      first_name = $6,
      last_name = $7,
      full_name = $8,
      date_of_birth = $9,
      age_years = $10,
      gender = $11,
      blood_group = $12,
      marital_status = $13,
      occupation = $14,
      phone = $15,
      alt_phone = $16,
      email = $17,
      address = $18,
      house_street = $19,
      area_village = $20,
      city = $21,
      state = $22,
      pincode = $23,
      id_type = $24,
      emergency_contact_name = $25,
      emergency_contact_phone = $26,
      referred_by = $27,
      metadata = $28::jsonb,
      updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [
      id,
      patient.registrationNumber || "",
      patient.opdIpdNumber || "",
      patient.patientType || "new",
      patient.title || "",
      patient.firstName,
      patient.lastName || "",
      patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      patient.dateOfBirth || null,
      patient.ageYears || null,
      patient.gender || "",
      patient.bloodGroup || "",
      patient.maritalStatus || "",
      patient.occupation || "",
      patient.phone,
      patient.altPhone || "",
      patient.email || "",
      patient.address || "",
      patient.houseStreet || "",
      patient.areaVillage || "",
      patient.cityDistrict || patient.city || "",
      patient.state || "Madhya Pradesh",
      patient.pincode || "",
      patient.idType || "",
      patient.emergencyContactName || "",
      patient.emergencyContactPhone || "",
      patient.referredBy || "",
      JSON.stringify({ ...(patient.metadata || {}), idNumber: patient.idNumber || "" })
    ]
  );

  return toCamelPatient(result.rows[0]);
}

export async function getNextPatientSequence() {
  return withTransaction(async (client) => {
    const result = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM patients");
    return result.rows[0].next_number;
  });
}
