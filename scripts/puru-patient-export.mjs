import { readFile } from "fs/promises";

export const PURU_PATIENT_HEADERS = [
  "ppin",
  "last_modified_by",
  "last_time_updated",
  "aaid",
  "address",
  "address_string",
  "age_entered_on",
  "block",
  "current_age_in_days",
  "dob",
  "email",
  "fathers_name",
  "first_name",
  "from_oldsoft",
  "full_name",
  "gender",
  "last_name",
  "middle_name",
  "mothers_name",
  "phone_number",
  "phone_number2",
  "remarks",
  "salutation",
  "samagraid",
  "source",
  "uuid"
];

function cleanCell(value) {
  const text = String(value ?? "").replace(/`/g, "").trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/""/g, '"').trim();
  }
  return text;
}

function firstCommaPositions(line, count) {
  const positions = [];
  let position = -1;
  for (let index = 0; index < count; index += 1) {
    position = line.indexOf(",", position + 1);
    if (position < 0) {
      return [];
    }
    positions.push(position);
  }
  return positions;
}

function findJsonObjectEnd(line, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (!inString && character === "{") {
      depth += 1;
    } else if (!inString && character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

export function parsePuruPatientLine(line, sourceLine) {
  const commaPositions = firstCommaPositions(line, 4);
  if (commaPositions.length !== 4) {
    throw new Error(`Line ${sourceLine}: expected the four columns before address.`);
  }

  const leading = [];
  let start = 0;
  for (const commaPosition of commaPositions) {
    leading.push(cleanCell(line.slice(start, commaPosition)));
    start = commaPosition + 1;
  }

  const addressStart = line.indexOf("{", start);
  if (addressStart < start || addressStart - start > 2) {
    throw new Error(`Line ${sourceLine}: address JSON does not start where expected.`);
  }
  const addressEnd = findJsonObjectEnd(line, addressStart);
  if (addressEnd < 0) {
    throw new Error(`Line ${sourceLine}: address JSON is incomplete.`);
  }

  const addressText = line.slice(addressStart, addressEnd + 1);
  let address;
  try {
    address = JSON.parse(addressText);
  } catch (error) {
    throw new Error(`Line ${sourceLine}: address JSON is invalid (${error.message}).`);
  }

  let remainderStart = addressEnd + 1;
  if (line[remainderStart] === '"') {
    remainderStart += 1;
  }
  if (line[remainderStart] !== ",") {
    throw new Error(`Line ${sourceLine}: expected a delimiter after address JSON.`);
  }
  remainderStart += 1;

  const trailing = line.slice(remainderStart).split(",").map(cleanCell);
  if (trailing.length !== PURU_PATIENT_HEADERS.length - 5) {
    throw new Error(
      `Line ${sourceLine}: expected ${PURU_PATIENT_HEADERS.length - 5} columns after address, found ${trailing.length}.`
    );
  }

  const values = [...leading, addressText, ...trailing];
  const row = Object.fromEntries(PURU_PATIENT_HEADERS.map((header, index) => [header, values[index] ?? ""]));
  row.address = address;
  row._sourceLine = sourceLine;
  return row;
}

export async function readPuruPatientExport(filePath) {
  const content = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/);
  while (lines.length && !lines.at(-1).trim()) {
    lines.pop();
  }
  if (!lines.length) {
    throw new Error("The Puru patient export is empty.");
  }

  const headers = lines[0].split(",").map(cleanCell);
  if (headers.join("|") !== PURU_PATIENT_HEADERS.join("|")) {
    throw new Error("The Puru patient export headers do not match the expected 26-column format.");
  }

  const records = lines.slice(1).map((line, index) => parsePuruPatientLine(line, index + 2));
  const duplicatePpins = records.length - new Set(records.map((record) => record.ppin)).size;
  if (duplicatePpins) {
    throw new Error(`The export contains ${duplicatePpins} duplicate PPIN row(s).`);
  }
  return records;
}
