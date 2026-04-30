import {
  getDailyOpdReport,
  getIpdCensusReport,
  getLabWorkloadReport,
  getPharmacySalesReport,
  getPanchkarmaStatsReport,
  getReportsOverview,
  getRevenueReport
} from "./reports.service.js";

export async function reportsOverviewHandler(req, res, next) {
  try {
    res.json(await getReportsOverview(req.query));
  } catch (error) {
    next(error);
  }
}

export async function dailyOpdReportHandler(req, res, next) {
  try {
    res.json(await getDailyOpdReport(req.query));
  } catch (error) {
    next(error);
  }
}

export async function ipdCensusReportHandler(req, res, next) {
  try {
    res.json(await getIpdCensusReport(req.query));
  } catch (error) {
    next(error);
  }
}

export async function revenueReportHandler(req, res, next) {
  try {
    res.json(await getRevenueReport(req.query));
  } catch (error) {
    next(error);
  }
}

export async function pharmacySalesReportHandler(req, res, next) {
  try {
    res.json(await getPharmacySalesReport(req.query));
  } catch (error) {
    next(error);
  }
}

export async function labWorkloadReportHandler(req, res, next) {
  try {
    res.json(await getLabWorkloadReport(req.query));
  } catch (error) {
    next(error);
  }
}

export async function panchkarmaStatsReportHandler(req, res, next) {
  try {
    res.json(await getPanchkarmaStatsReport(req.query));
  } catch (error) {
    next(error);
  }
}
