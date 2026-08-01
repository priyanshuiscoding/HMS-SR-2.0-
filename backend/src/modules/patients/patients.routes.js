import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
import {
  createPatientHandler,
  deletePatientHandler,
  deletePatientDocumentHandler,
  downloadPatientDocumentHandler,
  getPatientHandler,
  listPatientDocumentsHandler,
  listPatientsHandler,
  patientHistoryHandler,
  searchPatientsHandler,
  uploadPatientDocumentHandler,
  updatePatientHandler
} from "./patients.controller.js";

const patientsRouter = Router();
const patientReadRoles = ["admin", "reception", "doctor", "pharmacy", "lab", "therapist", "nursing", "housekeeping", "accounts", "hr"];
const patientWriteRoles = ["admin", "reception"];
const patientDeleteRoles = ["admin", "hr", "reception"];
const patientDocumentRoles = ["admin", "doctor", "reception"];

patientsRouter.get("/", authorize(patientReadRoles), listPatientsHandler);
patientsRouter.post("/", authorizeRolesOnly(patientWriteRoles), createPatientHandler);
patientsRouter.get("/search", authorize(patientReadRoles), searchPatientsHandler);
patientsRouter.get("/:id", authorize(patientReadRoles), getPatientHandler);
patientsRouter.put("/:id", authorizeRolesOnly(patientWriteRoles), updatePatientHandler);
patientsRouter.delete("/:id", authorizeRolesOnly(patientDeleteRoles), deletePatientHandler);
patientsRouter.get("/:id/history", authorize(patientReadRoles), patientHistoryHandler);
patientsRouter.get("/:id/documents", authorize(patientReadRoles), listPatientDocumentsHandler);
patientsRouter.post("/:id/documents", authorizeRolesOnly(patientDocumentRoles), uploadPatientDocumentHandler);
patientsRouter.get("/:id/documents/:documentId/download", authorize(patientReadRoles), downloadPatientDocumentHandler);
patientsRouter.delete("/:id/documents/:documentId", authorizeRolesOnly(patientWriteRoles), deletePatientDocumentHandler);

export { patientsRouter };
