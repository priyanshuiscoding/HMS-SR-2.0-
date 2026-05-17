import {
  adjustHospitalInventoryStock,
  createHospitalInventoryItem,
  createPurchaseOrder,
  createSupplier,
  getInventoryMasters,
  listHospitalInventoryItems,
  listHospitalInventoryTransactions,
  listInventoryBatches,
  listPurchaseOrders,
  listSuppliers,
  listStockTransactions,
  receiveStock
} from "./inventory.service.js";

export async function hospitalInventoryItemsHandler(req, res, next) {
  try {
    res.json({ items: await listHospitalInventoryItems(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createHospitalInventoryItemHandler(req, res, next) {
  try {
    const item = await createHospitalInventoryItem(req.body, req.user.sub);
    res.status(201).json({ item, message: "Hospital inventory item created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function adjustHospitalInventoryStockHandler(req, res, next) {
  try {
    const item = await adjustHospitalInventoryStock(req.body, req.user.sub);
    res.status(201).json({ item, message: "Hospital inventory stock updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function hospitalInventoryTransactionsHandler(req, res, next) {
  try {
    res.json({ items: await listHospitalInventoryTransactions(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function inventoryMastersHandler(_req, res, next) {
  try {
    res.json(await getInventoryMasters());
  } catch (error) {
    next(error);
  }
}

export async function inventoryBatchesHandler(req, res, next) {
  try {
    res.json({ items: await listInventoryBatches(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function stockTransactionsHandler(req, res, next) {
  try {
    res.json({ items: await listStockTransactions(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function receiveStockHandler(req, res, next) {
  try {
    const item = await receiveStock(req.body, req.user.sub);
    res.status(201).json({ item, message: "Stock batch received successfully." });
  } catch (error) {
    next(error);
  }
}

export async function suppliersHandler(req, res, next) {
  try {
    res.json({ items: await listSuppliers(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createSupplierHandler(req, res, next) {
  try {
    const item = await createSupplier(req.body);
    res.status(201).json({ item, message: "Supplier created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function purchaseOrdersHandler(req, res, next) {
  try {
    res.json({ items: await listPurchaseOrders(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseOrderHandler(req, res, next) {
  try {
    const item = await createPurchaseOrder(req.body, req.user.sub);
    res.status(201).json({ item, message: "Purchase order created successfully." });
  } catch (error) {
    next(error);
  }
}
