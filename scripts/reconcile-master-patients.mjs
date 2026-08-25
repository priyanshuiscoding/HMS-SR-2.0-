import crypto from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { pgPool } from "../backend/src/config/postgres.js";
import { readPuruPatientExport } from "./puru-patient-export.mjs";

const EMPTY = new Set(["", "0", "00", "000", "na", "n/a", "nil", "none", "null", "undefined", "-"]);
const AUDIT_DATABASE = /(audit|restore|rehearsal|test|copy|clone|local)/i;
const PRODUCTION_DATABASE = "hms_db";
const MAINTENANCE_CONFIRMATION = "WRITES_STOPPED";
const TITLE = new Map([["baby", "Baby"], ["br", "Br"], ["dr", "Dr"], ["ku", "Ku"], ["master", "Master"], ["miss", "Miss"], ["mr", "Mr"], ["mrs", "Mrs"], ["ms", "Ms"]]);
const NL = String.fromCharCode(10);

function clean(value) {
  const text = String(value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  return EMPTY.has(text.toLowerCase()) ? "" : text;
}

function phone(value) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

function isoDate(value) {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : null;
}

function stableUuid(source) {
  const digest = crypto.createHash("sha1").update(source).digest("hex").slice(0, 32);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizedTitle(value) {
  const valueKey = clean(value).toLowerCase().replace(/\./g, "");
  return TITLE.get(valueKey) || (valueKey ? valueKey[0].toUpperCase() + valueKey.slice(1) : "");
}

function sourcePatient(row, sourceName, sourceHash) {
  const title = normalizedTitle(row.salutation);
  const suppliedFullName = clean(row.full_name);
  const suppliedFirstName = clean(row.first_name);
  const suppliedMiddleName = clean(row.middle_name);
  const suppliedLastName = clean(row.last_name);
  const fullName = suppliedFullName || [title, suppliedFirstName, suppliedMiddleName, suppliedLastName].filter(Boolean).join(" ");
  const withoutTitle = title && fullName.toLowerCase().startsWith(`${title.toLowerCase()} `) ? fullName.slice(title.length).trim() : fullName;
  const nameParts = withoutTitle.split(/\s+/).filter(Boolean);
  const addressObject = row.address && typeof row.address === "object" ? row.address : {};
  const houseStreet = clean(addressObject.addressLine1 || addressObject.line1 || addressObject.name);
  const areaVillage = [addressObject.addressLine2, addressObject.addressLine3].map(clean).filter(Boolean).join(", ");
  const city = clean(addressObject.city);
  const state = clean(addressObject.state) || "Madhya Pradesh";
  const pincode = clean(addressObject.pinCode || addressObject.pincode);
  const address = clean(row.address_string) || [houseStreet, areaVillage, city, state, pincode].filter(Boolean).join(", ");
  const ageDays = Number(clean(row.current_age_in_days));
  const ppin = clean(row.ppin);

  return {
    sourceLine: row._sourceLine,
    ppin,
    id: stableUuid(`patient-reconciliation-master:${ppin}`),
    patientType: "old",
    title,
    firstName: suppliedFirstName || nameParts[0] || "Unknown",
    lastName: suppliedLastName || nameParts.slice(1).join(" "),
    fullName: fullName || `Patient ${ppin}`,
    fatherName: clean(row.fathers_name),
    dateOfBirth: isoDate(row.dob),
    ageYears: Number.isFinite(ageDays) && ageDays >= 0 ? Math.floor(ageDays / 365.2425) : null,
    gender: ["m", "male"].includes(clean(row.gender).toLowerCase()) ? "male" : ["f", "female"].includes(clean(row.gender).toLowerCase()) ? "female" : clean(row.gender) ? "other" : "",
    phone: phone(row.phone_number),
    altPhone: phone(row.phone_number2),
    email: clean(row.email),
    address,
    houseStreet,
    areaVillage,
    city,
    state,
    pincode,
    registrationDate: isoDate(row.last_time_updated) || isoDate(row.age_entered_on) || isoDate(row.dob) || "2000-01-01",
    referredBy: "Puru patient reconciliation",
    sourceDocument: sourceName,
    metadata: {
      reconciliationMaster: true,
      ppin,
      sourceUuid: clean(row.uuid),
      sourceLastUpdated: clean(row.last_time_updated),
      sourceSha256: sourceHash
    }
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter((item) => item.some(Boolean)).map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] || ""])));
}

