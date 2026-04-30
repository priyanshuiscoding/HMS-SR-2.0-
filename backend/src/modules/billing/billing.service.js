import { demoUsers } from "../../config/constants.js";
import { consultationCharge, invoiceProfiles, ipdWardCharges, panchkarmaTherapyRates } from "../../config/hospitalData.js";
import { createId, db } from "../../data/store.js";
import { todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import { getPatientById as getPersistedPatientById } from "../patients/patients.service.js";
import {
  applyDiscountRecord,
  createBillRecord,
  createPaymentRecord,
  createRefundRecord,
  findBillById,
  listBillRecords,
  listPaymentRecords,
  listRefundRecords
} from "./billing.repository.js";

function sumItems(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getRefundStore() {
  if (!Array.isArray(db.refunds)) {
    db.refunds = [];
  }

  return db.refunds;
}

function syncById(collection, item) {
  if (!item) return;
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    collection[index] = item;
    return;
  }
  collection.unshift(item);
}

function syncBillMirror(bill) {
  syncById(db.bills, bill);
}

function syncPaymentMirror(payment) {
  syncById(db.payments, payment);
}

function syncRefundMirror(refund) {
  syncById(getRefundStore(), refund);
}

function getDoctorById(doctorId) {
  return demoUsers.find((entry) => entry.id === doctorId || entry.metadata?.sourceId === doctorId) || null;
}

function getBedById(bedId) {
  return db.beds.find((entry) => entry.id === bedId) || null;
}

function formatPatientAddress(patient) {
  if (!patient) {
    return "";
  }

  return [patient.address, patient.city, patient.state, patient.pincode]
    .filter(Boolean)
    .join(", ");
}

async function getPatientById(patientId) {
  try {
    return await getPersistedPatientById(patientId);
  } catch (error) {
    if (error.statusCode !== 404) {
      throw error;
    }
    return db.patients.find((entry) => entry.id === patientId) || null;
  }
}

async function getBillOrThrow(billId) {
  const bill = await findBillById(billId);
  if (!bill) {
    throw createError("Bill not found.", 404);
  }
  return bill;
}

export async function loadBillingMirrorsFromDatabase() {
  const bills = await listBillRecords();
  const payments = await listPaymentRecords();
  const refunds = await listRefundRecords();

  db.bills.splice(0, db.bills.length, ...bills);
  db.payments.splice(0, db.payments.length, ...payments);
  db.refunds = refunds;

  return { bills, payments, refunds };
}

export async function listBills(query = {}) {
  return listBillRecords(query);
}

export async function listPayments(query = {}) {
  return listPaymentRecords(query);
}

export async function listRefunds(query = {}) {
  return listRefundRecords(query);
}

export async function getBillDetails(billId) {
  const bill = await getBillOrThrow(billId);
  const patient = bill.patientId ? await getPatientById(bill.patientId) : null;
  const visit = bill.visitId ? db.opdVisits.find((entry) => entry.id === bill.visitId) || null : null;
  const sourceBedId = bill.metadata?.sourceBedId || "";
  const bed = bill.bedId ? getBedById(bill.bedId) : (sourceBedId ? getBedById(sourceBedId) : null);
  const room = bed ? db.rooms.find((entry) => entry.id === bed.roomId) || null : null;
  const doctor = visit?.doctorId ? getDoctorById(visit.doctorId) : null;

  return {
    item: bill,
    patient,
    visit,
    doctor,
    room,
    bed
  };
}

export async function getBillInvoice(billId) {
  const details = await getBillDetails(billId);
  const bill = details.item;

  return {
    ...details,
    invoice: {
      invoiceNumber: bill.billNumber,
      generatedAt: new Date().toISOString(),
      printable: true,
      endpoint: `/api/v1/billing/bills/${bill.id}/invoice`
    }
  };
}

export async function getBillingSummary() {
  const bills = await listBills();
  const payments = await listPayments({ dateFrom: todayDate(), dateTo: todayDate() });
  const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.paidAmount || 0), 0);
  const outstanding = bills.reduce((sum, bill) => sum + Math.max(Number(bill.balanceAmount || 0), 0), 0);

  return {
    totalBills: bills.length,
    paidBills: bills.filter((bill) => bill.paymentStatus === "paid").length,
    partialBills: bills.filter((bill) => bill.paymentStatus === "partial").length,
    unpaidBills: bills.filter((bill) => bill.paymentStatus === "unpaid").length,
    totalRevenue,
    outstanding,
    todayCollections: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  };
}

export function getBillingMasters() {
  return {
    billTypes: ["opd", "ipd", "lab", "pharmacy", "therapy", "room", "procedure", "miscellaneous"],
    paymentModes: ["cash", "upi", "card", "bank_transfer"],
    itemCategories: ["consultation", "lab", "pharmacy", "room", "therapy", "procedure", "service", "miscellaneous"],
    standardCharges: {
      consultation: consultationCharge,
      ipdWardCharges,
      panchkarmaTherapies: panchkarmaTherapyRates
    },
    invoiceProfiles
  };
}

