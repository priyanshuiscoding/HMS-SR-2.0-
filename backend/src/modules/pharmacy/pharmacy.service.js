import { createId, db } from "../../data/store.js";
import { createError } from "../../utils/errors.js";
import { listBatchRecords, listMedicineRecords } from "../inventory/inventory.repository.js";
import { loadInventoryMirrorsFromDatabase } from "../inventory/inventory.service.js";
import {
  dispensePrescriptionRecord,
  getExpiringBatchRecords,
  getStockSummaryRecords,
  listDispensationRecords,
  listPrescriptionQueueRecords,
  loadPharmacyMirrors
} from "./pharmacy.repository.js";

function syncPharmacyMirrors({ stockTransactions = [], dispensations = [] } = {}) {
  db.stockTransactions.splice(0, db.stockTransactions.length, ...stockTransactions);
  db.dispensations.splice(0, db.dispensations.length, ...dispensations);
}

export async function loadPharmacyMirrorsFromDatabase() {
  const mirrors = await loadPharmacyMirrors();
  syncPharmacyMirrors(mirrors);
  return mirrors;
}

export async function getPharmacyStock() {
  const stock = await getStockSummaryRecords();
  db.medicineMasters.splice(0, db.medicineMasters.length, ...stock.map(({ totalAvailable, nearestExpiry, lowStock, expiringSoon, activeBatches, ...medicine }) => medicine));
  db.inventoryBatches.splice(0, db.inventoryBatches.length, ...(await listBatchRecords()));
  return stock.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPharmacyAlerts(stockItems = null) {
  const stock = stockItems || (await getPharmacyStock());
  return {
    lowStock: stock.filter((item) => item.lowStock),
    expiringSoon: stock.filter((item) => item.expiringSoon),
    outOfStock: stock.filter((item) => Number(item.totalAvailable || 0) === 0)
  };
}

export async function getPharmacyMasters() {
  const [medicines, stock] = await Promise.all([listMedicineRecords(), getPharmacyStock()]);
  db.medicineMasters.splice(0, db.medicineMasters.length, ...medicines);
  return {
    medicines,
    statuses: ["pending", "completed"],
    alerts: await getPharmacyAlerts(stock)
  };
}

export async function getLowStockMedicines() {
  return (await getPharmacyStock())
    .filter((item) => item.lowStock)
    .sort((a, b) => Number(a.totalAvailable || 0) - Number(b.totalAvailable || 0) || a.name.localeCompare(b.name));
}

export async function getExpiringStock(query = {}) {
  const withinDaysRaw = Number(query.withinDays || 90);
  const withinDays = Number.isFinite(withinDaysRaw) && withinDaysRaw > 0 ? withinDaysRaw : 90;
  return getExpiringBatchRecords(withinDays);
}

export async function listPrescriptionQueue(query = {}) {
  return listPrescriptionQueueRecords(query);
}

export async function listDispensations(query = {}) {
  const items = await listDispensationRecords(query);
  db.dispensations.splice(0, db.dispensations.length, ...items);
  return items;
}

export async function dispensePrescription(prescriptionId, payload = {}, userId = "") {
  const dispensation = await dispensePrescriptionRecord(prescriptionId, {
    id: createId(),
    createId,
    items: payload.items || [],
    dispensedBy: userId
  });

  if (!dispensation) {
    throw createError("Prescription not found.", 404);
  }
  if (dispensation.conflict === "already_dispensed") {
    throw createError("This prescription has already been dispensed.");
  }
  if (dispensation.conflict === "medicine_missing") {
    throw createError(`Unknown medicine: ${dispensation.medicineId}`);
  }
  if (dispensation.conflict === "invalid_quantity") {
    throw createError(`Dispense quantity is required for ${dispensation.medicineName}.`);
  }
  if (dispensation.conflict === "insufficient_stock") {
    throw createError(`Insufficient stock for ${dispensation.medicineName}.`);
  }

  const prescription = db.prescriptions.find((entry) => entry.id === prescriptionId);
  if (prescription) {
    prescription.isDispensed = true;
    prescription.dispensation = dispensation;
  }

  await loadInventoryMirrorsFromDatabase();
  await loadPharmacyMirrorsFromDatabase();
  return dispensation;
}
