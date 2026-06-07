import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  collectSampleHandler,
  createBillHandler,
  createOrderHandler,
  labWorkflowActionHandler,
  listOrdersHandler,
  mastersHandler,
  orderDetailsHandler,
  saveResultsHandler,
  summaryHandler
} from "./laboratory.controller.js";

const laboratoryRouter = Router();

laboratoryRouter.get("/tests", authorize(["admin", "doctor", "reception", "lab"]), mastersHandler);
laboratoryRouter.get("/summary", authorize(["admin", "doctor", "lab", "reception", "accounts"]), summaryHandler);
laboratoryRouter.get("/orders", authorize(["admin", "doctor", "lab", "reception"]), listOrdersHandler);
laboratoryRouter.get("/orders/:id", authorize(["admin", "doctor", "lab", "reception", "accounts"]), orderDetailsHandler);
laboratoryRouter.post("/orders", authorize(["admin", "doctor"]), createOrderHandler);
laboratoryRouter.post("/orders/:id/sample-collection", authorize(["admin", "lab", "reception", "doctor"]), collectSampleHandler);
laboratoryRouter.post("/orders/:id/results", authorize(["admin", "lab", "doctor"]), saveResultsHandler);
laboratoryRouter.post("/orders/:id/bill", authorize(["admin", "accounts", "reception", "doctor", "lab"]), createBillHandler);
laboratoryRouter.put("/orders/:id/workflow", authorize(["admin", "lab", "reception", "doctor"]), labWorkflowActionHandler);

export { laboratoryRouter };
