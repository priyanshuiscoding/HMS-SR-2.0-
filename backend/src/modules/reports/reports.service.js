import { todayDate } from "../../utils/dateTime.js";
import {
  getDailyOpdReadModel,
  getDashboardSummaryReadModel,
  getIpdCensusReadModel,
  getLabWorkloadReadModel,
  getOverviewReadModel,
  getPanchkarmaStatsReadModel,
  getPharmacySalesReadModel,
  getRevenueReadModel
} from "./reports.repository.js";

function getDateRange(query = {}) {
  const today = todayDate();
  return {
    dateFrom: query.dateFrom || query.date || today,
    dateTo: query.dateTo || query.date || today
  };
}

export async function getReportsOverview(query = {}) {
  const range = getDateRange(query);
  const overview = await getOverviewReadModel(range);

  return {
    ...range,
    ...overview
  };
}

export async function getDashboardSummary(query = {}) {
  const reportDate = query.date || todayDate();
  const summary = await getDashboardSummaryReadModel(reportDate);

  return {
    date: reportDate,
    ...summary
  };
}

export async function getDailyOpdReport(query = {}) {
  const reportDate = query.date || todayDate();
  const report = await getDailyOpdReadModel(reportDate);

  return {
    date: reportDate,
    ...report
  };
}

export async function getIpdCensusReport(query = {}) {
  const reportDate = query.date || todayDate();
  const report = await getIpdCensusReadModel(reportDate);

  return {
    date: reportDate,
    ...report
  };
}

export async function getRevenueReport(query = {}) {
  const range = getDateRange(query);
  const report = await getRevenueReadModel(range);

  return {
    ...range,
    ...report
  };
}

export async function getPharmacySalesReport(query = {}) {
  const range = getDateRange(query);
  const report = await getPharmacySalesReadModel(range);

  return {
    ...range,
    ...report
  };
}

export async function getLabWorkloadReport(query = {}) {
  const range = getDateRange(query);
  const report = await getLabWorkloadReadModel(range);

  return {
    ...range,
    ...report
  };
}

export async function getPanchkarmaStatsReport(query = {}) {
  const range = getDateRange(query);
  const report = await getPanchkarmaStatsReadModel(range);

  return {
    ...range,
    ...report
  };
}
