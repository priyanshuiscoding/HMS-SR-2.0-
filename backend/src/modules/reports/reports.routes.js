import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  dailyOpdReportHandler,
  dashboardSummaryHandler,
  ipdCensusReportHandler,
  labWorkloadReportHandler,
  panchkarmaStatsReportHandler,
  pharmacySalesReportHandler,
  reportsOverviewHandler,
  revenueReportHandler
} from "./reports.controller.js";

const reportsRouter = Router();

reportsRouter.get("/dashboard-summary", authorize(["admin"]), dashboardSummaryHandler);
reportsRouter.get("/overview", authorize(["admin", "doctor", "accounts"]), reportsOverviewHandler);
reportsRouter.get("/daily-opd", authorize(["admin", "doctor", "reception"]), dailyOpdReportHandler);
reportsRouter.get("/ipd-census", authorize(["admin", "doctor", "accounts", "nursing", "reception"]), ipdCensusReportHandler);
reportsRouter.get("/revenue", authorize(["admin", "accounts", "doctor"]), revenueReportHandler);
reportsRouter.get("/pharmacy-sales", authorize(["admin", "accounts", "pharmacy", "doctor"]), pharmacySalesReportHandler);
reportsRouter.get("/lab-workload", authorize(["admin", "lab", "doctor", "accounts"]), labWorkloadReportHandler);
reportsRouter.get("/panchkarma-stats", authorize(["admin", "doctor", "accounts", "therapist"]), panchkarmaStatsReportHandler);

export { reportsRouter };
