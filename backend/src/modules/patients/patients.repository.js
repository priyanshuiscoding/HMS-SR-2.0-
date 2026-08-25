import { query } from "../../config/postgres.js";
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
    regNo: row.registration_number || "",
    reg_no: row.registration_number || "",
    ppin: row.registration_number || "",
    opdIpdNumber: row.opd_ipd_number || "",
    patientType: row.patient_type || "new",
    type: row.patient_type || "new",
    title: row.title || "",
    firstName: row.first_name,
    lastName: row.last_name || "",
    fullName: row.full_name,
    fatherName: row.father_name || "",
    dateOfBirth: toIsoDate(row.date_of_birth),
    ageYears: row.age_years || "",
    gender: row.gender || "",
    bloodGroup: row.blood_group || "",
    maritalStatus: row.marital_status || "",
    occupation: row.occupation || "",
    phone: row.phone || "",
    mobile: row.phone || "",
    altPhone: row.alt_phone || "",
    email: row.email || "",
    address: row.address || "",
    houseStreet: row.house_street || "",
    areaVillage: row.area_village || "",
    cityDistrict: row.city || "",
    cityOrDistrict: row.city || "",
    city: row.city || "",
    state: row.state || "",
    pincode: row.pincode || "",
    idType: row.id_type || "",
    idNumber: metadata.idNumber || "",
    emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "",
    registrationDate: toIsoDate(row.registration_date),
    registeredDate: toIsoDate(row.registration_date),
    registrationTime: toTime(row.registration_time),
    referredBy: row.referred_by || "",
    photoUrl: row.photo_url || "",
    sourceDocument: row.source_document || "",
    clinicalNotes: row.clinical_notes || [],
    createdBy: row.created_by || "",
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    deletedBy: row.deleted_by || "",
    deletionReason: row.deletion_reason || ""
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
    patient.fatherName || "",
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
  const searchDigits = search.replace(/\D/g, "");
  const isShortNumericSearch = /^\d{1,6}$/.test(search);
  const city = String(queryParams.city || "").trim().toLowerCase();
  const conditions = ["deleted_at IS NULL"];
  const params = [];
  const countParameterAnchors = [];
  let orderBy = `
    CASE WHEN patient_type = 'old' THEN 1 ELSE 0 END,
    registration_date DESC NULLS LAST,
    registration_time DESC NULLS LAST,
    created_at DESC,
    CASE
      WHEN patient_type = 'old' AND COALESCE(registration_number, '') ~ '^[0-9]+$'
      THEN registration_number::int
      ELSE NULL
    END ASC NULLS LAST
  `;

  if (search) {
    params.push(search);
    const exactSearchParam = params.length;
    params.push(searchDigits ? searchDigits.padStart(6, "0") : "");
    const paddedDigitsParam = params.length;

    if (isShortNumericSearch) {
      conditions.push(`
        (
          LOWER(COALESCE(registration_number, '')) = $${exactSearchParam}
          OR LOWER(COALESCE(opd_ipd_number, '')) = $${exactSearchParam}
          OR LOWER(COALESCE(metadata->>'legacyUhid', '')) = $${exactSearchParam}
          OR ($${paddedDigitsParam} <> '' AND RIGHT(uhid, 6) = $${paddedDigitsParam})
        )
      `);

      orderBy = `
        CASE
          WHEN LOWER(COALESCE(registration_number, '')) = $${exactSearchParam} THEN 0
          WHEN LOWER(COALESCE(opd_ipd_number, '')) = $${exactSearchParam}
            OR LOWER(COALESCE(metadata->>'legacyUhid', '')) = $${exactSearchParam}
            OR ($${paddedDigitsParam} <> '' AND RIGHT(uhid, 6) = $${paddedDigitsParam})
          THEN 1
          ELSE 2
        END,
        CASE
          WHEN COALESCE(registration_number, '') ~ '^[0-9]+$' THEN registration_number::int
          ELSE NULL
        END ASC NULLS LAST,
        registration_date DESC NULLS LAST,
        registration_time DESC NULLS LAST,
        created_at DESC
      `;
    } else {
      params.push(`%${search}%`);
      const searchLikeParam = params.length;
      countParameterAnchors.push(exactSearchParam, paddedDigitsParam);
      conditions.push(`
        (
          LOWER(uhid) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(registration_number, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(opd_ipd_number, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(metadata->>'legacyUhid', '')) LIKE $${searchLikeParam}
          OR LOWER(full_name) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(father_name, '')) LIKE $${searchLikeParam}
          OR LOWER(phone) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(alt_phone, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(address, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(house_street, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(area_village, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(city, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(pincode, '')) LIKE $${searchLikeParam}
          OR LOWER(COALESCE(metadata->>'idNumber', '')) LIKE $${searchLikeParam}
        )
      `);

      orderBy = `
        CASE
          WHEN LOWER(COALESCE(registration_number, '')) = $${exactSearchParam}
            OR LOWER(uhid) = $${exactSearchParam}
            OR LOWER(COALESCE(opd_ipd_number, '')) = $${exactSearchParam}
            OR LOWER(COALESCE(metadata->>'legacyUhid', '')) = $${exactSearchParam}
            OR ($${paddedDigitsParam} <> '' AND RIGHT(uhid, 6) = $${paddedDigitsParam})
          THEN 0
          WHEN LOWER(COALESCE(registration_number, '')) LIKE $${searchLikeParam}
            OR LOWER(uhid) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(opd_ipd_number, '')) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(metadata->>'legacyUhid', '')) LIKE $${searchLikeParam}
          THEN 1
          WHEN LOWER(full_name) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(father_name, '')) LIKE $${searchLikeParam}
          THEN 2
          WHEN LOWER(phone) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(alt_phone, '')) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(metadata->>'idNumber', '')) LIKE $${searchLikeParam}
          THEN 3
          WHEN LOWER(COALESCE(address, '')) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(house_street, '')) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(area_village, '')) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(city, '')) LIKE $${searchLikeParam}
            OR LOWER(COALESCE(pincode, '')) LIKE $${searchLikeParam}
          THEN 4
          ELSE 5
        END,
        registration_date DESC NULLS LAST,
        registration_time DESC NULLS LAST,
        created_at DESC
      `;
    }
  }

  if (city) {
    params.push(city);
    conditions.push(`LOWER(city) = $${params.length}`);
  }

  const isPaginated = Number.isInteger(queryParams.pageSize) && Number.isInteger(queryParams.offset);
  let total = 0;
  let limitClause = "";
  if (isPaginated) {
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM patients
       WHERE ${conditions.join(" AND ")}
         ${countParameterAnchors.map((index) => `AND $${index}::text IS NOT NULL`).join("\n")}`,
      params
    );
    total = countResult.rows[0]?.total || 0;
    params.push(queryParams.pageSize);
    const limitParam = params.length;
    params.push(queryParams.offset);
    const offsetParam = params.length;
    limitClause = `LIMIT $${limitParam} OFFSET $${offsetParam}`;
  }

  const result = await query(
    `
    SELECT *
    FROM patients
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    ${limitClause}
    `,
    params
  );

  const items = result.rows.map(toCamelPatient);
  return isPaginated ? { items, total } : items;
}

export async function findPatientById(id) {
  const result = await query(
    `
    SELECT *
    FROM patients
    WHERE (id::text = $1 OR LOWER(uhid) = LOWER($1) OR LOWER(COALESCE(registration_number, '')) = LOWER($1))
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id]
  );
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
      id, uhid, registration_number, opd_ipd_number, patient_type, title, first_name, last_name, full_name, father_name,
      date_of_birth, age_years, gender, blood_group, marital_status, occupation, phone, alt_phone, email,
      address, house_street, area_village, city, state, pincode, id_type, emergency_contact_name,
      emergency_contact_phone, registration_date, registration_time, referred_by, photo_url, source_document,
      clinical_notes, created_by, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24, $25, $26, $27,
      $28, $29, $30, $31, $32, $33,
      $34::jsonb, $35, $36::jsonb
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
      id, uhid, registration_number, opd_ipd_number, patient_type, title, first_name, last_name, full_name, father_name,
      date_of_birth, age_years, gender, blood_group, marital_status, occupation, phone, alt_phone, email,
      address, house_street, area_village, city, state, pincode, id_type, emergency_contact_name,
      emergency_contact_phone, registration_date, registration_time, referred_by, photo_url, source_document,
      clinical_notes, created_by, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24, $25, $26, $27,
      $28, $29, $30, $31, $32, $33,
      $34::jsonb, $35, $36::jsonb
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
      father_name = EXCLUDED.father_name,
      date_of_birth = EXCLUDED.date_of_birth,
      age_years = EXCLUDED.age_years,
      gender = EXCLUDED.gender,
      blood_group = EXCLUDED.blood_group,
      marital_status = EXCLUDED.marital_status,
      occupation = EXCLUDED.occupation,
      phone = EXCLUDED.phone,
      alt_phone = EXCLUDED.alt_phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      house_street = EXCLUDED.house_street,
      area_village = EXCLUDED.area_village,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      pincode = EXCLUDED.pincode,
      id_type = EXCLUDED.id_type,
      emergency_contact_name = EXCLUDED.emergency_contact_name,
      emergency_contact_phone = EXCLUDED.emergency_contact_phone,
      registration_date = EXCLUDED.registration_date,
      registration_time = EXCLUDED.registration_time,
      referred_by = EXCLUDED.referred_by,
      photo_url = EXCLUDED.photo_url,
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
      father_name = $9,
      date_of_birth = $10,
      age_years = $11,
      gender = $12,
      blood_group = $13,
      marital_status = $14,
      occupation = $15,
      phone = $16,
      alt_phone = $17,
      email = $18,
      address = $19,
      house_street = $20,
      area_village = $21,
      city = $22,
      state = $23,
      pincode = $24,
      id_type = $25,
      emergency_contact_name = $26,
      emergency_contact_phone = $27,
      referred_by = $28,
      metadata = $29::jsonb,
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
      patient.fatherName || "",
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

