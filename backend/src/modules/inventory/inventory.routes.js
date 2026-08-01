import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
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
inventoryRouter.post("/hospital-items", authorizeRolesOnly(["admin", "accounts"]), createHospitalInventoryItemHandler);
inventoryRouter.post("/hospital-items/stock", authorizeRolesOnly(["admin", "accounts", "nursing", "housekeeping"]), adjustHospitalInventoryStockHandler);
inventoryRouter.get("/hospital-transactions", authorize(["admin", "accounts", "nursing", "hr", "housekeeping"]), hospitalInventoryTransactionsHandler);
inventoryRouter.get("/batches", authorize(["admin", "pharmacy", "accounts"]), inventoryBatchesHandler);
inventoryRouter.get("/transactions", authorize(["admin", "pharmacy", "accounts"]), stockTransactionsHandler);
inventoryRouter.get("/suppliers", authorizeRolesOnly(["admin"]), suppliersHandler);
inventoryRouter.post("/suppliers", authorizeRolesOnly(["admin"]), createSupplierHandler);
inventoryRouter.get("/purchase-orders", authorizeRolesOnly(["admin"]), purchaseOrdersHandler);
inventoryRouter.post("/purchase-orders", authorizeRolesOnly(["admin"]), createPurchaseOrderHandler);
inventoryRouter.post("/receive", authorizeRolesOnly(["admin", "pharmacy"]), receiveStockHandler);

export { inventoryRouter };
