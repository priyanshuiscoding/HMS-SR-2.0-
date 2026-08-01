import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
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
hrRouter.post("/employees/profile", authorizeRolesOnly(hrRoles), saveEmployeeProfileHandler);
hrRouter.get("/attendance", authorize(hrRoles), attendanceHandler);
hrRouter.post("/attendance", authorizeRolesOnly(hrRoles), saveAttendanceHandler);
hrRouter.post("/attendance/bulk", authorizeRolesOnly(hrRoles), saveAttendanceBulkHandler);
hrRouter.get("/shifts", authorize(hrRoles), shiftsHandler);
hrRouter.post("/shifts", authorizeRolesOnly(hrRoles), createShiftHandler);
hrRouter.post("/shifts/assign", authorizeRolesOnly(hrRoles), assignShiftHandler);
hrRouter.get("/leaves", authorize(hrRoles), leavesHandler);
hrRouter.post("/leaves", authorizeRolesOnly(hrRoles), createLeaveHandler);
hrRouter.put("/leaves/:id/status", authorizeRolesOnly(hrRoles), updateLeaveStatusHandler);
hrRouter.get("/payroll", authorize(hrRoles), payrollHandler);
hrRouter.post("/payroll", authorizeRolesOnly(hrRoles), savePayrollHandler);
hrRouter.get("/documents", authorize(hrRoles), documentsHandler);
hrRouter.post("/documents", authorizeRolesOnly(hrRoles), createDocumentHandler);

export { hrRouter };