export async function softDeletePatientRecord(id, deletedBy, deletionReason = "") {
  const result = await query(
    `
    UPDATE patients
    SET deleted_at = NOW(), deleted_by = $2, deletion_reason = $3, updated_at = NOW()
    WHERE (id::text = $1 OR LOWER(uhid) = LOWER($1) OR LOWER(COALESCE(registration_number, '')) = LOWER($1))
      AND deleted_at IS NULL
    RETURNING *
    `,
    [id, deletedBy || null, deletionReason]
  );

  return toCamelPatient(result.rows[0]);
}

export async function findDeletedPatients(queryParams = {}) {
  const search = String(queryParams.search || "").trim().toLowerCase();
  const params = [];
  const conditions = ["p.deleted_at IS NOT NULL"];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      LOWER(p.uhid) LIKE $${params.length}
      OR LOWER(COALESCE(p.registration_number, '')) LIKE $${params.length}
      OR LOWER(p.full_name) LIKE $${params.length}
      OR LOWER(COALESCE(p.phone, '')) LIKE $${params.length}
    )`);
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM patients p WHERE ${conditions.join(" AND ")}`,
    params
  );
  params.push(queryParams.pageSize);
  const limitParam = params.length;
  params.push(queryParams.offset);
  const offsetParam = params.length;

  const result = await query(
    `SELECT p.*, u.full_name AS deleted_by_name
     FROM patients p
     LEFT JOIN users u ON u.id = p.deleted_by
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.deleted_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  return {
    items: result.rows.map((row) => ({ ...toCamelPatient(row), deletedByName: row.deleted_by_name || "" })),
    total: countResult.rows[0]?.total || 0
  };
}

export async function restorePatientRecord(id) {
  const result = await query(
    `UPDATE patients
     SET deleted_at = NULL, deleted_by = NULL, deletion_reason = '', updated_at = NOW()
     WHERE id::text = $1 AND deleted_at IS NOT NULL
     RETURNING *`,
    [id]
  );
  return toCamelPatient(result.rows[0]);
}

export async function generateNextUhid() {
  const result = await query("SELECT nextval('patient_numeric_uhid_seq')::text AS next_number");
  return result.rows[0].next_number;
}
