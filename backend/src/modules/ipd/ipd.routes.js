import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  addAdmissionNoteHandler,
  addAdmissionVitalsHandler,
  admissionDetailsHandler,
  admissionNotesHandler,
  admissionVitalsHandler,
  admitPatientHandler,
  dischargeAdmissionHandler,
  ipdCensusHandler,
  ipdMastersHandler,
  ipdSummaryHandler,
  listAdmissionsHandler,
  updateAdmissionHandler
} from "./ipd.controller.js";

const ipdRouter = Router();

ipdRouter.get("/masters", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), ipdMastersHandler);
ipdRouter.get("/summary", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), ipdSummaryHandler);
ipdRouter.get("/census", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), ipdCensusHandler);
ipdRouter.get("/admissions", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), listAdmissionsHandler);
ipdRouter.get("/admissions/:id", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), admissionDetailsHandler);
ipdRouter.get("/admissions/:id/notes", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), admissionNotesHandler);
ipdRouter.get("/admissions/:id/vitals", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), admissionVitalsHandler);
ipdRouter.post("/admissions", authorize(["admin", "doctor", "reception", "nursing"]), admitPatientHandler);
ipdRouter.put("/admissions/:id", authorize(["admin", "doctor", "reception", "nursing"]), updateAdmissionHandler);
ipdRouter.post("/admissions/:id/notes", authorize(["admin", "doctor", "nursing"]), addAdmissionNoteHandler);
ipdRouter.post("/admissions/:id/vitals", authorize(["admin", "doctor", "nursing"]), addAdmissionVitalsHandler);
ipdRouter.post("/admissions/:id/discharge", authorize(["admin", "doctor", "reception", "accounts", "nursing"]), dischargeAdmissionHandler);

export { ipdRouter };
