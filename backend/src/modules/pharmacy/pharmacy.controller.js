import {
  dispensePrescription,
  getExpiringStock,
  getPharmacyAlerts,
  getLowStockMedicines,
  getPharmacyMasters,
  getPharmacyStock,
  listDispensations,
  listPrescriptionQueue
} from "./pharmacy.service.js";

export async function pharmacyMastersHandler(_req, res, next) {
  try {
    res.json(await getPharmacyMasters());
  } catch (error) {
    next(error);
  }
}

export async function pharmacyStockHandler(_req, res, next) {
  try {
    const items = await getPharmacyStock();
    res.json({ items, alerts: await getPharmacyAlerts(items) });
  } catch (error) {
    next(error);
  }
}

export async function lowStockHandler(_req, res, next) {
  try {
    res.json({ items: await getLowStockMedicines() });
  } catch (error) {
    next(error);
  }
}

export async function expiryStockHandler(req, res, next) {
  try {
    res.json({ items: await getExpiringStock(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function prescriptionQueueHandler(req, res, next) {
  try {
    res.json({ items: await listPrescriptionQueue(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function dispensationsHandler(req, res, next) {
  try {
    res.json({ items: await listDispensations(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function dispenseHandler(req, res, next) {
  try {
    const item = await dispensePrescription(req.params.prescriptionId, req.body, req.user.sub);
    res.status(201).json({ item, message: "Prescription dispensed successfully." });
  } catch (error) {
    next(error);
  }
}
