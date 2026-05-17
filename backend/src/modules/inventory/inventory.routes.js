import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  adjustHospitalInventoryStockHandler,
  createHospitalInventoryItemHandler,
  createPurchaseOrderHandler,
  createSupplierHandler,
  hospitalInventoryItemsHandler,
  hospitalInventoryTransactionsHandler,
  inventoryBatchesHandler,
  inventoryMastersHandler,
  purchaseOrdersHandler,
  receiveStockHandler,
  suppliersHandler,
  stockTransactionsHandler
} from "./inventory.controller.js";

const inventoryRouter = Router();

inventoryRouter.get("/masters", authorize(["admin", "pharmacy", "accounts", "nursing", "hr", "housekeeping"]), inventoryMastersHandler);
inventoryRouter.get("/hospital-items", authorize(["admin", "accounts", "nursing", "hr", "housekeeping"]), hospitalInventoryItemsHandler);
inventoryRouter.post("/hospital-items", authorize(["admin", "accounts"]), createHospitalInventoryItemHandler);
inventoryRouter.post("/hospital-items/stock", authorize(["admin", "accounts", "nursing", "housekeeping"]), adjustHospitalInventoryStockHandler);
inventoryRouter.get("/hospital-transactions", authorize(["admin", "accounts", "nursing", "hr", "housekeeping"]), hospitalInventoryTransactionsHandler);
inventoryRouter.get("/batches", authorize(["admin", "pharmacy", "accounts"]), inventoryBatchesHandler);
inventoryRouter.get("/transactions", authorize(["admin", "pharmacy", "accounts"]), stockTransactionsHandler);
inventoryRouter.get("/suppliers", authorize(["admin"]), suppliersHandler);
inventoryRouter.post("/suppliers", authorize(["admin"]), createSupplierHandler);
inventoryRouter.get("/purchase-orders", authorize(["admin"]), purchaseOrdersHandler);
inventoryRouter.post("/purchase-orders", authorize(["admin"]), createPurchaseOrderHandler);
inventoryRouter.post("/receive", authorize(["admin", "pharmacy"]), receiveStockHandler);

export { inventoryRouter };
