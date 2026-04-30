import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  assessmentSaveHandler,
  completeVisitHandler,
  createVisitLabOrderHandler,
  createVisitHandler,
  mastersHandler,
  prescriptionSaveHandler,
  queueHandler,
  referVisitToIpdHandler,
  visitDetailsHandler,
  vitalsHandler
} from "./opd.controller.js";

const opdRouter = Router();

opdRouter.get("/queue", authorize(["admin", "reception", "doctor"]), queueHandler);
opdRouter.get("/masters", authorize(["admin", "doctor", "reception"]), mastersHandler);
opdRouter.post("/visits", authorize(["admin", "reception", "doctor"]), createVisitHandler);
opdRouter.get("/visits/:id", authorize(["admin", "doctor", "reception"]), visitDetailsHandler);
opdRouter.put("/visits/:id/vitals", authorize(["admin", "doctor", "reception"]), vitalsHandler);
opdRouter.post("/visits/:id/ayurveda", authorize(["admin", "doctor"]), assessmentSaveHandler);
opdRouter.post("/visits/:id/prescriptions", authorize(["admin", "doctor"]), prescriptionSaveHandler);
opdRouter.post("/visits/:id/lab-orders", authorize(["admin", "doctor"]), createVisitLabOrderHandler);
opdRouter.post("/visits/:id/refer-ipd", authorize(["admin", "doctor"]), referVisitToIpdHandler);
opdRouter.put("/visits/:id/complete", authorize(["admin", "doctor"]), completeVisitHandler);

export { opdRouter };
