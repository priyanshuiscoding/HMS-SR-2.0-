import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  createCertificateHandler,
  getCertificateHandler,
  listCertificatesHandler
} from "./certificates.controller.js";

const certificatesRouter = Router();
const readRoles = ["admin", "doctor", "reception", "nursing", "accounts"];
const writeRoles = ["admin", "doctor"];

certificatesRouter.get("/", authorize(readRoles), listCertificatesHandler);
certificatesRouter.post("/", authorize(writeRoles), createCertificateHandler);
certificatesRouter.get("/:id", authorize(readRoles), getCertificateHandler);

export { certificatesRouter };
