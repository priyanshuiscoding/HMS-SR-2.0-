import {
  createPatient,
  deletePatient,
  deletePatientDocument,
  getPatientDocumentFile,
  getPatientById,
  getPatientHistory,
  listDeletedPatients,
  listPatientDocuments,
  listPatients,
  uploadPatientDocument,
  updatePatient,
  restorePatient
} from "./patients.service.js";
import { paginationMeta, parsePagination } from "../../utils/pagination.js";

function canDeletePatient(user = {}) {
  return user.role === "admin" || user.role === "hr";
}

export async function listPatientsHandler(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const result = await listPatients({ ...req.query, ...pagination });
    res.json({ items: result.items, meta: paginationMeta(result.total, pagination.page, pagination.pageSize) });
  } catch (error) {
    next(error);
  }
}

export async function getPatientHandler(req, res, next) {
  try {
    res.json({ item: await getPatientById(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function searchPatientsHandler(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const result = await listPatients({ search: req.query.q || req.query.search || "", ...pagination });
    res.json({ items: result.items, meta: paginationMeta(result.total, pagination.page, pagination.pageSize) });
  } catch (error) {
    next(error);
  }
}

export async function createPatientHandler(req, res, next) {
  try {
    const patient = await createPatient(req.body, req.user.sub);
    res.status(201).json({ item: patient, message: "Patient registered successfully." });
  } catch (error) {
    next(error);
  }
}

export async function updatePatientHandler(req, res, next) {
  try {
    res.json({ item: await updatePatient(req.params.id, req.body), message: "Patient updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function deletePatientHandler(req, res, next) {
  try {
    if (!canDeletePatient(req.user)) {
      return res.status(403).json({ message: "Only admin and HR can archive patients." });
    }

    res.json({ item: await deletePatient(req.params.id, req.user.sub, req.body?.reason), message: "Patient moved to the recycle bin." });
  } catch (error) {
    next(error);
  }
}

export async function recycleBinHandler(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    const result = await listDeletedPatients({ ...req.query, ...pagination });
    res.json({ items: result.items, meta: paginationMeta(result.total, pagination.page, pagination.pageSize) });
  } catch (error) {
    next(error);
  }
}

export async function restorePatientHandler(req, res, next) {
  try {
    res.json({ item: await restorePatient(req.params.id), message: "Patient restored successfully." });
  } catch (error) {
    next(error);
  }
}

export async function patientHistoryHandler(req, res, next) {
  try {
    res.json(await getPatientHistory(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function listPatientDocumentsHandler(req, res, next) {
  try {
    res.json({ items: await listPatientDocuments(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function uploadPatientDocumentHandler(req, res, next) {
  try {
    const document = await uploadPatientDocument(req.params.id, req.body, req.user.sub);
    res.status(201).json({ item: document, message: "Patient document uploaded successfully." });
  } catch (error) {
    next(error);
  }
}

export async function downloadPatientDocumentHandler(req, res, next) {
  try {
    const document = await getPatientDocumentFile(req.params.id, req.params.documentId);
    const safeFileName = document.fileName.replace(/[^\w.\- ]/g, "").trim() || "patient-document.pdf";
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Length", document.fileSize);
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
    res.send(document.fileData);
  } catch (error) {
    next(error);
  }
}

export async function deletePatientDocumentHandler(req, res, next) {
  try {
    res.json({ item: await deletePatientDocument(req.params.id, req.params.documentId), message: "Patient document removed successfully." });
  } catch (error) {
    next(error);
  }
}
