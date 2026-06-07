import {
  collectLabSample,
  createLabBill,
  createLabOrder,
  getLabMasters,
  getLabOrderDetails,
  getLabSummary,
  listLabOrders,
  saveLabResults,
  updateLabOrderWorkflowStatus
} from "./laboratory.service.js";

export async function mastersHandler(_req, res, next) {
  try {
    res.json(await getLabMasters());
  } catch (error) {
    next(error);
  }
}

export async function listOrdersHandler(req, res, next) {
  try {
    res.json({ items: await listLabOrders(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function summaryHandler(_req, res, next) {
  try {
    res.json(await getLabSummary());
  } catch (error) {
    next(error);
  }
}

export async function orderDetailsHandler(req, res, next) {
  try {
    res.json(await getLabOrderDetails(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function createOrderHandler(req, res, next) {
  try {
    res.status(201).json({ item: await createLabOrder(req.body), message: "Lab order created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function collectSampleHandler(req, res, next) {
  try {
    res.json({ item: await collectLabSample(req.params.id, req.body, req.user.sub), message: "Sample collected successfully." });
  } catch (error) {
    next(error);
  }
}

export async function saveResultsHandler(req, res, next) {
  try {
    res.json({ item: await saveLabResults(req.params.id, req.body, req.user.sub), message: "Lab results saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function createBillHandler(req, res, next) {
  try {
    res.json({ item: await createLabBill(req.params.id, req.body, req.user.sub), message: "Lab bill created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function labWorkflowActionHandler(req, res, next) {
  try {
    res.json({ item: await updateLabOrderWorkflowStatus(req.params.id, req.body, req.user), message: "Lab workflow action saved successfully." });
  } catch (error) {
    next(error);
  }
}
