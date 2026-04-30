import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  createPurchaseOrderHandler,
  createSupplierHandler,
  inventoryBatchesHandler,
  inventoryMastersHandler,
  purchaseOrdersHandler,
  receiveStockHandler,
  suppliersHandler,
  stockTransactionsHandler
} from "./inventory.controller.js";

const inventoryRouter = Router();

inventoryRouter.get("/masters", authorize(["admin", "pharmacy", "accounts"]), inventoryMastersHandler);
inventoryRouter.get("/batches", authorize(["admin", "pharmacy", "accounts"]), inventoryBatchesHandler);
inventoryRouter.get("/transactions", authorize(["admin", "pharmacy", "accounts"]), stockTransactionsHandler);
inventoryRouter.get("/suppliers", authorize(["admin"]), suppliersHandler);
inventoryRouter.post("/suppliers", authorize(["admin"]), createSupplierHandler);
inventoryRouter.get("/purchase-orders", authorize(["admin"]), purchaseOrdersHandler);
inventoryRouter.post("/purchase-orders", authorize(["admin"]), createPurchaseOrderHandler);
inventoryRouter.post("/receive", authorize(["admin", "pharmacy"]), receiveStockHandler);

export { inventoryRouter };
