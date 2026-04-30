import {
  createPatient,
  getPatientById,
  getPatientHistory,
  listPatients,
  updatePatient
} from "./patients.service.js";

export async function listPatientsHandler(req, res, next) {
  try {
    res.json({ items: await listPatients(req.query) });
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
    res.json({ items: await listPatients({ search: req.query.q || req.query.search || "" }) });
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

export async function patientHistoryHandler(req, res, next) {
  try {
    res.json(await getPatientHistory(req.params.id));
  } catch (error) {
    next(error);
  }
}
