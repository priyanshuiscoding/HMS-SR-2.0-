import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime, toTime } from "../../utils/dateTime.js";

function toNumber(value) {
  return Number(value || 0);
}

function toEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    department: row.department || "",
    designation: row.designation || "",
    isActive: row.is_active,
    joiningDate: toIsoDate(row.joining_date),
    employmentType: row.employment_type || "full_time",
    employmentStatus: row.employment_status || "active",
    reportingManagerId: row.reporting_manager_id || "",
    emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "",
    salaryMonthly: toNumber(row.salary_monthly),
    notes: row.profile_notes || "",
    workSchedules: row.work_schedules || [],
    shiftAssignments: row.shift_assignments || [],
    attendanceStatus: row.attendance_status || "",
    checkInTime: toTime(row.check_in_time),
    checkOutTime: toTime(row.check_out_time),
    metadata: row.metadata || {}
  };
}

function toAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id || "",
    fullName: row.full_name || "",
    department: row.department || "",
    designation: row.designation || "",
    attendanceDate: toIsoDate(row.attendance_date),
    status: row.status || "absent",
    checkInTime: toTime(row.check_in_time),
    checkOutTime: toTime(row.check_out_time),
    lateMinutes: toNumber(row.late_minutes),
    earlyExitMinutes: toNumber(row.early_exit_minutes),
    source: row.source || "manual",
    notes: row.notes || "",
    markedBy: row.marked_by || "",
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at)
  };
}

function toShift(row) {
  if (!row) return null;
  return {
    id: row.id,
    shiftName: row.shift_name,
    startTime: toTime(row.start_time),
    endTime: toTime(row.end_time),
    breakMinutes: toNumber(row.break_minutes),
    graceMinutes: toNumber(row.grace_minutes),
    isNightShift: Boolean(row.is_night_shift),
    isActive: row.is_active !== false,
    assignedEmployees: toNumber(row.assigned_employees),
    createdAt: toIsoDateTime(row.created_at)
  };
}

function toShiftAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id || "",
    fullName: row.full_name || "",
    department: row.department || "",
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    startTime: toTime(row.start_time),
    endTime: toTime(row.end_time),
    effectiveFrom: toIsoDate(row.effective_from),
    effectiveTo: toIsoDate(row.effective_to),
    weekOff: row.week_off || "",
    isActive: row.is_active !== false
  };
}

function toLeave(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id || "",
    fullName: row.full_name || "",
    department: row.department || "",
    leaveType: row.leave_type,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    totalDays: toNumber(row.total_days),
    status: row.status,
    reason: row.reason || "",
    reviewedBy: row.reviewed_by || "",
    reviewedAt: toIsoDateTime(row.reviewed_at),
    reviewNote: row.review_note || "",
    createdAt: toIsoDateTime(row.created_at)
  };
}

function toPayroll(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id || "",
    fullName: row.full_name || "",
    department: row.department || "",
    payrollMonth: toIsoDate(row.payroll_month),
    basicSalary: toNumber(row.basic_salary),
    allowances: toNumber(row.allowances),
    deductions: toNumber(row.deductions),
    netSalary: toNumber(row.net_salary),
    paymentStatus: row.payment_status,
    paidOn: toIsoDate(row.paid_on),
    notes: row.notes || "",
    createdAt: toIsoDateTime(row.created_at)
  };
}

function toDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id || "",
    fullName: row.full_name || "",
    documentType: row.document_type,
    documentName: row.document_name,
    documentNumber: row.document_number || "",
    issueDate: toIsoDate(row.issue_date),
    expiryDate: toIsoDate(row.expiry_date),
    fileUrl: row.file_url || "",
    status: row.status,
    notes: row.notes || "",
    createdAt: toIsoDateTime(row.created_at)
  };
}

