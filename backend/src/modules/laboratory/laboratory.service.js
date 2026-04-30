import { createId, db, getLabTestMasters } from "../../data/store.js";
import { todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import { createBill } from "../billing/billing.service.js";
import {
  collectLabSampleRecord,
  createLabOrderRecord,
  findLabOrderRecord,
  findLabTestRecord,
  getLabSummaryRecord,
  linkLabBillRecord,
  listLabOrderRecords,
  listLabTestRecords,
  saveLabResultsRecord
} from "./laboratory.repository.js";

function syncLabOrderMirror(order) {
  if (!order) return;

  const index = db.labOrders.findIndex((entry) => entry.id === order.id);
  if (index >= 0) {
    db.labOrders[index] = order;
    return;
  }

  db.labOrders.unshift(order);
}

function syncLabTestMastersMirror(tests) {
  db.labTestMasters.splice(0, db.labTestMasters.length, ...tests);
}

function getOrderByIdFromMirror(orderId) {
  const order = db.labOrders.find((entry) => entry.id === orderId);

  if (!order) {
    throw createError("Lab order not found.", 404);
  }

  return order;
}

function enrichOrderFromMirror(order) {
  const visit = order.visitId ? db.opdVisits.find((entry) => entry.id === order.visitId) || null : null;
  const patient = order.patientId ? db.patients.find((entry) => entry.id === order.patientId) || null : null;
  const bill = order.billId ? db.bills.find((entry) => entry.id === order.billId) || null : null;

  return {
    ...order,
    visit,
    patient,
    bill
  };
}

export async function loadLabMirrorsFromDatabase() {
  const [tests, orders] = await Promise.all([listLabTestRecords(), listLabOrderRecords()]);
  syncLabTestMastersMirror(tests);
  db.labOrders.splice(0, db.labOrders.length, ...orders);
  return { tests, orders };
}

export async function getLabMasters() {
  const tests = await listLabTestRecords();
  syncLabTestMastersMirror(tests);

  return {
    tests,
    priorities: ["routine", "urgent", "stat"],
    statuses: ["pending", "sample_collected", "processing", "reported", "cancelled"],
    resultFlags: ["normal", "high", "low", "critical", "borderline"]
  };
}

export async function getLabSummary() {
  return getLabSummaryRecord();
}

export async function listLabOrders(query = {}) {
  const orders = await listLabOrderRecords(query);
  orders.forEach(syncLabOrderMirror);
  return orders;
}

export async function getLabOrderDetails(orderId) {
  const order = await findLabOrderRecord(orderId);
  if (!order) {
    throw createError("Lab order not found.", 404);
  }

  syncLabOrderMirror(order);
  return order;
}

async function resolveLabTests(testIds = []) {
  const tests = [];

  for (const testId of testIds) {
    const master = await findLabTestRecord(testId);

    if (!master) {
      throw createError(`Unknown lab test: ${testId}`);
    }

    tests.push({
      id: createId(),
      testId: master.id,
      testName: master.name,
      code: master.code,
      department: master.department,
      normalRange: master.normalRange,
      result: "",
      remarks: "",
      resultFlag: "normal",
      status: "pending"
    });
  }

  return tests;
}

export async function createLabOrder(payload) {
  if (!payload.visitId || !payload.patientId || !payload.tests?.length) {
    throw createError("Visit, patient, and at least one test are required.");
  }

  const tests = await resolveLabTests(payload.tests);
  const order = await createLabOrderRecord({
    id: payload.id || createId(),
    patientId: payload.patientId,
    patientName: payload.patientName,
    orderedBy: payload.orderedBy,
    visitId: payload.visitId,
    orderDate: payload.orderDate || todayDate(),
    priority: payload.priority || "routine",
    tests
  });

  syncLabOrderMirror(order);
  return order;
}

export async function collectLabSample(orderId, payload, userId) {
  const existing = await findLabOrderRecord(orderId);
  if (!existing) {
    throw createError("Lab order not found.", 404);
  }

  if (!["pending", "sample_collected"].includes(existing.status)) {
    throw createError("Sample collection is only allowed for pending or recollection orders.");
  }

  const order = await collectLabSampleRecord(orderId, {
    sampleCollectionTime: payload.sampleCollectionTime,
    sampleCollectedBy: userId,
    sampleType: payload.sampleType || existing.sampleType || "",
    collectionNote: payload.collectionNote || existing.collectionNote || ""
  });

  if (!order) {
    throw createError("Sample collection is only allowed for pending or recollection orders.");
  }

  syncLabOrderMirror(order);
  return order;
}

export async function saveLabResults(orderId, payload, userId) {
  const order = await findLabOrderRecord(orderId);

  if (!order) {
    throw createError("Lab order not found.", 404);
  }

  if (!payload.tests?.length) {
    throw createError("At least one test result is required.");
  }

  if (payload.markReported) {
    for (const test of order.tests) {
      const incoming = payload.tests.find((entry) => entry.testId === test.testId);
      const result = incoming?.result ?? test.result;
      if (!result) {
        throw createError(`Result is required for ${test.testName} before reporting.`);
      }
    }
  }

  const updated = await saveLabResultsRecord(orderId, {
    tests: payload.tests,
    markReported: Boolean(payload.markReported),
    processingSummary: payload.processingSummary || "",
    reportedBy: userId
  });

  syncLabOrderMirror(updated);
  return updated;
}

export async function createLabBill(orderId, payload, userId) {
  const order = await findLabOrderRecord(orderId);

  if (!order) {
    throw createError("Lab order not found.", 404);
  }

  if (order.billId) {
    throw createError("A lab bill has already been created for this order.");
  }

  const tests = await listLabTestRecords();
  const items = order.tests.map((test) => {
    const master = tests.find((entry) => entry.id === test.testId || entry.metadata?.sourceId === test.testId);

    return {
      description: test.testName,
      category: "lab",
      quantity: 1,
      unitPrice: Number(master?.price || 0),
      amount: Number(master?.price || 0)
    };
  });

  const bill = await createBill({
    patientId: order.patientId,
    patientName: order.patientName,
    visitId: order.visitId || "",
    billType: "lab",
    paymentStatus: payload.paymentStatus || "unpaid",
    billDate: payload.billDate || todayDate(),
    createdBy: userId,
    notes: `Generated from lab order ${order.orderNumber}`,
    metadata: {
      sourceModule: "laboratory",
      labOrderId: order.id,
      labOrderNumber: order.orderNumber
    },
    items
  });

  const updated = await linkLabBillRecord(order.id, bill.id);
  if (!updated) {
    throw createError("A lab bill has already been created for this order.");
  }

  syncLabOrderMirror(updated);
  return updated;
}

export function getLabOrderDetailsFromMirror(orderId) {
  return enrichOrderFromMirror(getOrderByIdFromMirror(orderId));
}

export function getLabTestMastersFromMirror() {
  return getLabTestMasters();
}
