import crypto from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { pgPool } from "../backend/src/config/postgres.js";
import { readPuruPatientExport } from "./puru-patient-export.mjs";

const EMPTY_VALUES = new Set(["", "0", "00", "000", "na", "n/a", "nil", "none", "null", "undefined", "-"]);
const TITLES = new Map([
  ["baby", "Baby"], ["br", "Br"], ["dr", "Dr"], ["ku", "Ku"], ["master", "Master"],
  ["miss", "Miss"], ["mr", "Mr"], ["mrs", "Mrs"], ["ms", "Ms"]
]);

function parseArguments(argv) {
  const options = { apply: false, file: "", backup: "", confirmDb: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--backup") options.backup = argv[++index] || "";
    else if (argument === "--confirm-db") options.confirmDb = argv[++index] || "";
    else if (!argument.startsWith("--") && !options.file) options.file = argument;
    else throw new Error(`Unknown or incomplete argument: ${argument}`);
  }
  if (!options.file) {
    throw new Error("Usage: node scripts/import-puru-patients.mjs <export.csv> [--apply --backup <verified.dump> --confirm-db <database>]");
  }
  return options;
}

function cleanNullable(value) {
  const text = String(value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  return EMPTY_VALUES.has(text.toLowerCase()) ? "" : text;
}

function cleanPhone(value) {
  const digits = cleanNullable(value).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function normalizeGender(value) {
  const text = cleanNullable(value).toLowerCase();
  if (text === "m" || text === "male") return "male";
  if (text === "f" || text === "female") return "female";
  return text ? "other" : "";
}

function parseDate(value) {
  const text = cleanNullable(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized;
}

function normalizeTitle(value) {
  const text = cleanNullable(value).toLowerCase().replace(/\./g, "");
  return TITLES.get(text) || (text ? text[0].toUpperCase() + text.slice(1) : "");
}

function splitName(row) {
  const title = normalizeTitle(row.salutation);
  const sourceFullName = cleanNullable(row.full_name);
  const firstName = cleanNullable(row.first_name);
  const middleName = cleanNullable(row.middle_name);
  const lastName = cleanNullable(row.last_name);
  const fullName = sourceFullName || [title, firstName, middleName, lastName].filter(Boolean).join(" ");
  const withoutTitle = title && fullName.toLowerCase().startsWith(`${title.toLowerCase()} `)
    ? fullName.slice(title.length).trim()
    : fullName;
  const parts = withoutTitle.split(/\s+/).filter(Boolean);
  return {
    title,
    firstName: firstName || parts[0] || "",
    lastName: lastName || parts.slice(1).join(" "),
    fullName
  };
}

function stableUuid(source) {
  const digest = crypto.createHash("sha1").update(source).digest("hex").slice(0, 32);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}

function parseAgeYears(value) {
  const days = Number(cleanNullable(value));
  if (!Number.isFinite(days) || days < 0) return null;
  return Math.floor(days / 365.2425);
}

function toPatient(row, sourceName, sourceHash) {
  const names = splitName(row);
  const addressObject = row.address && typeof row.address === "object" ? row.address : {};
  const houseStreet = cleanNullable(addressObject.addressLine1 || addressObject.line1 || addressObject.name);
  const areaVillage = [addressObject.addressLine2, addressObject.addressLine3].map(cleanNullable).filter(Boolean).join(", ");
  const city = cleanNullable(addressObject.city);
  const state = cleanNullable(addressObject.state) || "Madhya Pradesh";
  const pincode = cleanNullable(addressObject.pinCode || addressObject.pincode);
  const address = cleanNullable(row.address_string)
    || [houseStreet, areaVillage, city, state, pincode].filter(Boolean).join(", ");
  const lastUpdated = cleanNullable(row.last_time_updated);
  const registrationDate = parseDate(lastUpdated);
  const ppin = cleanNullable(row.ppin);

  return {
    id: stableUuid(`puru-patient:${ppin}`),
    registrationNumber: ppin,
    patientType: "old",
    ...names,
    fatherName: cleanNullable(row.fathers_name),
    dateOfBirth: parseDate(row.dob),
    ageYears: parseAgeYears(row.current_age_in_days),
    gender: normalizeGender(row.gender),
    phone: cleanPhone(row.phone_number),
    altPhone: cleanPhone(row.phone_number2),
    email: cleanNullable(row.email),
    address,
    houseStreet,
    areaVillage,
    city,
    state,
    pincode,
    registrationDate,
    referredBy: "Puru patient reconciliation",
    sourceDocument: sourceName,
    metadata: {
      puruImport: true,
      ppin,
      sourceUuid: cleanNullable(row.uuid),
      sourceLastUpdated: lastUpdated,
      sourceSha256: sourceHash,
      registrationDateSource: "last_time_updated_fallback"
    }
  };
}

function normalizeName(value) {
  return cleanNullable(value)
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|master|baby|dr|br|ku)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function validatePatient(patient) {
  const reasons = [];
  if (!/^\d{1,6}$/.test(patient.registrationNumber)) reasons.push("invalid_ppin");
  if (!patient.fullName || !patient.firstName) reasons.push("missing_name");
  if (!patient.registrationDate) reasons.push("invalid_last_updated_date");
  if (patient.dateOfBirth && patient.dateOfBirth > patient.registrationDate) reasons.push("dob_after_registration_date");
  if (patient.phone && patient.phone.length !== 10) reasons.push("invalid_primary_phone");
  if (patient.altPhone && patient.altPhone.length !== 10) reasons.push("invalid_alternate_phone");
  const limits = {
    registrationNumber: 30, title: 20, firstName: 80, lastName: 80, fullName: 180, fatherName: 120,
    phone: 20, altPhone: 20, email: 140, city: 80, state: 80, pincode: 12, referredBy: 120
  };
  for (const [field, limit] of Object.entries(limits)) {
    if (String(patient[field] ?? "").length > limit) reasons.push(`${field}_too_long`);
  }
  return reasons;
}

function possibleDuplicateReason(patient, existingPatients) {
  const sourceName = normalizeName(patient.fullName);
  const sourceFather = normalizeName(patient.fatherName);
  for (const existing of existingPatients) {
    const existingName = normalizeName(existing.full_name);
    const samePhone = patient.phone && patient.phone.length === 10 && cleanPhone(existing.phone) === patient.phone;
    const sameName = sourceName && existingName === sourceName;
    const sameDob = patient.dateOfBirth && existing.date_of_birth && String(existing.date_of_birth).slice(0, 10) === patient.dateOfBirth;
    const sameFather = sourceFather && normalizeName(existing.father_name) === sourceFather;
    if (samePhone && sameName) return "same_name_and_phone";
    if (sameName && sameDob) return "same_name_and_dob";
    if (sameName && sameFather) return "same_name_and_father";
    if (samePhone) return "same_phone";
  }
  return "";
}

async function verifyBackup(filePath) {
  if (!filePath) throw new Error("Apply mode requires --backup <verified.dump>.");
  await access(filePath);
  const details = await stat(filePath);
  if (!details.isFile() || details.size < 1024) {
    throw new Error("The supplied backup is missing, is not a file, or is too small to be a valid database dump.");
  }
}

async function databaseIdentity(client) {
  const result = await client.query("SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port");
  return result.rows[0];
}

async function fetchExistingPatients(client) {
  const result = await client.query(`
    SELECT id, uhid, registration_number, full_name, father_name, date_of_birth, phone
    FROM patients
    WHERE deleted_at IS NULL
  `);
  return result.rows;
}

function reconcile(sourcePatients, existingPatients) {
  const ppinSet = new Set(
    existingPatients.map((patient) => cleanNullable(patient.registration_number)).filter(Boolean)
  );
  const skippedExisting = [];
  const invalid = [];
  const possibleDuplicates = [];
  const eligible = [];

  for (const patient of sourcePatients) {
    if (ppinSet.has(patient.registrationNumber)) {
      skippedExisting.push(patient);
      continue;
    }
    const validationReasons = validatePatient(patient);
    if (validationReasons.length) {
      invalid.push({ patient, reasons: validationReasons });
      continue;
    }
    const duplicateReason = possibleDuplicateReason(patient, existingPatients);
    if (duplicateReason) {
      possibleDuplicates.push({ patient, reason: duplicateReason });
      continue;
    }
    eligible.push(patient);
  }
  return { skippedExisting, invalid, possibleDuplicates, eligible };
}

async function nextUhidState(client, patients) {
  const years = [...new Set(patients.map((patient) => patient.registrationDate.slice(2, 4)))].sort();
  const counters = new Map();
  for (const suffix of years) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`patients-uhid-${suffix}`]);
    const result = await client.query(`
      SELECT COALESCE(MAX(SUBSTRING(uhid FROM 6 FOR 6)::int), 0) AS maximum
      FROM patients
      WHERE uhid ~ $1
    `, [`^SRH${suffix}[0-9]{6}$`]);
    counters.set(suffix, Number(result.rows[0].maximum));
  }
  return counters;
}