export async function listHrEmployees(filters = {}) {
  const params = [];
  const conditions = ["u.deleted_at IS NULL"];
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(LOWER(u.full_name) LIKE $${params.length} OR LOWER(u.employee_id) LIKE $${params.length} OR LOWER(u.department) LIKE $${params.length} OR LOWER(u.designation) LIKE $${params.length})`);
  }
  if (filters.department) {
    params.push(String(filters.department).trim().toLowerCase());
    conditions.push(`LOWER(u.department) = $${params.length}`);
  }

  const date = filters.date || new Date().toISOString().slice(0, 10);
  params.push(date);
  const dateParam = params.length;

  const result = await query(
    `
    SELECT
      u.*,
      p.joining_date, p.employment_type, p.employment_status, p.reporting_manager_id,
      p.emergency_contact_name, p.emergency_contact_phone, p.salary_monthly, p.notes AS profile_notes,
      a.status AS attendance_status, a.check_in_time, a.check_out_time,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'id', sws.id, 'workingTime', sws.working_time, 'breakTime', sws.break_time, 'weekOff', sws.week_off
        )) FILTER (WHERE sws.id IS NOT NULL),
        '[]'::jsonb
      ) AS work_schedules,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'id', sa.id, 'shiftName', hs.shift_name, 'startTime', hs.start_time, 'endTime', hs.end_time,
          'effectiveFrom', sa.effective_from, 'effectiveTo', sa.effective_to, 'weekOff', sa.week_off
        )) FILTER (WHERE sa.id IS NOT NULL),
        '[]'::jsonb
      ) AS shift_assignments
    FROM users u
    LEFT JOIN hr_employee_profiles p ON p.user_id = u.id
    LEFT JOIN staff_attendance a ON a.user_id = u.id AND a.attendance_date = $${dateParam}
    LEFT JOIN staff_work_schedules sws ON sws.user_id = u.id AND sws.is_active = true
    LEFT JOIN hr_shift_assignments sa ON sa.user_id = u.id AND sa.is_active = true
    LEFT JOIN hr_shifts hs ON hs.id = sa.shift_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY u.id, p.id, a.id
    ORDER BY u.full_name ASC
    `,
    params
  );
  return result.rows.map(toEmployee);
}

export async function upsertEmployeeProfileRecord(payload) {
  const result = await query(
    `
    INSERT INTO hr_employee_profiles (
      id, user_id, joining_date, employment_type, employment_status, reporting_manager_id,
      emergency_contact_name, emergency_contact_phone, salary_monthly, notes, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    ON CONFLICT (user_id) DO UPDATE
    SET joining_date = EXCLUDED.joining_date,
        employment_type = EXCLUDED.employment_type,
        employment_status = EXCLUDED.employment_status,
        reporting_manager_id = EXCLUDED.reporting_manager_id,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        salary_monthly = EXCLUDED.salary_monthly,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING *
    `,
    [
      payload.id,
      payload.userId,
      payload.joiningDate || null,
      payload.employmentType,
      payload.employmentStatus,
      payload.reportingManagerId || null,
      payload.emergencyContactName || "",
      payload.emergencyContactPhone || "",
      payload.salaryMonthly || 0,
      payload.notes || "",
      JSON.stringify({})
    ]
  );
  return result.rows[0];
}

export async function listAttendanceRecords(filters = {}) {
  const params = [];
  const conditions = ["u.deleted_at IS NULL"];
  if (filters.date) {
    params.push(filters.date);
    conditions.push(`a.attendance_date = $${params.length}`);
  }
  if (filters.month) {
    params.push(`${filters.month}-01`);
    conditions.push(`a.attendance_date >= $${params.length}::date AND a.attendance_date < ($${params.length}::date + INTERVAL '1 month')`);
  }
  if (filters.department) {
    params.push(String(filters.department).trim().toLowerCase());
    conditions.push(`LOWER(u.department) = $${params.length}`);
  }

  const result = await query(
    `
    SELECT a.*, u.employee_id, u.full_name, u.department, u.designation
    FROM staff_attendance a
    JOIN users u ON u.id = a.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY a.attendance_date DESC, u.full_name ASC
    `,
    params
  );
  return result.rows.map(toAttendance);
}

export async function attendanceForDate(date, filters = {}) {
  const params = [date];
  const conditions = ["u.deleted_at IS NULL", "u.is_active = true"];
  if (filters.department) {
    params.push(String(filters.department).trim().toLowerCase());
    conditions.push(`LOWER(u.department) = $${params.length}`);
  }
  const result = await query(
    `
    SELECT
      COALESCE(a.id, gen_random_uuid()) AS id,
      u.id AS user_id, u.employee_id, u.full_name, u.department, u.designation,
      COALESCE(a.attendance_date, $1::date) AS attendance_date,
      COALESCE(a.status, 'absent') AS status,
      a.check_in_time, a.check_out_time,
      COALESCE(a.late_minutes, 0) AS late_minutes,
      COALESCE(a.early_exit_minutes, 0) AS early_exit_minutes,
      COALESCE(a.source, 'manual') AS source,
      COALESCE(a.notes, '') AS notes,
      a.marked_by, a.created_at, a.updated_at
    FROM users u
    LEFT JOIN staff_attendance a ON a.user_id = u.id AND a.attendance_date = $1
    WHERE ${conditions.join(" AND ")}
    ORDER BY u.full_name ASC
    `,
    params
  );
  return result.rows.map(toAttendance);
}

export async function upsertAttendanceRecord(payload) {
  const result = await query(
    `
    INSERT INTO staff_attendance (
      id, user_id, attendance_date, status, check_in_time, check_out_time,
      late_minutes, early_exit_minutes, marked_by, source, notes, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    ON CONFLICT (user_id, attendance_date) DO UPDATE
    SET status = EXCLUDED.status,
        check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        late_minutes = EXCLUDED.late_minutes,
        early_exit_minutes = EXCLUDED.early_exit_minutes,
        marked_by = EXCLUDED.marked_by,
        source = EXCLUDED.source,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING *
    `,
    [
      payload.id,
      payload.userId,
      payload.attendanceDate,
      payload.status,
      payload.checkInTime || null,
      payload.checkOutTime || null,
      payload.lateMinutes || 0,
      payload.earlyExitMinutes || 0,
      payload.markedBy || null,
      payload.source || "manual",
      payload.notes || "",
      JSON.stringify({})
    ]
  );
  return toAttendance(result.rows[0]);
}

export async function bulkUpsertAttendanceRecords(items) {
  return withTransaction(async () => {
    const saved = [];
    for (const item of items) {
      saved.push(await upsertAttendanceRecord(item));
    }
    return saved;
  });
}

export async function getHrSummaryRecord(date) {
  const result = await query(
    `
    WITH active_users AS (
      SELECT * FROM users WHERE deleted_at IS NULL AND is_active = true
    ),
    today_attendance AS (
      SELECT * FROM staff_attendance WHERE attendance_date = $1
    ),
    open_leaves AS (
      SELECT DISTINCT user_id FROM hr_leave_requests
      WHERE status = 'approved' AND $1::date BETWEEN start_date AND end_date
    )
    SELECT
      (SELECT COUNT(*)::int FROM active_users) AS total_employees,
      (SELECT COUNT(*)::int FROM today_attendance WHERE status = 'present') AS present_today,
      (SELECT COUNT(*)::int FROM today_attendance WHERE status = 'absent') AS absent_marked,
      (SELECT COUNT(*)::int FROM open_leaves) AS on_leave,
      (SELECT COUNT(*)::int FROM today_attendance WHERE late_minutes > 0) AS late_checkins
    `,
    [date]
  );

  const departments = await query(
    `
    SELECT
      u.department,
      COUNT(u.id)::int AS total,
      COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
      COUNT(a.id) FILTER (WHERE a.status = 'leave')::int AS leave,
      COUNT(a.id) FILTER (WHERE a.status = 'absent')::int AS absent
    FROM users u
    LEFT JOIN staff_attendance a ON a.user_id = u.id AND a.attendance_date = $1
    WHERE u.deleted_at IS NULL AND u.is_active = true
    GROUP BY u.department
    ORDER BY u.department ASC
    `,
    [date]
  );

  const row = result.rows[0] || {};
  const total = toNumber(row.total_employees);
  const markedAbsent = toNumber(row.absent_marked);
  const present = toNumber(row.present_today);
  const leave = toNumber(row.on_leave);
  return {
    date,
    totalEmployees: total,
    presentToday: present,
    absentToday: markedAbsent + Math.max(total - present - markedAbsent - leave, 0),
    onLeave: leave,
    lateCheckins: toNumber(row.late_checkins),
    departmentAttendance: departments.rows.map((item) => ({
      department: item.department || "Unassigned",
      total: toNumber(item.total),
      present: toNumber(item.present),
      absent: toNumber(item.absent),
      leave: toNumber(item.leave)
    }))
  };
}

export async function listShiftRecords() {
  const result = await query(
    `
    SELECT s.*, COUNT(sa.id)::int AS assigned_employees
    FROM hr_shifts s
    LEFT JOIN hr_shift_assignments sa ON sa.shift_id = s.id AND sa.is_active = true
    WHERE s.is_active = true
    GROUP BY s.id
    ORDER BY s.start_time ASC, s.shift_name ASC
    `
  );
  return result.rows.map(toShift);
}

export async function createShiftRecord(payload) {
  const result = await query(
    `
    INSERT INTO hr_shifts (id, shift_name, start_time, end_time, break_minutes, grace_minutes, is_night_shift, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    RETURNING *
    `,
    [payload.id, payload.shiftName, payload.startTime, payload.endTime, payload.breakMinutes, payload.graceMinutes, payload.isNightShift, JSON.stringify({})]
  );
  return toShift(result.rows[0]);
}

export async function assignShiftRecord(payload) {
  const result = await query(
    `
    INSERT INTO hr_shift_assignments (id, user_id, shift_id, effective_from, effective_to, week_off, assigned_by, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    RETURNING *
    `,
    [payload.id, payload.userId, payload.shiftId, payload.effectiveFrom, payload.effectiveTo || null, payload.weekOff || "", payload.assignedBy || null, JSON.stringify({})]
  );
  return result.rows[0];
}

export async function listShiftAssignmentRecords() {
  const result = await query(
    `
    SELECT sa.*, u.employee_id, u.full_name, u.department, hs.shift_name, hs.start_time, hs.end_time
    FROM hr_shift_assignments sa
    JOIN users u ON u.id = sa.user_id
    JOIN hr_shifts hs ON hs.id = sa.shift_id
    WHERE sa.is_active = true
    ORDER BY sa.effective_from DESC, u.full_name ASC
    `
  );
  return result.rows.map(toShiftAssignment);
}

export async function listLeaveRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`l.status = $${params.length}`);
  }
  const result = await query(
    `
    SELECT l.*, u.employee_id, u.full_name, u.department
    FROM hr_leave_requests l
    JOIN users u ON u.id = l.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY l.created_at DESC
    `,
    params
  );
  return result.rows.map(toLeave);
}

export async function createLeaveRecord(payload) {
  const result = await query(
    `
    INSERT INTO hr_leave_requests (
      id, user_id, leave_type, start_date, end_date, total_days, status, reason, created_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    RETURNING *
    `,
    [payload.id, payload.userId, payload.leaveType, payload.startDate, payload.endDate, payload.totalDays, payload.status, payload.reason || "", payload.createdBy || null, JSON.stringify({})]
  );
  return toLeave(result.rows[0]);
}

export async function updateLeaveStatusRecord(id, payload) {
  const result = await query(
    `
    UPDATE hr_leave_requests
    SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_note = $4, updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, payload.status, payload.reviewedBy || null, payload.reviewNote || ""]
  );
  return toLeave(result.rows[0]);
}

export async function listPayrollRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.month) {
    params.push(`${filters.month}-01`);
    conditions.push(`p.payroll_month = $${params.length}`);
  }
  const result = await query(
    `
    SELECT p.*, u.employee_id, u.full_name, u.department
    FROM hr_payroll_records p
    JOIN users u ON u.id = p.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.payroll_month DESC, u.full_name ASC
    `,
    params
  );
  return result.rows.map(toPayroll);
}

