import assert from "node:assert/strict";
import test from "node:test";

import { PURU_PATIENT_HEADERS, parsePuruPatientLine } from "./puru-patient-export.mjs";

test("repairs the unescaped address JSON without shifting later columns", () => {
  const address = {
    block: "A, B",
    city: "Ujjain",
    addressLine1: "House 1",
    addressLine2: "Road"
  };
  const trailing = [
    "address string",
    "2026",
    "block",
    "7300",
    "2006-01-01",
    "mail@example.test",
    "Father",
    "First",
    "false",
    "First Last",
    "male",
    "Last",
    "Middle",
    "Mother",
    "9876543210",
    "",
    "remarks",
    "Mr",
    "",
    "puru",
    "source-uuid"
  ];
  const line = [
    "6342",
    "1",
    '"2026-08-16 12:11:56.000000"',
    "AAID",
    `"${JSON.stringify(address)}"`,
    ...trailing
  ].join(",");

  const parsed = parsePuruPatientLine(line, 2);
  assert.equal(Object.keys(parsed).filter((key) => !key.startsWith("_")).length, PURU_PATIENT_HEADERS.length);
  assert.equal(parsed.ppin, "6342");
  assert.deepEqual(parsed.address, address);
  assert.equal(parsed.full_name, "First Last");
  assert.equal(parsed.phone_number, "9876543210");
  assert.equal(parsed.uuid, "source-uuid");
});
