import {
  completeVisit,
  createVisitLabOrder,
  createVisit,
  getOpdMasters,
  getQueue,
  getVisitDetails,
  referVisitToIpd,
  saveAssessment,
  saveDischargeSummary,
  savePrescription,
  saveVitals,
  updateVisitWorkflowStatus
} from "./opd.service.js";

export async function queueHandler(req, res, next) {
  try {
    res.json({ items: await getQueue(req.query.date, req.query.doctorId) });
  } catch (error) {
    next(error);
  }
}

export async function createVisitHandler(req, res, next) {
  try {
    res.status(201).json({ item: await createVisit(req.body, req.user), message: "OPD visit created and forwarded to screening." });
  } catch (error) {
    next(error);
  }
}

export async function visitDetailsHandler(req, res, next) {
  try {
    res.json(await getVisitDetails(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function vitalsHandler(req, res, next) {
  try {
    res.json({ item: await saveVitals(req.params.id, req.body, req.user), message: "Screening saved and forwarded to doctor." });
  } catch (error) {
    next(error);
  }
}

export async function assessmentSaveHandler(req, res, next) {
  try {
    res.json({
      item: await saveAssessment(req.params.id, req.body, req.user.sub),
      message: "Ayurvedic assessment saved successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function prescriptionSaveHandler(req, res, next) {
  try {
    res.json({
      item: await savePrescription(req.params.id, req.body, req.user.sub),
      message: "Prescription saved successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function dischargeSummarySaveHandler(req, res, next) {
  try {
    res.json({
      item: await saveDischargeSummary(req.params.id, req.body, req.user.sub),
      message: "Discharge summary saved and forwarded successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function completeVisitHandler(req, res, next) {
  try {
    res.json({ item: await completeVisit(req.params.id, req.user), message: "Consultation completed successfully." });
  } catch (error) {
    next(error);
  }
}

export async function visitWorkflowActionHandler(req, res, next) {
  try {
    res.json({ item: await updateVisitWorkflowStatus(req.params.id, req.body, req.user), message: "OPD workflow action saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function createVisitLabOrderHandler(req, res, next) {
  try {
    res.status(201).json({
      item: await createVisitLabOrder(req.params.id, req.body, req.user.sub),
      message: "Lab order created from OPD visit successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function referVisitToIpdHandler(req, res, next) {
  try {
    res.status(201).json({
      item: await referVisitToIpd(req.params.id, req.body, req.user.sub),
      message: "Patient referred to IPD successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function mastersHandler(_req, res, next) {
  try {
    res.json(await getOpdMasters());
  } catch (error) {
    next(error);
  }
}
