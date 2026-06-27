import {
  completePanchkarmaSession,
  createPanchkarmaSchedule,
  getPanchkarmaMasters,
  getPanchkarmaScheduleDetails,
  listPanchkarmaRecommendations,
  getPanchkarmaSummary,
  getPanchkarmaTherapies,
  listPanchkarmaSchedules,
  startPanchkarmaSession,
  updatePanchkarmaWorkflowStatus
} from "./panchkarma.service.js";

export async function panchkarmaTherapiesHandler(_req, res, next) {
  try {
    res.json({ items: await getPanchkarmaTherapies() });
  } catch (error) {
    next(error);
  }
}

export async function panchkarmaMastersHandler(_req, res, next) {
  try {
    res.json(await getPanchkarmaMasters());
  } catch (error) {
    next(error);
  }
}

export async function panchkarmaSummaryHandler(_req, res, next) {
  try {
    res.json(await getPanchkarmaSummary());
  } catch (error) {
    next(error);
  }
}

export async function listPanchkarmaSchedulesHandler(req, res, next) {
  try {
    res.json({ items: await listPanchkarmaSchedules(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function listPanchkarmaRecommendationsHandler(req, res, next) {
  try {
    res.json({ items: await listPanchkarmaRecommendations(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function panchkarmaScheduleDetailsHandler(req, res, next) {
  try {
    res.json(await getPanchkarmaScheduleDetails(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function createPanchkarmaScheduleHandler(req, res, next) {
  try {
    res.status(201).json({
      item: await createPanchkarmaSchedule(req.body, req.user.sub),
      message: "Panchkarma session scheduled successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function startPanchkarmaSessionHandler(req, res, next) {
  try {
    res.json({
      item: await startPanchkarmaSession(req.params.id, req.body, req.user.sub),
      message: "Panchkarma session started successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function completePanchkarmaSessionHandler(req, res, next) {
  try {
    res.json({
      item: await completePanchkarmaSession(req.params.id, req.body, req.user.sub),
      message: "Panchkarma session completed successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function panchkarmaWorkflowActionHandler(req, res, next) {
  try {
    res.json({
      item: await updatePanchkarmaWorkflowStatus(req.params.id, req.body, req.user),
      message: "Panchkarma workflow action saved successfully."
    });
  } catch (error) {
    next(error);
  }
}