export async function createBill(payload) {
  if (!payload.patientId || !payload.items?.length) {
    throw createError("Patient and at least one bill item are required.");
  }

  const patient = await getPatientById(payload.patientId);
  if (!patient) {
    throw createError("Patient not found.", 404);
  }

  const items = payload.items.map((item) => {
    if (!item.description) {
      throw createError("Each bill item requires a description.");
    }

    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const amount = Number(item.amount || quantity * unitPrice);

    if (quantity <= 0 || unitPrice < 0 || amount < 0) {
      throw createError("Bill items must have valid quantity and pricing.");
    }

    return {
      id: item.id || createId(),
      description: item.description,
      category: item.category || "service",
      quantity,
      unitPrice,
      amount,
      batchNumber: item.batchNumber || "",
      pack: item.pack || "",
      expiryDate: item.expiryDate || "",
      gstPercent: Number(item.gstPercent || 0),
      metadata: item.metadata || {}
    };
  });

  const subtotal = sumItems(items);
  const discountAmount = Number(payload.discountAmount || 0);
  const taxAmount = Number(payload.taxAmount || 0);

  if (discountAmount < 0 || taxAmount < 0) {
    throw createError("Discount and tax must be zero or greater.");
  }

  if (discountAmount > subtotal) {
    throw createError("Discount cannot be greater than subtotal.");
  }

  const bill = await createBillRecord({
    id: payload.id || createId(),
    billNumber: payload.billNumber,
    patientId: patient.id,
    patientName: payload.patientName || patient.fullName || `${patient.firstName} ${patient.lastName}`.trim(),
    visitId: payload.visitId || "",
    bedId: payload.bedId || "",
    billType: payload.billType || "opd",
    billDate: payload.billDate || todayDate(),
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount: subtotal - discountAmount + taxAmount,
    paymentStatus: payload.paymentStatus || "unpaid",
    createdBy: payload.createdBy,
    notes: payload.notes || "",
    invoiceMeta: {
      doctorName: payload.invoiceMeta?.doctorName || "",
      doctorRegNo: payload.invoiceMeta?.doctorRegNo || "",
      patientAddress: payload.invoiceMeta?.patientAddress || formatPatientAddress(patient),
      remark: payload.invoiceMeta?.remark || ""
    },
    metadata: payload.metadata || {},
    items
  });

  syncBillMirror(bill);
  return bill;
}

export async function applyBillDiscount(billId, payload = {}, actorId = "") {
  const bill = await getBillOrThrow(billId);
  const discountAmount = Number(payload.discountAmount);

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    throw createError("Valid discount amount is required.");
  }

  if (discountAmount > Number(bill.subtotal || 0)) {
    throw createError("Discount cannot be greater than subtotal.");
  }

  const nextTotal = Number(bill.subtotal || 0) - discountAmount + Number(bill.taxAmount || 0);
  if (nextTotal < Number(bill.paidAmount || 0)) {
    throw createError("Discount cannot reduce total below net collected amount.");
  }

  const updated = await applyDiscountRecord(
    billId,
    {
      historyId: createId(),
      discountAmount,
      reason: String(payload.reason || "").trim()
    },
    actorId
  );

  syncBillMirror(updated);
  return updated;
}

export async function collectPayment(billId, payload) {
  const bill = await getBillOrThrow(billId);

  if (!payload.amount) {
    throw createError("Payment amount is required.");
  }

  const amount = Number(payload.amount || 0);
  if (amount <= 0) {
    throw createError("Payment amount must be greater than zero.");
  }

  if (amount > Number(bill.balanceAmount || 0)) {
    throw createError("Payment amount cannot exceed the outstanding balance.");
  }

  const result = await createPaymentRecord(billId, {
    id: payload.id || createId(),
    receiptNumber: payload.receiptNumber,
    paymentDate: payload.paymentDate,
    amount,
    paymentMode: payload.paymentMode || "cash",
    referenceNumber: payload.referenceNumber || "",
    receivedBy: payload.receivedBy,
    note: payload.note || "",
    metadata: payload.metadata || {}
  });

  if (!result) {
    throw createError("Bill not found.", 404);
  }

  syncPaymentMirror(result.payment);
  syncBillMirror(result.bill);
  return result;
}

export async function createRefund(payload = {}, actorId = "") {
  if (!payload.billId || !payload.amount) {
    throw createError("Bill and refund amount are required.");
  }

  if (!payload.reason || !String(payload.reason).trim()) {
    throw createError("Refund reason is required.");
  }

  const bill = await getBillOrThrow(payload.billId);
  const amount = Number(payload.amount || 0);

  if (amount <= 0) {
    throw createError("Refund amount must be greater than zero.");
  }

  if (amount > Number(bill.paidAmount || 0)) {
    throw createError("Refund amount cannot exceed net collected amount.");
  }

  const result = await createRefundRecord({
    id: payload.id || createId(),
    refundNumber: payload.refundNumber,
    billId: payload.billId,
    refundDate: payload.refundDate,
    amount,
    paymentMode: payload.paymentMode || "cash",
    referenceNumber: payload.referenceNumber || "",
    reason: String(payload.reason).trim(),
    note: payload.note || "",
    approvedBy: actorId,
    metadata: payload.metadata || {}
  });

  if (!result) {
    throw createError("Bill not found.", 404);
  }

  syncRefundMirror(result.refund);
  syncBillMirror(result.bill);
  return result;
}