async function insertPatient(client, patient, uhid) {
  await client.query(`
    INSERT INTO patients (
      id, uhid, registration_number, opd_ipd_number, patient_type, title, first_name, last_name, full_name, father_name,
      date_of_birth, age_years, gender, blood_group, marital_status, occupation, phone, alt_phone, email,
      address, house_street, area_village, city, state, pincode, id_type, emergency_contact_name,
      emergency_contact_phone, registration_date, registration_time, referred_by, photo_url, source_document,
      clinical_notes, created_by, metadata
    ) VALUES (
      $1, $2, $3, '', $4, $5, $6, $7, $8, $9,
      $10, $11, $12, '', '', '', $13, $14, $15,
      $16, $17, $18, $19, $20, $21, '', '',
      '', $22, NULL, $23, '', $24,
      '[]'::jsonb, NULL, $25::jsonb
    )
  `, [
    patient.id, uhid, patient.registrationNumber, patient.patientType, patient.title, patient.firstName,
    patient.lastName, patient.fullName, patient.fatherName, patient.dateOfBirth, patient.ageYears, patient.gender,
    patient.phone, patient.altPhone, patient.email, patient.address, patient.houseStreet, patient.areaVillage,
    patient.city, patient.state, patient.pincode, patient.registrationDate, patient.referredBy,
    patient.sourceDocument, JSON.stringify({ ...patient.metadata, assignedUhid: uhid })
  ]);
}

