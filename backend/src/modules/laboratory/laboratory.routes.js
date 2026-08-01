import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
import {
  collectSampleHandler,
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
laboratoryRouter.post("/orders", authorizeRolesOnly(["admin", "doctor"]), createOrderHandler);
laboratoryRouter.post("/orders/:id/sample-collection", authorizeRolesOnly(["admin", "lab", "reception", "doctor"]), collectSampleHandler);
laboratoryRouter.post("/orders/:id/results", authorizeRolesOnly(["admin", "lab", "doctor"]), saveResultsHandler);
laboratoryRouter.put("/orders/:id/workflow", authorizeRolesOnly(["admin", "lab", "reception", "doctor"]), labWorkflowActionHandler);

export { laboratoryRouter };