export async function upsertPayrollRecord(payload) {
  const result = await query(
    `
    INSERT INTO hr_payroll_records (
      id, user_id, payroll_month, basic_salary, allowances, deductions, net_salary,
      payment_status, paid_on, notes, created_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    ON CONFLICT (user_id, payroll_month) DO UPDATE
    SET basic_salary = EXCLUDED.basic_salary,
        allowances = EXCLUDED.allowances,
        deductions = EXCLUDED.deductions,
        net_salary = EXCLUDED.net_salary,
        payment_status = EXCLUDED.payment_status,
        paid_on = EXCLUDED.paid_on,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING *
    `,
    [payload.id, payload.userId, payload.payrollMonth, payload.basicSalary, payload.allowances, payload.deductions, payload.netSalary, payload.paymentStatus, payload.paidOn || null, payload.notes || "", payload.createdBy || null, JSON.stringify({})]
  );
  return toPayroll(result.rows[0]);
}

export async function listDocumentRecords(filters = {}) {
  const params = [];
  const conditions = ["1 = 1"];
  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`d.user_id = $${params.length}`);
  }
  const result = await query(
    `
    SELECT d.*, u.employee_id, u.full_name
    FROM hr_employee_documents d
    JOIN users u ON u.id = d.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY d.expiry_date ASC NULLS LAST, d.created_at DESC
    `,
    params
  );
  return result.rows.map(toDocument);
}

export async function createDocumentRecord(payload) {
  const result = await query(
    `
    INSERT INTO hr_employee_documents (
      id, user_id, document_type, document_name, document_number, issue_date, expiry_date,
      file_url, status, notes, uploaded_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    RETURNING *
    `,
    [payload.id, payload.userId, payload.documentType, payload.documentName, payload.documentNumber || "", payload.issueDate || null, payload.expiryDate || null, payload.fileUrl || "", payload.status, payload.notes || "", payload.uploadedBy || null, JSON.stringify({})]
  );
  return toDocument(result.rows[0]);
}
