import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
import {
  assessmentSaveHandler,
  completeVisitHandler,
  createVisitLabOrderHandler,
  createVisitHandler,
  dischargeSummarySaveHandler,
  mastersHandler,
  historyTakingSaveHandler,
  prescriptionSaveHandler,
  queueHandler,
  referVisitToIpdHandler,
  systemicExaminationSaveHandler,
  visitDetailsHandler,
  visitWorkflowActionHandler,
  vitalsHandler
} from "./opd.controller.js";

const opdRouter = Router();

opdRouter.get("/queue", authorize(["admin", "reception", "doctor", "nursing"]), queueHandler);
opdRouter.get("/masters", authorize(["admin", "doctor", "reception", "nursing"]), mastersHandler);
opdRouter.post("/visits", authorizeRolesOnly(["admin", "reception", "doctor"]), createVisitHandler);
opdRouter.get("/visits/:id", authorize(["admin", "doctor", "reception", "nursing"]), visitDetailsHandler);
opdRouter.put("/visits/:id/vitals", authorizeRolesOnly(["admin", "doctor", "nursing"]), vitalsHandler);
opdRouter.put("/visits/:id/systemic-examination", authorizeRolesOnly(["admin", "doctor"]), systemicExaminationSaveHandler);
opdRouter.put("/visits/:id/history-taking", authorizeRolesOnly(["admin", "doctor"]), historyTakingSaveHandler);
opdRouter.post("/visits/:id/ayurveda", authorizeRolesOnly(["admin", "doctor"]), assessmentSaveHandler);
opdRouter.post("/visits/:id/prescriptions", authorizeRolesOnly(["admin", "doctor"]), prescriptionSaveHandler);
opdRouter.post("/visits/:id/discharge-summary", authorizeRolesOnly(["admin", "doctor"]), dischargeSummarySaveHandler);
opdRouter.post("/visits/:id/lab-orders", authorizeRolesOnly(["admin", "doctor"]), createVisitLabOrderHandler);
opdRouter.post("/visits/:id/refer-ipd", authorizeRolesOnly(["admin", "doctor"]), referVisitToIpdHandler);
opdRouter.put("/visits/:id/complete", authorizeRolesOnly(["admin", "doctor"]), completeVisitHandler);
opdRouter.put("/visits/:id/workflow", authorizeRolesOnly(["admin", "doctor", "reception", "nursing"]), visitWorkflowActionHandler);

export { opdRouter };