function argumentsFor(argv) {
  const command = argv.shift();
  const options = { command, commit: false, production: false, productionDryRun: false };
  while (argv.length) {
    const item = argv.shift();
    if (item === "--commit") options.commit = true;
    else if (item === "--production") options.production = true;
    else if (item === "--production-dry-run") options.productionDryRun = true;
    else if (item.startsWith("--")) options[item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv.shift() || "";
    else throw new Error(`Unknown argument: ${item}`);
  }
  return options;
}

async function fileHash(filePath) {
  return sha256(await readFile(filePath));
}

function manifestHash(payload) {
  return sha256(JSON.stringify(payload));
}

function productionConfirmation(expected) {
  return `RECONCILE ${PRODUCTION_DATABASE} TO ${expected.activeAfter} ACTIVE PATIENTS`;
}

function validateProductionOptions(options, envelope, backupSha256) {
  const productionRequested = options.production || options.productionDryRun;
  if (!productionRequested) return false;
  if (options.production && options.productionDryRun) throw new Error("Apply refused: choose either --production or --production-dry-run, not both.");
  if (options.production && !options.commit) throw new Error("Apply refused: --production requires the explicit --commit flag.");
  if (options.productionDryRun && options.commit) throw new Error("Apply refused: --production-dry-run cannot be combined with --commit.");
  if (options.confirmDb !== PRODUCTION_DATABASE) throw new Error(`Apply refused: production --confirm-db must be exactly ${PRODUCTION_DATABASE}.`);
  if (options.expectedManifestSha256 !== envelope.sha256) throw new Error("Apply refused: --expected-manifest-sha256 does not exactly match the manifest envelope hash.");
  if (options.expectedBackupSha256 !== backupSha256) throw new Error("Apply refused: --expected-backup-sha256 does not exactly match the verified backup hash.");
  if (options.maintenanceConfirmation !== MAINTENANCE_CONFIRMATION) throw new Error(`Apply refused: --maintenance-confirmation must be exactly ${MAINTENANCE_CONFIRMATION}.`);
  const requiredConfirmation = productionConfirmation(envelope.payload.expected);
  if (options.productionConfirmation !== requiredConfirmation) throw new Error(`Apply refused: --production-confirmation must be exactly \${requiredConfirmation}\.`);
  return true;
}

async function buildManifest(options) {
  for (const key of ["csv", "report", "backup", "output"]) if (!options[key]) throw new Error(`build requires --${key}`);
  const sourcePath = path.resolve(options.csv);
  const reportPath = path.resolve(options.report);
  const backupPath = path.resolve(options.backup);
  const outputPath = path.resolve(options.output);
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = sha256(sourceBytes);
  const summary = JSON.parse(await readFile(path.join(reportPath, "summary.json"), "utf8"));
  if (summary.mode !== "read-only" || !summary.countsUnchanged) throw new Error("Manifest refused: reconciliation audit was not read-only and unchanged.");
  if (summary.source.sha256 !== sourceHash || summary.source.rows !== 6342) throw new Error("Manifest refused: CSV does not match the audited 6,342-row source.");
  const mapping = parseCsv(await readFile(path.join(reportPath, "mapping.csv"), "utf8"));
  const candidates = parseCsv(await readFile(path.join(reportPath, "candidates.csv"), "utf8"));
  const absent = parseCsv(await readFile(path.join(reportPath, "hms-absent-from-csv.csv"), "utf8"));
  const sourceRows = await readPuruPatientExport(sourcePath);
  const sources = new Map(sourceRows.map((row) => [String(row._sourceLine), sourcePatient(row, path.basename(sourcePath), sourceHash)]));
  const absentById = new Map(absent.map((row) => [row.database_patient_id, row]));
  const candidatesByLine = new Map();
  for (const candidate of candidates) {
    const items = candidatesByLine.get(candidate.source_line) || [];
    items.push(candidate);
    candidatesByLine.set(candidate.source_line, items);
  }
  const retainedIds = new Set(mapping.map((row) => row.database_patient_id).filter(Boolean));
  const masterRows = [];
  for (const mappingRow of mapping.sort((left, right) => Number(left.ppin_proposed_uhid) - Number(right.ppin_proposed_uhid))) {
    const source = sources.get(mappingRow.source_line);
    if (!source || source.ppin !== mappingRow.ppin_proposed_uhid) throw new Error(`Manifest refused: source mismatch at CSV line ${mappingRow.source_line}.`);
    let patientId = mappingRow.database_patient_id;
    let action = patientId ? "retain" : "insert";
    let score = Number(mappingRow.score || 0);
    let evidence = mappingRow.evidence || "";
    if (!patientId && mappingRow.classification === "ambiguous_match") {
      const available = (candidatesByLine.get(mappingRow.source_line) || [])
        .filter((candidate) => absentById.has(candidate.candidate_id) && !retainedIds.has(candidate.candidate_id))
        .sort((left, right) => Number(right.candidate_score) - Number(left.candidate_score));
      if (available.length) {
        const topScore = Number(available[0].candidate_score);
        const top = available.filter((candidate) => Number(candidate.candidate_score) === topScore);
        if (topScore >= 100 && top.length === 1) {
          patientId = top[0].candidate_id;
          action = "retain_candidate";
          score = topScore;
          evidence = top[0].candidate_evidence;
          retainedIds.add(patientId);
        }
      }
    }
    masterRows.push({
      sourceLine: source.sourceLine,
      ppin: source.ppin,
      desiredUhid: source.ppin,
      action,
      patientId: patientId || source.id,
      previousUhid: mappingRow.current_uhid || "",
      previousRegistrationNumber: mappingRow.registration_number || "",
      matchClassification: mappingRow.classification,
      score,
      evidence,
      source
    });
  }
  const archiveRows = absent.filter((row) => !retainedIds.has(row.database_patient_id)).map((row) => ({
    patientId: row.database_patient_id,
    previousUhid: row.current_uhid,
    previousRegistrationNumber: row.registration_number,
    clinicalReferenceCount: Number(row.clinical_reference_count || 0),
    clinicalLinks: JSON.parse(row.clinical_links_json || "{}")
  }));
  const allDatabaseIds = [...new Set([...mapping.map((row) => row.database_patient_id).filter(Boolean), ...absent.map((row) => row.database_patient_id)])].sort();
  const expected = { masterRows: 6342, retained: 6266, inserted: 76, archived: 22, activeAfter: 6342, nextUhid: "6343" };
  const computed = {
    masterRows: masterRows.length,
    retained: masterRows.filter((row) => row.action !== "insert").length,
    inserted: masterRows.filter((row) => row.action === "insert").length,
    archived: archiveRows.length,
    activeAfter: masterRows.length,
    nextUhid: String(Math.max(...masterRows.map((row) => Number(row.ppin))) + 1)
  };
  if (JSON.stringify(computed) !== JSON.stringify(expected)) {
    throw new Error(`Manifest refused: computed reconciliation counts differ from the approved plan (${JSON.stringify({ computed, expected })}).`);
  }
  if (new Set(masterRows.map((row) => row.ppin)).size !== expected.masterRows) {
    throw new Error("Manifest refused: master PPIN/UHIDs are not unique.");
  }
  if (new Set(masterRows.map((row) => row.patientId)).size !== expected.masterRows) {
    throw new Error("Manifest refused: a patient UUID is assigned to more than one master PPIN.");
  }
  if (allDatabaseIds.length !== summary.databasePatients.total) {
    throw new Error("Manifest refused: audit exports do not cover every database patient UUID.");
  }
  const payload = {
    version: 1,
    policy: "csv-ppin-is-master-uhid",
    createdAt: new Date().toISOString(),
    source: { fileName: path.basename(sourcePath), sha256: sourceHash, rows: sourceRows.length },
    audit: { directory: reportPath, auditedAt: summary.auditedAt },
    backup: { fileName: path.basename(backupPath), sha256: await fileHash(backupPath), size: (await stat(backupPath)).size },
    databaseBaseline: { patientTotal: summary.databasePatients.total, patientIdsSha256: sha256(allDatabaseIds.join(NL)) },
    expected,
    masterRows,
    archiveRows
  };
  const envelope = { payload, sha256: manifestHash(payload) };
  await writeFile(outputPath, JSON.stringify(envelope, null, 2) + NL, { flag: "wx" });
  console.log(JSON.stringify({ output: outputPath, manifestSha256: envelope.sha256, expected: payload.expected }, null, 2));
}

async function patientIdFingerprint(client) {
  const result = await client.query("SELECT id::text FROM patients ORDER BY id::text");
  return sha256(result.rows.map((row) => row.id).join(NL));
}

async function patientReferenceSnapshot(client) {
  const tableResult = await client.query("SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='patient_id' ORDER BY table_name");
  const snapshot = {};
  for (const { table_name: table } of tableResult.rows) {
    const safe = table.replace(/"/g, '""');
    const result = await client.query(`SELECT patient_id::text, COUNT(*)::int AS count FROM "${safe}" WHERE patient_id IS NOT NULL GROUP BY patient_id ORDER BY patient_id::text`);
    snapshot[table] = result.rows;
  }
  return snapshot;
}

async function orphanCounts(client) {
  const snapshot = await patientReferenceSnapshot(client);
  const output = {};
  for (const table of Object.keys(snapshot)) {
    const safe = table.replace(/"/g, '""');
    output[table] = Number((await client.query(`SELECT COUNT(*)::int AS count FROM "${safe}" linked WHERE linked.patient_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM patients patient WHERE patient.id=linked.patient_id)`)).rows[0].count);
  }
  return output;
}

async function insertMaster(client, row, manifest) {
  const patient = row.source;
  await client.query(`
    INSERT INTO patients (
      id, uhid, registration_number, opd_ipd_number, patient_type, title, first_name, last_name, full_name, father_name,
      date_of_birth, age_years, gender, blood_group, marital_status, occupation, phone, alt_phone, email,
      address, house_street, area_village, city, state, pincode, id_type, emergency_contact_name,
      emergency_contact_phone, registration_date, registration_time, referred_by, photo_url, source_document,
      clinical_notes, created_by, metadata
    ) VALUES (
      $1,$2,$3,'',$4,$5,$6,$7,$8,$9,$10,$11,$12,'','','',$13,$14,$15,
      $16,$17,$18,$19,$20,$21,'','','',$22,NULL,$23,'',$24,'[]'::jsonb,NULL,$25::jsonb
    )`, [
      row.patientId, row.desiredUhid, row.ppin, patient.patientType, patient.title, patient.firstName, patient.lastName,
      patient.fullName, patient.fatherName, patient.dateOfBirth, patient.ageYears, patient.gender, patient.phone,
      patient.altPhone, patient.email, patient.address, patient.houseStreet, patient.areaVillage, patient.city,
      patient.state, patient.pincode, patient.registrationDate, patient.referredBy, patient.sourceDocument,
      JSON.stringify({ ...patient.metadata, reconciliationManifestSha256: manifest.sha256, reconciliationAction: "insert" })
    ]);
}

async function applyManifest(options) {
  for (const key of ["manifest", "backup", "confirmDb"]) if (!options[key]) throw new Error(`apply requires --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  const envelope = JSON.parse(await readFile(path.resolve(options.manifest), "utf8"));
  if (manifestHash(envelope.payload) !== envelope.sha256) throw new Error("Apply refused: manifest hash is invalid.");
  const backupSha256 = await fileHash(path.resolve(options.backup));
  if (backupSha256 !== envelope.payload.backup.sha256) throw new Error("Apply refused: backup hash differs from the manifest.");
  const productionRequested = validateProductionOptions(options, envelope, backupSha256);
  const client = await pgPool.connect();
  try {
    const identity = (await client.query("SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port")).rows[0];
    if (identity.database !== options.confirmDb) throw new Error(`Apply refused: --confirm-db must equal ${identity.database}.`);
    if (productionRequested && identity.database !== PRODUCTION_DATABASE) throw new Error(`Apply refused: production execution requires database ${PRODUCTION_DATABASE}.`);
    if (!productionRequested && !AUDIT_DATABASE.test(identity.database)) throw new Error("Apply refused: use a restored audit database or provide the complete guarded production mode arguments.");
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('patient-master-reconciliation'))");
      if (await patientIdFingerprint(client) !== envelope.payload.databaseBaseline.patientIdsSha256) throw new Error("Apply refused: patient ID fingerprint differs from the audited snapshot.");
      const sequenceState = (await client.query("SELECT last_value::text, is_called FROM patient_numeric_uhid_seq")).rows[0];
      const sequenceNext = sequenceState.is_called ? String(BigInt(sequenceState.last_value) + 1n) : sequenceState.last_value;
      if (sequenceNext !== envelope.payload.expected.nextUhid) throw new Error(`Apply refused: numeric UHID sequence would allocate ${sequenceNext}, expected ${envelope.payload.expected.nextUhid}.`);
      const beforeReferences = await patientReferenceSnapshot(client);
      await client.query("UPDATE patients SET uhid='TMP'||SUBSTRING(MD5(id::text) FROM 1 FOR 27)");
      for (const row of envelope.payload.masterRows.filter((item) => item.action !== "insert")) {
        const result = await client.query(`UPDATE patients SET uhid=$2, registration_number=$2, deleted_at=NULL, deleted_by=NULL, deletion_reason='', metadata=COALESCE(metadata,'{}'::jsonb)||$3::jsonb, updated_at=NOW() WHERE id=$1::uuid`, [row.patientId, row.ppin, JSON.stringify({ reconciliationManifestSha256: envelope.sha256, reconciliationPreviousUhid: row.previousUhid, reconciliationPreviousRegistrationNumber: row.previousRegistrationNumber, reconciliationAction: row.action })]);
        if (result.rowCount !== 1) throw new Error(`Retained patient missing for PPIN ${row.ppin}.`);
      }
      for (const row of envelope.payload.masterRows.filter((item) => item.action === "insert")) await insertMaster(client, row, envelope);
      for (const row of envelope.payload.archiveRows) {
        const result = await client.query(`UPDATE patients SET uhid='ARC'||SUBSTRING(MD5(id::text) FROM 1 FOR 27), registration_number=NULL, deleted_at=COALESCE(deleted_at,NOW()), deleted_by=NULL, deletion_reason='HMS-only record archived by approved CSV master reconciliation', metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb, updated_at=NOW() WHERE id=$1::uuid`, [row.patientId, JSON.stringify({ reconciliationManifestSha256: envelope.sha256, reconciliationAction: "archive", reconciliationPreviousUhid: row.previousUhid, reconciliationPreviousRegistrationNumber: row.previousRegistrationNumber, reconciliationClinicalReferencesPreserved: row.clinicalReferenceCount })]);
        if (result.rowCount !== 1) throw new Error(`Archive patient missing: ${row.patientId}.`);
      }
      await client.query("UPDATE medical_certificates certificate SET uhid=patient.uhid FROM patients patient WHERE certificate.patient_id=patient.id AND patient.deleted_at IS NULL");
      const validation = (await client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS archived, COUNT(DISTINCT uhid)::int AS unique_uhids, COUNT(*) FILTER (WHERE deleted_at IS NULL AND uhid ~ '^[0-9]+$' AND registration_number=uhid)::int AS numeric_master, MAX(uhid::bigint) FILTER (WHERE deleted_at IS NULL AND uhid ~ '^[0-9]+$')::text AS maximum_uhid FROM patients`)).rows[0];
      const afterReferences = await patientReferenceSnapshot(client);
      const orphans = await orphanCounts(client);
      const referencesUnchanged = JSON.stringify(beforeReferences) === JSON.stringify(afterReferences);
      const orphanTotal = Object.values(orphans).reduce((sum, count) => sum + count, 0);
      const expected = envelope.payload.expected;
      if (validation.active !== expected.activeAfter || validation.archived !== expected.archived || validation.numeric_master !== expected.masterRows || validation.unique_uhids !== validation.total || validation.maximum_uhid !== String(expected.masterRows) || !referencesUnchanged || orphanTotal !== 0) {
        throw new Error(`Validation failed: ${JSON.stringify({ validation, referencesUnchanged, orphanTotal })}`);
      }
      if (options.commit) await client.query("COMMIT"); else await client.query("ROLLBACK");
      const mode = productionRequested
        ? (options.commit ? "committed-production-reconciliation" : "rolled-back-production-dry-run")
        : (options.commit ? "committed-local-rehearsal" : "rolled-back-local-dry-run");
      console.log(JSON.stringify({ mode, database: identity, manifestSha256: envelope.sha256, backupSha256, validation, referencesUnchanged, orphanTotal, nextUhid: expected.nextUhid }, null, 2));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } finally {
    client.release();
    await pgPool.end();
  }
}

const options = argumentsFor(process.argv.slice(2));
if (options.command === "build") await buildManifest(options);
else if (options.command === "apply") await applyManifest(options);
else throw new Error("Usage: node scripts/reconcile-master-patients.mjs <build|apply> [options]");
