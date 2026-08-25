import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgPool } from "../backend/src/config/postgres.js";
import { readPuruPatientExport } from "./puru-patient-export.mjs";

const EMPTY = new Set(["", "0", "00", "000", "na", "n/a", "nil", "none", "null", "undefined", "-"]);
const RESTORED_NAME = /(audit|restore|rehearsal|test|copy|clone|local)/i;
const TEST_NAME = /\b(test|testing|validate|validator|demo|dummy|sample|workflow|laboratory|therapy)\b/i;
const NL = String.fromCharCode(10);
const clean = (value) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return EMPTY.has(text.toLowerCase()) ? "" : text;
};
const phone = (value) => {
  let result = clean(value).replace(/\D/g, "");
  if (result.length === 12 && result.startsWith("91")) result = result.slice(2);
  if (result.length === 11 && result.startsWith("0")) result = result.slice(1);
  return result;
};
const name = (value) => clean(value).toLowerCase()
  .replace(/\b(mr|mrs|ms|miss|master|baby|dr|br|ku|shri|smt)\b/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
const date = (value) => String(value || "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";
const escapeCsv = (value) => {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return /[",]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
const csv = (rows, columns) => [
  columns.map((column) => escapeCsv(column[0])).join(","),
  ...rows.map((row) => columns.map((column) => escapeCsv(column[1](row))).join(","))
].join(NL) + NL;

function argumentsFrom(argv) {
  const options = { file: "", confirmDb: "", output: "", allowNonRestoredName: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--confirm-db") options.confirmDb = argv[++index] || "";
    else if (item === "--output") options.output = argv[++index] || "";
    else if (item === "--allow-non-restored-name") options.allowNonRestoredName = true;
    else if (!item.startsWith("--") && !options.file) options.file = item;
    else throw new Error("Unknown or incomplete argument: " + item);
  }
  if (!options.file || !options.confirmDb) throw new Error("Usage: npm run patients:audit-reconciliation -- <csv> --confirm-db <restored_database>");
  return options;
}

function sourcePatient(row) {
  const fullName = clean(row.full_name) || [row.first_name, row.middle_name, row.last_name].map(clean).filter(Boolean).join(" ");
  return {
    line: row._sourceLine, ppin: clean(row.ppin), fullName, normalizedName: name(fullName),
    father: name(row.fathers_name), phone: phone(row.phone_number), altPhone: phone(row.phone_number2),
    dob: date(row.dob), gender: clean(row.gender).toLowerCase(), city: name(row.address?.city)
  };
}

function matchScore(source, patient) {
  const evidence = [];
  if (source.ppin && [patient.registrationNumber, patient.metadataPpin, patient.uhid].includes(source.ppin)) evidence.push("ppin");
  if (source.normalizedName && source.normalizedName === patient.normalizedName) evidence.push("name");
  if (source.phone && [patient.phone, patient.altPhone].includes(source.phone)) evidence.push("phone");
  if (source.altPhone && [patient.phone, patient.altPhone].includes(source.altPhone)) evidence.push("alt_phone");
  if (source.dob && source.dob === patient.dob) evidence.push("dob");
  if (source.father && source.father === patient.father) evidence.push("father");
  if (source.gender && source.gender[0] === patient.gender[0]) evidence.push("gender");
  if (source.city && source.city === patient.city) evidence.push("city");
  const weights = { ppin: 100, name: 30, phone: 35, alt_phone: 25, dob: 25, father: 20, gender: 5, city: 5 };
  return { evidence, score: evidence.reduce((total, item) => total + weights[item], 0) };
}

function reconcile(sources, patients) {
  const rows = sources.map((source) => {
    const invalid = [];
    if (!/^\d+$/.test(source.ppin)) invalid.push("invalid_or_missing_ppin");
    if (!source.normalizedName) invalid.push("missing_name");
    if (source.phone && source.phone.length !== 10) invalid.push("invalid_phone");
    if (invalid.length) return { source, classification: "invalid_csv", invalid, candidates: [], selected: null };
    const candidates = patients.map((patient) => ({ patient, ...matchScore(source, patient) }))
      .filter((candidate) => candidate.score >= 30)
      .sort((left, right) => right.score - left.score || left.patient.id.localeCompare(right.patient.id));
    const identifiers = candidates.filter((candidate) => candidate.evidence.includes("ppin"));
    let classification = "missing_from_hms";
    let selected = null;
    if (identifiers.length === 1) {
      classification = "exact_match";
      selected = identifiers[0];
    } else if (identifiers.length > 1) classification = "ambiguous_match";
    else if (candidates.length) {
      const strongest = candidates[0];
      const tied = candidates.filter((candidate) => candidate.score === strongest.score);
      const strong = strongest.evidence.includes("name") &&
        (strongest.evidence.includes("phone") || strongest.evidence.includes("dob") || strongest.evidence.includes("father"));
      if (strong && tied.length === 1) {
        classification = "strong_probable_match";
        selected = strongest;
      } else classification = "ambiguous_match";
    }
    return { source, classification, invalid, candidates: candidates.slice(0, 10), selected };
  });
  const selectedCounts = rows.reduce((counts, row) => {
    if (row.selected) counts.set(row.selected.patient.id, (counts.get(row.selected.patient.id) || 0) + 1);
    return counts;
  }, new Map());
  for (const row of rows) {
    if (row.selected && selectedCounts.get(row.selected.patient.id) > 1) {
      row.classification = "ambiguous_match";
      row.invalid = ["database_patient_selected_by_multiple_csv_rows"];
      row.selected = null;
    }
  }
  const matched = new Set(rows.filter((row) => row.selected).map((row) => row.selected.patient.id));
  return { rows, absent: patients.filter((patient) => !matched.has(patient.id)) };
}

async function tableCounts(client) {
  const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  const output = {};
  for (const row of result.rows) {
    const safeTable = row.table_name.replace(/"/g, '""');
    output[row.table_name] = (await client.query('SELECT COUNT(*)::int AS count FROM "' + safeTable + '"')).rows[0].count;
  }
  return output;
}

async function patientLinks(client) {
  const result = await client.query("SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='patient_id' ORDER BY table_name");
  const output = new Map();
  for (const row of result.rows) {
    const safeTable = row.table_name.replace(/"/g, '""');
    const grouped = await client.query('SELECT patient_id::text AS id, COUNT(*)::int AS count FROM "' + safeTable + '" WHERE patient_id IS NOT NULL GROUP BY patient_id');
    for (const item of grouped.rows) {
      const links = output.get(item.id) || {};
      links[row.table_name] = item.count;
      output.set(item.id, links);
    }
  }
  return { tables: result.rows.map((row) => row.table_name), patients: output };
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const sourcePath = path.resolve(options.file);
  const bytes = await readFile(sourcePath);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const sources = (await readPuruPatientExport(sourcePath)).map(sourcePatient);
  const output = path.resolve(options.output || path.join("reports", "patient-reconciliation", new Date().toISOString().replace(/[:.]/g, "-")));
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = (await client.query("SELECT current_database() AS database, inet_server_addr()::text AS server_address, inet_server_port() AS server_port, current_user AS database_user, current_setting('server_version') AS server_version")).rows[0];
    if (identity.database !== options.confirmDb) throw new Error("Audit refused: --confirm-db must equal " + identity.database);
    if (!options.allowNonRestoredName && !RESTORED_NAME.test(identity.database)) throw new Error("Audit refused: connected database name does not look like a restored audit database.");
    const before = await tableCounts(client);
    const linked = await patientLinks(client);
    const patientRows = (await client.query("SELECT id::text, uhid, registration_number, full_name, father_name, date_of_birth, gender, phone, alt_phone, city, metadata, deleted_at FROM patients ORDER BY id")).rows;
    const patients = patientRows.map((row) => {
      const links = linked.patients.get(row.id) || {};
      return {
        id: row.id, uhid: clean(row.uhid), registrationNumber: clean(row.registration_number),
        metadataPpin: clean(row.metadata?.ppin), fullName: clean(row.full_name), normalizedName: name(row.full_name),
        father: name(row.father_name), phone: phone(row.phone), altPhone: phone(row.alt_phone), dob: date(row.date_of_birth),
        gender: clean(row.gender).toLowerCase(), city: name(row.city), deletedAt: row.deleted_at ? String(row.deleted_at) : "",
        links, referenceCount: Object.values(links).reduce((sum, value) => sum + Number(value), 0)
      };
    });
    const result = reconcile(sources, patients);
    const after = await tableCounts(client);
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    if (!unchanged) throw new Error("Read-only invariant failed: table counts changed.");
    const classifications = result.rows.reduce((all, row) => ({ ...all, [row.classification]: (all[row.classification] || 0) + 1 }), {});
    const numericPpins = sources.map((row) => Number(row.ppin)).filter(Number.isSafeInteger);
    const summary = {
      mode: "read-only", auditedAt: new Date().toISOString(), database: identity,
      source: { fileName: path.basename(sourcePath), sha256: hash, rows: sources.length },
      databasePatients: { total: patients.length, active: patients.filter((item) => !item.deletedAt).length, archived: patients.filter((item) => item.deletedAt).length },
      classifications, hmsAbsentFromCsv: result.absent.length,
      hmsAbsentWithClinicalReferences: result.absent.filter((item) => item.referenceCount > 0).length,
      likelyTestPatientsAbsentFromCsv: result.absent.filter((item) => TEST_NAME.test(item.fullName)).length,
      patientLinkedTables: linked.tables, proposedNextNumericUhid: String(Math.max(...numericPpins) + 1), countsUnchanged: unchanged
    };
    const mappingColumns = [
      ["source_line", (row) => row.source.line], ["ppin_proposed_uhid", (row) => row.source.ppin],
      ["source_name", (row) => row.source.fullName], ["source_phone", (row) => row.source.phone],
      ["classification", (row) => row.classification], ["database_patient_id", (row) => row.selected?.patient.id],
      ["current_uhid", (row) => row.selected?.patient.uhid], ["database_name", (row) => row.selected?.patient.fullName],
      ["score", (row) => row.selected?.score], ["evidence", (row) => row.selected?.evidence],
      ["clinical_reference_count", (row) => row.selected?.patient.referenceCount], ["validation", (row) => row.invalid]
    ];
    const candidateColumns = [
      ["source_line", (row) => row.source.line], ["ppin", (row) => row.source.ppin], ["classification", (row) => row.classification],
      ["candidate_id", (row) => row.candidate.patient.id], ["candidate_uhid", (row) => row.candidate.patient.uhid],
      ["candidate_name", (row) => row.candidate.patient.fullName], ["candidate_score", (row) => row.candidate.score],
      ["candidate_evidence", (row) => row.candidate.evidence], ["clinical_reference_count", (row) => row.candidate.patient.referenceCount]
    ];
    const absentColumns = [
      ["database_patient_id", (row) => row.id], ["current_uhid", (row) => row.uhid], ["registration_number", (row) => row.registrationNumber],
      ["name", (row) => row.fullName], ["phone", (row) => row.phone], ["archived", (row) => Boolean(row.deletedAt)],
      ["likely_test_patient", (row) => TEST_NAME.test(row.fullName)], ["clinical_reference_count", (row) => row.referenceCount],
      ["clinical_links_json", (row) => JSON.stringify(row.links)]
    ];
    await mkdir(output, { recursive: true });
    const candidateRows = result.rows.flatMap((row) => row.candidates.map((candidate) => ({ ...row, candidate })));
    await Promise.all([
      writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + NL),
      writeFile(path.join(output, "mapping.csv"), csv(result.rows, mappingColumns)),
      writeFile(path.join(output, "candidates.csv"), csv(candidateRows, candidateColumns)),
      writeFile(path.join(output, "hms-absent-from-csv.csv"), csv(result.absent, absentColumns))
    ]);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ ...summary, outputDirectory: output }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pgPool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
