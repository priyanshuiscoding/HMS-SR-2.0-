import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { pgPool } from "../config/postgres.js";
import { upsertSeedPatient } from "../modules/patients/patients.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_IMPORT_PATH = path.resolve(__dirname, "../../../data/old_patients.tsv");
const REGISTRATION_DATE = "2026-01-01";
const TITLES = ["Master", "Baby", "Miss", "Mrs", "Mr", "Ms", "Dr", "Br", "Ku"];

function stableUuid(source) {
  const hash = crypto.createHash("sha1").update(String(source)).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

function cleanCell(value) {
  const text = String(value ?? "").replace(/`/g, "").trim();
  return text && !["null", "nil", "undefined"].includes(text.toLowerCase()) ? text : "";
}

function cleanName(value) {
  return cleanCell(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGender(value) {
  const gender = cleanCell(value).toLowerCase();

  if (gender === "m" || gender === "male") {
    return "male";
  }

  if (gender === "f" || gender === "female") {
    return "female";
  }

  return gender ? "other" : "";
}

function splitName(fullName) {
  const normalized = cleanName(fullName);
  const title = TITLES.find((candidate) => normalized.toLowerCase().startsWith(`${candidate.toLowerCase()} `)) || "";
  const nameWithoutTitle = title ? normalized.slice(title.length).trim() : normalized;
  const parts = nameWithoutTitle.split(" ").filter(Boolean);
  const firstName = parts.shift() || normalized || "Unknown";
  const lastName = parts.join(" ");

  return {
    title,
    firstName,
    lastName,
    fullName: normalized || [title, firstName, lastName].filter(Boolean).join(" ")
  };
}

function parseTsv(content) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());

  if (!lines.length) {
    return [];
  }

  const header = lines[0].split("\t").map((cell) => cleanCell(cell));
  const expectedColumns = header.length;

  return lines.slice(1).map((line, index) => {
    const cells = line.split("\t");
    const normalizedCells = cells.length > expectedColumns
      ? [
        ...cells.slice(0, expectedColumns - 1),
        cells.slice(expectedColumns - 1).join(" ")
      ]
      : cells;

    return header.reduce((row, key, columnIndex) => {
      row[key] = cleanCell(normalizedCells[columnIndex]);
      row._sourceLine = index + 2;
      return row;
    }, {});
  });
}

function toPatient(row) {
  const ppin = cleanCell(row.ppin);
  const name = splitName(row.full_name);
  const fatherName = cleanName(row.fathers_name);
  const houseStreet = cleanCell(row.address_line1);
  const areaVillage = [row.address_line2, row.address_line3].map(cleanCell).filter(Boolean).join(", ");
  const city = cleanCell(row.city) || cleanCell(row.address_line3);
  const state = cleanCell(row.state) || "Madhya Pradesh";
  const pincode = cleanCell(row.pin_code);
  const address = [houseStreet, areaVillage, city, state, pincode].filter(Boolean).join(", ");

  return {
    id: stableUuid(`old-patient:${ppin || row._sourceLine}:${name.fullName}`),
    uhid: `OLD-PPIN-${String(ppin || row._sourceLine).padStart(5, "0")}`,
    registrationNumber: ppin,
    opdIpdNumber: "",
    patientType: "old",
    title: name.title,
    firstName: name.firstName,
    lastName: name.lastName,
    fullName: name.fullName,
    fatherName,
    dateOfBirth: null,
    ageYears: null,
    gender: normalizeGender(row.gender),
    bloodGroup: "",
    maritalStatus: "",
    occupation: "",
    phone: "",
    altPhone: "",
    email: "",
    address,
    houseStreet,
    areaVillage,
    cityDistrict: city,
    city,
    state,
    pincode,
    idType: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    registrationDate: REGISTRATION_DATE,
    registrationTime: null,
    referredBy: "Old patient register import",
    photoUrl: "",
    sourceDocument: "data/old_patients.tsv",
    clinicalNotes: [],
    createdBy: null,
    metadata: {
      oldPatientImport: true,
      ppin,
      sourceLine: row._sourceLine,
      raw: row
    }
  };
}

async function clearPatientData(client) {
  await client.query(`
    UPDATE beds
    SET patient_id = NULL,
        patient_name = '',
        status = CASE WHEN status = 'occupied' THEN 'available' ELSE status END,
        assigned_at = NULL,
        expected_discharge_date = NULL,
        note = '',
        updated_at = NOW()
  `);

  await client.query(`
    TRUNCATE TABLE
      patient_documents,
      payments,
      refunds,
      bill_items,
      bills,
      lab_order_tests,
      lab_orders,
      panchkarma_session_materials,
      panchkarma_sessions,
      prescription_medicines,
      prescriptions,
      ayurveda_assessments,
      opd_visits,
      appointments,
      ipd_notes,
      ipd_vitals,
      ipd_admissions,
      patients
    RESTART IDENTITY CASCADE
  `);
}

async function run() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: node src/database/importOldPatients.js [path/to/old_patients.tsv] [--append]");
    console.log("Default mode clears patient-linked data first. --append upserts without clearing.");
    return;
  }

  const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const importPath = path.resolve(positionalArgs[0] || DEFAULT_IMPORT_PATH);
  const shouldReplace = !process.argv.includes("--append");
  const content = await fs.readFile(importPath, "utf8");
  const rows = parseTsv(content);
  const patients = rows.map(toPatient);
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");

    if (shouldReplace) {
      await clearPatientData(client);
    }

    for (const patient of patients) {
      await upsertSeedPatient(client, patient);
    }

    await client.query("COMMIT");
    console.log(`Imported ${patients.length} old patients from ${importPath}.`);
    console.log(shouldReplace ? "Existing patient-linked records were cleared first." : "Import ran in append/upsert mode.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pgPool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
