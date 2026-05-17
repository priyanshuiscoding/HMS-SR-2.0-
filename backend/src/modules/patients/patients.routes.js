import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  createPatientHandler,
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
const patientDocumentRoles = ["admin", "doctor", "reception"];

patientsRouter.get("/", authorize(patientReadRoles), listPatientsHandler);
patientsRouter.post("/", authorize(patientWriteRoles), createPatientHandler);
patientsRouter.get("/search", authorize(patientReadRoles), searchPatientsHandler);
patientsRouter.get("/:id", authorize(patientReadRoles), getPatientHandler);
patientsRouter.put("/:id", authorize(patientWriteRoles), updatePatientHandler);
patientsRouter.get("/:id/history", authorize(patientReadRoles), patientHistoryHandler);
patientsRouter.get("/:id/documents", authorize(patientReadRoles), listPatientDocumentsHandler);
patientsRouter.post("/:id/documents", authorize(patientDocumentRoles), uploadPatientDocumentHandler);
patientsRouter.get("/:id/documents/:documentId/download", authorize(patientReadRoles), downloadPatientDocumentHandler);
patientsRouter.delete("/:id/documents/:documentId", authorize(patientWriteRoles), deletePatientDocumentHandler);

export { patientsRouter };
