import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  assignShiftHandler,
  attendanceHandler,
  createDocumentHandler,
  createLeaveHandler,
  createShiftHandler,
  documentsHandler,
  hrEmployeesHandler,
  hrOverviewHandler,
  leavesHandler,
  payrollHandler,
  saveAttendanceBulkHandler,
  saveAttendanceHandler,
  saveEmployeeProfileHandler,
  savePayrollHandler,
  shiftsHandler,
  updateLeaveStatusHandler
} from "./hr.controller.js";

const hrRouter = Router();
const hrRoles = ["admin", "hr"];

hrRouter.get("/overview", authorize(hrRoles), hrOverviewHandler);
hrRouter.get("/employees", authorize(hrRoles), hrEmployeesHandler);
hrRouter.post("/employees/profile", authorize(hrRoles), saveEmployeeProfileHandler);
hrRouter.get("/attendance", authorize(hrRoles), attendanceHandler);
hrRouter.post("/attendance", authorize(hrRoles), saveAttendanceHandler);
hrRouter.post("/attendance/bulk", authorize(hrRoles), saveAttendanceBulkHandler);
hrRouter.get("/shifts", authorize(hrRoles), shiftsHandler);
hrRouter.post("/shifts", authorize(hrRoles), createShiftHandler);
hrRouter.post("/shifts/assign", authorize(hrRoles), assignShiftHandler);
hrRouter.get("/leaves", authorize(hrRoles), leavesHandler);
hrRouter.post("/leaves", authorize(hrRoles), createLeaveHandler);
hrRouter.put("/leaves/:id/status", authorize(hrRoles), updateLeaveStatusHandler);
hrRouter.get("/payroll", authorize(hrRoles), payrollHandler);
hrRouter.post("/payroll", authorize(hrRoles), savePayrollHandler);
hrRouter.get("/documents", authorize(hrRoles), documentsHandler);
hrRouter.post("/documents", authorize(hrRoles), createDocumentHandler);

export { hrRouter };
