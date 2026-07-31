import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  applyDiscountHandler,
  billDetailsHandler,
  billingMastersHandler,
  billingSummaryHandler,
  collectPaymentHandler,
  createPaymentHandler,
  createRefundHandler,
  createBillHandler,
  invoiceHandler,
  listBillsHandler,
  listPaymentsHandler,
  listRefundsHandler,
  pendingChargesHandler
} from "./billing.controller.js";

const billingRouter = Router();

billingRouter.get("/masters", authorize(["admin", "accounts", "doctor", "reception"]), billingMastersHandler);
billingRouter.get("/summary", authorize(["admin", "accounts", "doctor", "reception"]), billingSummaryHandler);
billingRouter.get("/pending-charges", authorize(["admin", "accounts", "doctor", "reception"]), pendingChargesHandler);
billingRouter.get("/bills", authorize(["admin", "accounts", "doctor", "reception"]), listBillsHandler);
billingRouter.get("/payments", authorize(["admin", "accounts", "doctor", "reception"]), listPaymentsHandler);
billingRouter.get("/refunds", authorize(["admin", "accounts"]), listRefundsHandler);
billingRouter.get("/bills/:id", authorize(["admin", "accounts", "doctor", "reception"]), billDetailsHandler);
billingRouter.get("/bills/:id/invoice", authorize(["admin", "accounts", "doctor", "reception"]), invoiceHandler);
billingRouter.post("/bills", authorize(["admin", "accounts", "doctor", "reception"]), createBillHandler);
billingRouter.post("/payments", authorize(["admin", "accounts", "reception"]), createPaymentHandler);
billingRouter.post("/bills/:id/payments", authorize(["admin", "accounts", "reception"]), collectPaymentHandler);
billingRouter.post("/bills/:id/discount", authorize(["admin", "accounts"]), applyDiscountHandler);
billingRouter.post("/refunds", authorize(["admin", "accounts"]), createRefundHandler);

export { billingRouter };
