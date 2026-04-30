import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  dispenseHandler,
  dispensationsHandler,
  expiryStockHandler,
  lowStockHandler,
  pharmacyMastersHandler,
  pharmacyStockHandler,
  prescriptionQueueHandler
} from "./pharmacy.controller.js";

const pharmacyRouter = Router();

pharmacyRouter.get("/masters", authorize(["admin", "pharmacy", "doctor", "accounts"]), pharmacyMastersHandler);
pharmacyRouter.get("/stock", authorize(["admin", "pharmacy", "accounts", "doctor"]), pharmacyStockHandler);
pharmacyRouter.get("/stock/low", authorize(["admin", "pharmacy", "accounts"]), lowStockHandler);
pharmacyRouter.get("/stock/expiry", authorize(["admin", "pharmacy", "accounts"]), expiryStockHandler);
pharmacyRouter.get("/prescriptions", authorize(["admin", "pharmacy", "doctor"]), prescriptionQueueHandler);
pharmacyRouter.get("/dispensations", authorize(["admin", "pharmacy", "accounts"]), dispensationsHandler);
pharmacyRouter.post(
  "/prescriptions/:prescriptionId/dispense",
  authorize(["admin", "pharmacy"]),
  dispenseHandler
);

export { pharmacyRouter };