function printReport(mode, identity, sourcePatients, existingPatients, result, sourceHash, inserted = 0) {
  const countReasons = (entries, key) => entries.reduce((counts, entry) => {
    const reasons = Array.isArray(entry[key]) ? entry[key] : [entry[key]];
    for (const reason of reasons) counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});
  const eligibleRegistrationYears = result.eligible.reduce((counts, patient) => {
    const year = patient.registrationDate.slice(0, 4);
    counts[year] = (counts[year] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    mode,
    database: identity.database,
    serverAddress: identity.address || "local-socket",
    serverPort: identity.port,
    sourceSha256: sourceHash,
    sourceRows: sourcePatients.length,
    existingServerPatientRows: existingPatients.length,
    existingPpinSkipped: result.skippedExisting.length,
    possibleManualDuplicatesSkipped: result.possibleDuplicates.length,
    possibleDuplicateReasons: countReasons(result.possibleDuplicates, "reason"),
    invalidRowsSkipped: result.invalid.length,
    invalidReasons: countReasons(result.invalid, "reasons"),
    eligibleMissingPatients: result.eligible.length,
    eligibleRegistrationYears,
    inserted
  }, null, 2));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const resolvedFile = path.resolve(options.file);
  const sourceBytes = await readFile(resolvedFile);
  const sourceHash = crypto.createHash("sha256").update(sourceBytes).digest("hex");
  const rows = await readPuruPatientExport(resolvedFile);
  const sourcePatients = rows.map((row) => toPatient(row, path.basename(resolvedFile), sourceHash));
  const client = await pgPool.connect();

  try {
    const identity = await databaseIdentity(client);
    let existingPatients = await fetchExistingPatients(client);
    let result = reconcile(sourcePatients, existingPatients);

    if (!options.apply) {
      printReport("dry-run", identity, sourcePatients, existingPatients, result, sourceHash);
      return;
    }

    if (!options.confirmDb || options.confirmDb !== identity.database) {
      throw new Error(`Apply refused: --confirm-db must exactly match the connected database (${identity.database}).`);
    }
    await verifyBackup(path.resolve(options.backup));

    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('puru-patient-insert-only'))");
      existingPatients = await fetchExistingPatients(client);
      result = reconcile(sourcePatients, existingPatients);
      const counters = await nextUhidState(client, result.eligible);
      let inserted = 0;
      for (const patient of result.eligible.sort((left, right) => Number(left.registrationNumber) - Number(right.registrationNumber))) {
        const suffix = patient.registrationDate.slice(2, 4);
        const nextNumber = (counters.get(suffix) || 0) + 1;
        counters.set(suffix, nextNumber);
        const uhid = `SRH${suffix}${String(nextNumber).padStart(6, "0")}`;
        await insertPatient(client, patient, uhid);
        inserted += 1;
      }
      await client.query("COMMIT");
      printReport("apply", identity, sourcePatients, existingPatients, result, sourceHash, inserted);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pgPool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
