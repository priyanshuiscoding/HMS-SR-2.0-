import {
  assignShift,
  createDocument,
  createLeave,
  createShift,
  getAttendance,
  getDocuments,
  getHrEmployees,
  getHrOverview,
  getLeaves,
  getPayroll,
  getShifts,
  saveAttendance,
  saveAttendanceBulk,
  saveEmployeeProfile,
  savePayroll,
  updateLeaveStatus
} from "./hr.service.js";

export async function hrOverviewHandler(req, res, next) {
  try {
    res.json(await getHrOverview(req.query.date));
  } catch (error) {
    next(error);
  }
}

export async function hrEmployeesHandler(req, res, next) {
  try {
    res.json({ items: await getHrEmployees(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function saveEmployeeProfileHandler(req, res, next) {
  try {
    const employee = await saveEmployeeProfile(req.body);
    res.status(201).json({ employee, message: "Employee HR profile saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function attendanceHandler(req, res, next) {
  try {
    res.json({ items: await getAttendance(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function saveAttendanceHandler(req, res, next) {
  try {
    const item = await saveAttendance(req.body, req.user.sub);
    res.status(201).json({ item, message: "Attendance saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function saveAttendanceBulkHandler(req, res, next) {
  try {
    const items = await saveAttendanceBulk(req.body, req.user.sub);
    res.status(201).json({ items, message: "Attendance sheet saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function shiftsHandler(_req, res, next) {
  try {
    res.json(await getShifts());
  } catch (error) {
    next(error);
  }
}

export async function createShiftHandler(req, res, next) {
  try {
    const shift = await createShift(req.body);
    res.status(201).json({ shift, message: "Shift created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function assignShiftHandler(req, res, next) {
  try {
    const assignment = await assignShift(req.body, req.user.sub);
    res.status(201).json({ assignment, message: "Shift assigned successfully." });
  } catch (error) {
    next(error);
  }
}

export async function leavesHandler(req, res, next) {
  try {
    res.json({ items: await getLeaves(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveHandler(req, res, next) {
  try {
    const leave = await createLeave(req.body, req.user.sub);
    res.status(201).json({ leave, message: "Leave request saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function updateLeaveStatusHandler(req, res, next) {
  try {
    const leave = await updateLeaveStatus(req.params.id, req.body, req.user.sub);
    res.json({ leave, message: "Leave request updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function payrollHandler(req, res, next) {
  try {
    res.json({ items: await getPayroll(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function savePayrollHandler(req, res, next) {
  try {
    const payroll = await savePayroll(req.body, req.user.sub);
    res.status(201).json({ payroll, message: "Payroll record saved successfully." });
  } catch (error) {
    next(error);
  }
}

export async function documentsHandler(req, res, next) {
  try {
    res.json({ items: await getDocuments(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createDocumentHandler(req, res, next) {
  try {
    const document = await createDocument(req.body, req.user.sub);
    res.status(201).json({ document, message: "Employee document saved successfully." });
  } catch (error) {
    next(error);
  }
}
