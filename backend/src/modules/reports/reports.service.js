import { todayDate } from "../../utils/dateTime.js";
import {
  getDailyOpdReadModel,
  getDashboardSummaryReadModel,
  getIpdCensusReadModel,
  getLabWorkloadReadModel,
  listDailyHospitalReportRecords,
  getOverviewReadModel,
  getPanchkarmaStatsReadModel,
  getPharmacySalesReadModel,
  getRevenueReadModel,
  upsertDailyHospitalReportRecord
} from "./reports.repository.js";

const dashboardFinancialRoles = new Set(["admin", "hr", "reception"]);

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

export function buildDashboardSummaryResponse(reportDate, summary, user = {}) {
  const canViewFinancials = dashboardFinancialRoles.has(user.role);

  return {
    date: reportDate,
    updatedAt: summary.capturedAt,
    opdPatients: summary.opdPatients,
    ipdPatients: summary.ipdPatients,
    newRegistrations: summary.newRegistrations,
    followUpPatients: summary.followUpPatients,
    todaysAppointments: summary.todaysAppointments,
    dischargedPatients: summary.dischargedPatients,
    emergencyCases: summary.emergencyCases,
    permissions: {
      financials: canViewFinancials
    },
    ...(canViewFinancials
      ? {
          revenueToday: summary.revenueToday,
          collectedToday: summary.collectedToday,
          pendingPayments: summary.pendingPayments,
          collectionByMode: summary.collectionByMode
        }
      : {})
  };
}

export async function getDashboardSummary(query = {}, user = {}) {
  const reportDate = query.date || todayDate();
  const summary = await getDashboardSummaryReadModel(reportDate);
  return buildDashboardSummaryResponse(reportDate, summary, user);
}

export async function getDailyHospitalReports(query = {}) {
  await upsertDailyHospitalReportRecord(todayDate());
  return {
    items: await listDailyHospitalReportRecords({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      limit: query.limit
    })
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
