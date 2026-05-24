import { createId } from "../../data/store.js";
import { todayDate } from "../../utils/dateTime.js";
import { createError } from "../../utils/errors.js";
import {
  assignShiftRecord,
  attendanceForDate,
  bulkUpsertAttendanceRecords,
  createDocumentRecord,
  createLeaveRecord,
  createShiftRecord,
  getHrSummaryRecord,
  listAttendanceRecords,
  listDocumentRecords,
  listHrEmployees,
  listLeaveRecords,
  listPayrollRecords,
  listShiftAssignmentRecords,
  listShiftRecords,
  updateLeaveStatusRecord,
  upsertAttendanceRecord,
  upsertEmployeeProfileRecord,
  upsertPayrollRecord
} from "./hr.repository.js";

const attendanceStatuses = ["present", "absent", "leave", "half_day", "holiday"];
const leaveTypes = ["sick", "casual", "earned", "unpaid", "maternity", "paternity", "other"];
const leaveStatuses = ["pending", "approved", "rejected", "cancelled"];
const payrollStatuses = ["draft", "processed", "paid", "withheld"];
const employmentTypes = ["full_time", "part_time", "contract", "consultant", "intern"];
const employmentStatuses = ["active", "probation", "on_notice", "inactive", "terminated"];

function clean(value) {
  return String(value || "").trim();
}

function requireField(payload, key, label) {
  if (!payload[key] || !clean(payload[key])) {
    throw createError(`${label} is required.`);
  }
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86400000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

export async function getHrOverview(date = todayDate()) {
  const [summary, employees, leaves, shifts, payroll, documents] = await Promise.all([
    getHrSummaryRecord(date),
    listHrEmployees({ date }),
    listLeaveRecords({}),
    listShiftRecords(),
    listPayrollRecords({ month: date.slice(0, 7) }),
    listDocumentRecords({})
  ]);

  return {
    summary,
    employees,
    leaves,
    shifts,
    payroll,
    documents
  };
}

export async function getHrEmployees(query = {}) {
  return listHrEmployees(query);
}

export async function saveEmployeeProfile(payload = {}) {
  requireField(payload, "userId", "Employee");
  const employmentType = payload.employmentType || "full_time";
  const employmentStatus = payload.employmentStatus || "active";
  if (!employmentTypes.includes(employmentType)) throw createError("Invalid employment type.");
  if (!employmentStatuses.includes(employmentStatus)) throw createError("Invalid employment status.");

  await upsertEmployeeProfileRecord({
    id: createId(),
    userId: payload.userId,
    joiningDate: payload.joiningDate || "",
    employmentType,
    employmentStatus,
    reportingManagerId: payload.reportingManagerId || "",
    emergencyContactName: clean(payload.emergencyContactName),
    emergencyContactPhone: clean(payload.emergencyContactPhone),
    salaryMonthly: Number(payload.salaryMonthly || 0),
    notes: clean(payload.notes)
  });

  const employees = await listHrEmployees({});
  return employees.find((employee) => employee.id === payload.userId) || null;
}

export async function getAttendance(query = {}) {
  if (query.date) {
    return attendanceForDate(query.date, query);
  }
  return listAttendanceRecords(query);
}

function normalizeAttendance(payload = {}, markedBy = "") {
  requireField(payload, "userId", "Employee");
  const status = payload.status || "present";
  if (!attendanceStatuses.includes(status)) {
    throw createError("Invalid attendance status.");
  }
  return {
    id: payload.id || createId(),
    userId: payload.userId,
    attendanceDate: payload.attendanceDate || todayDate(),
    status,
    checkInTime: payload.checkInTime || "",
    checkOutTime: payload.checkOutTime || "",
    lateMinutes: Number(payload.lateMinutes || 0),
    earlyExitMinutes: Number(payload.earlyExitMinutes || 0),
    markedBy,
    source: payload.source || "manual",
    notes: clean(payload.notes)
  };
}

export async function saveAttendance(payload = {}, markedBy = "") {
  return upsertAttendanceRecord(normalizeAttendance(payload, markedBy));
}

export async function saveAttendanceBulk(payload = {}, markedBy = "") {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw createError("At least one attendance entry is required.");
  }
  const items = payload.items.map((item) => normalizeAttendance(item, markedBy));
  return bulkUpsertAttendanceRecords(items);
}

