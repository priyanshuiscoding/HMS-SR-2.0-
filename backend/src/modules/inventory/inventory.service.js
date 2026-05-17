import { createId, db, getGodownImportSummary } from "../../data/store.js";
import { todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import {
  adjustHospitalInventoryStockRecord,
  createPurchaseOrderRecord,
  createHospitalInventoryItemRecord,
  createSupplierRecord,
  listHospitalInventoryItemRecords,
  listHospitalInventoryTransactionRecords,
  listBatchRecords,
  listMedicineRecords,
  listPurchaseOrderRecords,
  listStockTransactionRecords,
  listSupplierRecords,
  loadInventoryMirrors,
  receiveStockRecord,
  supplierNameExists
} from "./inventory.repository.js";

function syncInventoryMirrors({ medicines = [], suppliers = [], batches = [], stockTransactions = [], purchaseOrders = [] } = {}) {
  db.medicineMasters.splice(0, db.medicineMasters.length, ...medicines);
  db.suppliers.splice(0, db.suppliers.length, ...suppliers);
  db.inventoryBatches.splice(0, db.inventoryBatches.length, ...batches);
  db.stockTransactions.splice(0, db.stockTransactions.length, ...stockTransactions);
  db.purchaseOrders = purchaseOrders;
}

export async function loadInventoryMirrorsFromDatabase() {
  const mirrors = await loadInventoryMirrors();
  syncInventoryMirrors(mirrors);
  return mirrors;
}

export async function getInventoryMasters() {
  const [medicines, suppliers] = await Promise.all([listMedicineRecords(), listSupplierRecords()]);
  db.medicineMasters.splice(0, db.medicineMasters.length, ...medicines);
  db.suppliers.splice(0, db.suppliers.length, ...suppliers);

  return {
    medicines,
    suppliers,
    godownImport: getGodownImportSummary(),
    purchaseOrderStatuses: ["draft", "sent", "approved", "received", "cancelled"]
  };
}

export async function listHospitalInventoryItems(query = {}) {
  return listHospitalInventoryItemRecords(query);
}

export async function createHospitalInventoryItem(payload = {}, userId = "") {
  if (!payload.name || !String(payload.name).trim()) {
    throw createError("Inventory item name is required.");
  }

  const openingQuantity = Number(payload.openingQuantity || 0);
  if (!Number.isFinite(openingQuantity) || openingQuantity < 0) {
    throw createError("Opening quantity must be zero or greater.");
  }

  return createHospitalInventoryItemRecord({
    id: createId(),
    transactionId: createId(),
    name: String(payload.name).trim(),
    category: String(payload.category || "General").trim(),
    department: String(payload.department || "Hospital Store").trim(),
    unit: String(payload.unit || "unit").trim(),
    openingQuantity,
    reorderLevel: Number(payload.reorderLevel || 0),
    location: String(payload.location || "").trim(),
    supplierId: payload.supplierId || "",
    purchasePrice: Number(payload.purchasePrice || 0),
    notes: String(payload.notes || "").trim(),
    createdBy: userId
  });
}

export async function adjustHospitalInventoryStock(payload = {}, userId = "") {
  if (!payload.itemId || !payload.type || !payload.quantity) {
    throw createError("Item, transaction type, and quantity are required.");
  }

  if (!["receipt", "issue", "adjustment"].includes(payload.type)) {
    throw createError("Invalid hospital inventory transaction type.");
  }

  const result = await adjustHospitalInventoryStockRecord({
    id: createId(),
    itemId: payload.itemId,
    type: payload.type,
    quantity: Number(payload.quantity || 0),
    referenceNumber: String(payload.referenceNumber || "").trim(),
    department: String(payload.department || "").trim(),
    note: String(payload.note || "").trim(),
    createdBy: userId
  });

  if (result.conflict === "item_missing") throw createError("Hospital inventory item not found.", 404);
  if (result.conflict === "invalid_quantity") throw createError("Quantity must be greater than zero.");
  if (result.conflict === "insufficient_stock") throw createError(`Insufficient stock for ${result.itemName}.`);

  return result.transaction;
}

export async function listHospitalInventoryTransactions(query = {}) {
  return listHospitalInventoryTransactionRecords(query);
}

export async function listInventoryBatches(query = {}) {
  const items = await listBatchRecords(query);
  db.inventoryBatches.splice(0, db.inventoryBatches.length, ...items);
  return items;
}

export async function listStockTransactions(query = {}) {
  const items = await listStockTransactionRecords(query);
  db.stockTransactions.splice(0, db.stockTransactions.length, ...items);
  return items;
}

export async function receiveStock(payload, userId = "") {
  if (!payload.medicineId || !payload.batchNumber || !payload.quantityReceived) {
    throw createError("Medicine, batch number, and quantity are required.");
  }

  const quantityReceived = Number(payload.quantityReceived || 0);
  if (quantityReceived <= 0) {
    throw createError("Quantity received must be greater than zero.");
  }

  const result = await receiveStockRecord({
    id: createId(),
    transactionId: createId(),
    medicineId: payload.medicineId,
    batchNumber: payload.batchNumber,
    supplierId: payload.supplierId || "",
    receivedDate: payload.receivedDate || todayDate(),
    expiryDate: payload.expiryDate || "",
    quantityReceived,
    purchasePrice: Number(payload.purchasePrice || 0),
    sellingPrice: Number(payload.sellingPrice || 0),
    invoiceNumber: payload.invoiceNumber || "",
    note: payload.note || "",
    receivedBy: userId
  });

  if (result.conflict === "medicine_missing") {
    throw createError("Medicine not found.", 404);
  }

  await loadInventoryMirrorsFromDatabase();
  return result.batch;
}

export async function listSuppliers(query = {}) {
  const items = await listSupplierRecords(query);
  db.suppliers.splice(0, db.suppliers.length, ...items);
  return items;
}

export async function createSupplier(payload = {}) {
  if (!payload.name || !String(payload.name).trim()) {
    throw createError("Supplier name is required.");
  }

  if (await supplierNameExists(String(payload.name).trim())) {
    throw createError("Supplier with this name already exists.");
  }

  const supplier = await createSupplierRecord({
    id: createId(),
    name: String(payload.name).trim(),
    phone: String(payload.phone || "").trim(),
    city: String(payload.city || "").trim(),
    email: String(payload.email || "").trim(),
    contactPerson: String(payload.contactPerson || "").trim(),
    address: String(payload.address || "").trim(),
    gstin: String(payload.gstin || "").trim()
  });

  db.suppliers.push(supplier);
  return supplier;
}

export async function listPurchaseOrders(query = {}) {
  const items = await listPurchaseOrderRecords(query);
  db.purchaseOrders = items;
  return items;
}

export async function createPurchaseOrder(payload = {}, userId = "") {
  if (!payload.supplierId) {
    throw createError("supplierId is required.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw createError("At least one purchase-order line item is required.");
  }

  const status = payload.status || "draft";
  const allowedStatuses = ["draft", "sent", "approved", "received", "cancelled"];
  if (!allowedStatuses.includes(status)) {
    throw createError("Invalid purchase-order status.");
  }

  const items = payload.items.map((line) => {
    if (!line.medicineId) {
      throw createError("Each purchase-order line requires medicineId.");
    }
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createError("Purchase-order quantity must be greater than zero.");
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw createError("Purchase-order unit price must be zero or greater.");
    }
    return {
      id: createId(),
      medicineId: line.medicineId,
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
      note: String(line.note || "").trim()
    };
  });
  const subtotal = items.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const taxAmount = Number(payload.taxAmount || 0);
  if (!Number.isFinite(taxAmount) || taxAmount < 0) {
    throw createError("taxAmount must be zero or greater.");
  }

  const order = await createPurchaseOrderRecord({
    id: createId(),
    supplierId: payload.supplierId,
    orderDate: payload.orderDate || todayDate(),
    expectedDate: payload.expectedDate || "",
    status,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    note: String(payload.note || "").trim(),
    createdBy: userId,
    items
  });

  if (order.conflict === "supplier_missing") throw createError("Supplier not found.", 404);
  if (order.conflict === "medicine_missing") throw createError("Medicine not found.", 404);

  db.purchaseOrders = [order, ...(db.purchaseOrders || [])];
  return order;
}
