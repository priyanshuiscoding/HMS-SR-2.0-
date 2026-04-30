import {
  completeVisit,
  createVisitLabOrder,
  createVisit,
  getOpdMasters,
  getQueue,
  getVisitDetails,
  referVisitToIpd,
  saveAssessment,
  savePrescription,
  saveVitals
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
    res.status(201).json({ item: await createVisit(req.body), message: "OPD visit created successfully." });
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
    res.json({ item: await saveVitals(req.params.id, req.body), message: "Vitals updated successfully." });
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

export async function completeVisitHandler(req, res, next) {
  try {
    res.json({ item: await completeVisit(req.params.id), message: "Consultation completed successfully." });
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