export async function getShifts() {
  const [shifts, assignments] = await Promise.all([listShiftRecords(), listShiftAssignmentRecords()]);
  return { shifts, assignments };
}

export async function createShift(payload = {}) {
  requireField(payload, "shiftName", "Shift name");
  requireField(payload, "startTime", "Start time");
  requireField(payload, "endTime", "End time");
  return createShiftRecord({
    id: createId(),
    shiftName: clean(payload.shiftName),
    startTime: payload.startTime,
    endTime: payload.endTime,
    breakMinutes: Number(payload.breakMinutes || 0),
    graceMinutes: Number(payload.graceMinutes || 10),
    isNightShift: Boolean(payload.isNightShift)
  });
}

export async function assignShift(payload = {}, assignedBy = "") {
  requireField(payload, "userId", "Employee");
  requireField(payload, "shiftId", "Shift");
  return assignShiftRecord({
    id: createId(),
    userId: payload.userId,
    shiftId: payload.shiftId,
    effectiveFrom: payload.effectiveFrom || todayDate(),
    effectiveTo: payload.effectiveTo || "",
    weekOff: clean(payload.weekOff),
    assignedBy
  });
}

export async function getLeaves(query = {}) {
  return listLeaveRecords(query);
}

export async function createLeave(payload = {}, createdBy = "") {
  requireField(payload, "userId", "Employee");
  const leaveType = payload.leaveType || "casual";
  if (!leaveTypes.includes(leaveType)) throw createError("Invalid leave type.");
  requireField(payload, "startDate", "Start date");
  requireField(payload, "endDate", "End date");
  const start = payload.startDate;
  const end = payload.endDate;
  const totalDays = Number(payload.totalDays || daysBetween(start, end));
  return createLeaveRecord({
    id: createId(),
    userId: payload.userId,
    leaveType,
    startDate: start,
    endDate: end,
    totalDays,
    status: payload.status || "pending",
    reason: clean(payload.reason),
    createdBy
  });
}

export async function updateLeaveStatus(id, payload = {}, reviewedBy = "") {
  const status = payload.status || "";
  if (!leaveStatuses.includes(status)) throw createError("Invalid leave status.");
  return updateLeaveStatusRecord(id, {
    status,
    reviewedBy,
    reviewNote: clean(payload.reviewNote)
  });
}

export async function getPayroll(query = {}) {
  return listPayrollRecords(query);
}

export async function savePayroll(payload = {}, createdBy = "") {
  requireField(payload, "userId", "Employee");
  requireField(payload, "payrollMonth", "Payroll month");
  const paymentStatus = payload.paymentStatus || "draft";
  if (!payrollStatuses.includes(paymentStatus)) throw createError("Invalid payroll status.");
  const basicSalary = Number(payload.basicSalary || 0);
  const allowances = Number(payload.allowances || 0);
  const deductions = Number(payload.deductions || 0);
  return upsertPayrollRecord({
    id: createId(),
    userId: payload.userId,
    payrollMonth: payload.payrollMonth.length === 7 ? `${payload.payrollMonth}-01` : payload.payrollMonth,
    basicSalary,
    allowances,
    deductions,
    netSalary: basicSalary + allowances - deductions,
    paymentStatus,
    paidOn: payload.paidOn || "",
    notes: clean(payload.notes),
    createdBy
  });
}

export async function getDocuments(query = {}) {
  return listDocumentRecords(query);
}

export async function createDocument(payload = {}, uploadedBy = "") {
  requireField(payload, "userId", "Employee");
  requireField(payload, "documentName", "Document name");
  return createDocumentRecord({
    id: createId(),
    userId: payload.userId,
    documentType: payload.documentType || "other",
    documentName: clean(payload.documentName),
    documentNumber: clean(payload.documentNumber),
    issueDate: payload.issueDate || "",
    expiryDate: payload.expiryDate || "",
    fileUrl: clean(payload.fileUrl),
    status: payload.status || "active",
    notes: clean(payload.notes),
    uploadedBy
  });
}
