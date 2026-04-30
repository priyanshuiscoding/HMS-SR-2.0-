import {
  addAdmissionNote,
  addAdmissionVitals,
  admitPatient,
  dischargeAdmission,
  getAdmissionDetails,
  getAdmissionNotes,
  getAdmissionVitals,
  getIpdCensus,
  getIpdMasters,
  getIpdSummary,
  listAdmissions,
  updateAdmission
} from "./ipd.service.js";

export async function ipdMastersHandler(_req, res, next) {
  try {
    res.json(await getIpdMasters());
  } catch (error) {
    next(error);
  }
}

export async function ipdSummaryHandler(_req, res, next) {
  try {
    res.json(await getIpdSummary());
  } catch (error) {
    next(error);
  }
}

export async function listAdmissionsHandler(req, res, next) {
  try {
    res.json({ items: await listAdmissions(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function admissionDetailsHandler(req, res, next) {
  try {
    res.json(await getAdmissionDetails(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function admissionNotesHandler(req, res, next) {
  try {
    res.json(await getAdmissionNotes(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function admissionVitalsHandler(req, res, next) {
  try {
    res.json(await getAdmissionVitals(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function admitPatientHandler(req, res, next) {
  try {
    res.status(201).json({ item: await admitPatient(req.body, req.user.sub), message: "Patient admitted successfully." });
  } catch (error) {
    next(error);
  }
}

export async function addAdmissionNoteHandler(req, res, next) {
  try {
    res.status(201).json({ item: await addAdmissionNote(req.params.id, req.body, req.user.sub), message: "Clinical note added successfully." });
  } catch (error) {
    next(error);
  }
}

export async function addAdmissionVitalsHandler(req, res, next) {
  try {
    res.status(201).json({ item: await addAdmissionVitals(req.params.id, req.body, req.user.sub), message: "Vitals recorded successfully." });
  } catch (error) {
    next(error);
  }
}

export async function updateAdmissionHandler(req, res, next) {
  try {
    res.json({ item: await updateAdmission(req.params.id, req.body, req.user.sub), message: "Admission updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function dischargeAdmissionHandler(req, res, next) {
  try {
    res.json({ item: await dischargeAdmission(req.params.id, req.body, req.user.sub), message: "Patient discharged successfully." });
  } catch (error) {
    next(error);
  }
}

export async function ipdCensusHandler(_req, res, next) {
  try {
    res.json(await getIpdCensus());
  } catch (error) {
    next(error);
  }
}
