import { useEffect, useMemo, useState } from "react";

import { StatCard } from "../../components/common/StatCard.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import {
  assignHrShift,
  createHrDocument,
  createHrLeave,
  createHrShift,
  getHrAttendance,
  getHrOverview,
  getHrPayroll,
  getHrShifts,
  saveHrAttendanceBulk,
  saveHrEmployeeProfile,
  saveHrPayroll,
  updateHrLeaveStatus
} from "../../services/api.js";

const tabs = ["Dashboard", "Employees", "Attendance", "Leaves", "Shifts", "Payroll", "Documents", "Reports"];
const attendanceStatuses = ["present", "absent", "leave", "half_day", "holiday"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

function titleize(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function employeeOptions(employees) {
  return employees.map((employee) => (
    <option key={employee.id} value={employee.id}>
      {employee.fullName} ({employee.employeeId})
    </option>
  ));
}

function setRowValue(rows, userId, patch) {
  return rows.map((row) => (row.userId === userId ? { ...row, ...patch } : row));
}

export function HrPage() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(currentMonth());
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [overview, setOverview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [shiftsData, setShiftsData] = useState({ shifts: [], assignments: [] });
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    userId: "",
    joiningDate: "",
    employmentType: "full_time",
    employmentStatus: "active",
    emergencyContactName: "",
    emergencyContactPhone: "",
    salaryMonthly: "",
    notes: ""
  });
  const [leaveForm, setLeaveForm] = useState({
    userId: "",
    leaveType: "casual",
    startDate: today(),
    endDate: today(),
    reason: "",
    status: "pending"
  });
  const [shiftForm, setShiftForm] = useState({
    shiftName: "",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    graceMinutes: 10
  });
  const [assignmentForm, setAssignmentForm] = useState({
    userId: "",
    shiftId: "",
    effectiveFrom: today(),
    weekOff: "Sunday"
  });
  const [payrollForm, setPayrollForm] = useState({
    userId: "",
    payrollMonth: currentMonth(),
    basicSalary: "",
    allowances: "",
    deductions: "",
    paymentStatus: "draft",
    paidOn: "",
    notes: ""
  });
  const [documentForm, setDocumentForm] = useState({
    userId: "",
    documentType: "id_proof",
    documentName: "",
    documentNumber: "",
    issueDate: "",
    expiryDate: "",
    fileUrl: "",
    status: "active",
    notes: ""
  });

  async function loadHrWorkspace(nextDate = date) {
    try {
      const [overviewResponse, attendanceResponse, shiftResponse] = await Promise.all([
        getHrOverview({ date: nextDate }),
        getHrAttendance({ date: nextDate, department: departmentFilter }),
        getHrShifts()
      ]);
      setOverview(overviewResponse);
      setEmployees(overviewResponse.employees || []);
      setAttendanceRows(attendanceResponse.items || []);
      setShiftsData(shiftResponse);
      setPayrollRecords(overviewResponse.payroll || []);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load HR workspace.");
    }
  }

  useEffect(() => {
    loadHrWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, departmentFilter]);

  useEffect(() => {
    async function loadPayrollForMonth() {
      try {
        const response = await getHrPayroll({ month });
        setPayrollRecords(response.items || []);
      } catch (apiError) {
        setError(apiError.message || "Unable to load payroll records.");
      }
    }

    loadPayrollForMonth();
  }, [month]);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))).sort(),
    [employees]
  );

  const filteredEmployees = useMemo(
    () => employees.filter((employee) => !departmentFilter || employee.department === departmentFilter),
    [departmentFilter, employees]
  );

  const leaves = overview?.leaves || [];
  const payroll = payrollRecords;
  const documents = overview?.documents || [];
  const summary = overview?.summary || {};

  async function runSave(action, successMessage) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
      await loadHrWorkspace();
    } catch (apiError) {
      setError(apiError.message || "Unable to save HR data.");
    } finally {
      setSaving(false);
    }
  }

  function fillProfile(employee) {
    setProfileForm({
      userId: employee.id,
      joiningDate: employee.joiningDate || "",
      employmentType: employee.employmentType || "full_time",
      employmentStatus: employee.employmentStatus || "active",
      emergencyContactName: employee.emergencyContactName || "",
      emergencyContactPhone: employee.emergencyContactPhone || "",
      salaryMonthly: employee.salaryMonthly || "",
      notes: employee.notes || ""
    });
    setActiveTab("Employees");
  }

  function markAll(status) {
    setAttendanceRows((rows) =>
      rows.map((row) => ({
        ...row,
        status,
        checkInTime: status === "present" ? row.checkInTime || "09:00" : "",
        checkOutTime: status === "present" ? row.checkOutTime || "18:00" : "",
        notes: row.notes || ""
      }))
    );
  }

  const attendanceCounts = attendanceRows.reduce(
    (acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }),
    {}
  );

  return (
    <DashboardLayout>
      <section className="hero-panel">
        <div className="eyebrow">Human Resources</div>
        <h2>HR workspace for staff, attendance, leave, duty roster, documents, and payroll.</h2>
        <p>
          The HR role can manage daily attendance manually today, while the same structure can later connect to biometric or mobile check-in.
        </p>
      </section>

      <div className="hr-tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} type="button" onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {message ? <div className="success-text hr-message">{message}</div> : null}
      {error ? <div className="error-text hr-message">{error}</div> : null}

      {activeTab === "Dashboard" ? (
        <>
          <section className="stat-grid">
            <StatCard label="Employees" value={String(summary.totalEmployees || 0)} note="Active hospital staff" />
            <StatCard label="Present Today" value={String(summary.presentToday || 0)} note={date} />
            <StatCard label="Absent Today" value={String(summary.absentToday || 0)} note="Includes unmarked staff" />
            <StatCard label="Late Check-ins" value={String(summary.lateCheckins || 0)} note="Manual or device source" />
          </section>

          <section className="content-grid">
            <article className="content-card">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Department Attendance</div>
                  <h3>Today by department</h3>
                </div>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Total</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.departmentAttendance || []).map((item) => (
                      <tr key={item.department}>
                        <td>{item.department}</td>
                        <td>{item.total}</td>
                        <td>{item.present}</td>
                        <td>{item.absent}</td>
                        <td>{item.leave}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="content-card">
              <div className="section-header">
                <div>
                  <div className="eyebrow">HR Queue</div>
                  <h3>Items needing attention</h3>
                </div>
              </div>
              <div className="stack-list">
                <div className="quick-action">
                  <strong>{leaves.filter((leave) => leave.status === "pending").length} leave requests pending</strong>
                  <div className="timeline-copy">Review and approve from the Leaves tab.</div>
                </div>
                <div className="quick-action">
                  <strong>{documents.filter((doc) => doc.status === "missing" || doc.status === "expired").length} document issues</strong>
                  <div className="timeline-copy">Track missing or expired employee documents.</div>
                </div>
                <div className="quick-action">
                  <strong>{shiftsData.assignments.length} active shift assignments</strong>
                  <div className="timeline-copy">Duty roster is connected to employee profiles.</div>
                </div>
              </div>
            </aside>
          </section>
        </>
      ) : null}

      {activeTab === "Employees" ? (
        <section className="content-grid hr-wide-grid">
          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Employees</div>
                <h3>HR employee profiles</h3>
              </div>
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Joining</th>
                    <th>Emergency</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td><strong>{employee.fullName}</strong><div className="muted-text">{employee.employeeId}</div></td>
                      <td>{employee.department}<div className="muted-text">{employee.designation}</div></td>
                      <td><span className="status-pill waiting">{titleize(employee.employmentStatus || "active")}</span></td>
                      <td>{employee.joiningDate || "Not set"}</td>
                      <td>{employee.emergencyContactName || "Not set"}<div className="muted-text">{employee.emergencyContactPhone}</div></td>
                      <td><button className="button-link" type="button" onClick={() => fillProfile(employee)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Profile</div>
                <h3>Employment details</h3>
              </div>
            </div>
            <form className="form-stack" onSubmit={(event) => {
              event.preventDefault();
              runSave(() => saveHrEmployeeProfile(profileForm), "Employee HR profile saved.");
            }}>
              <label className="field">Employee<select value={profileForm.userId} onChange={(event) => setProfileForm({ ...profileForm, userId: event.target.value })}><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
              <label className="field">Joining date<input type="date" value={profileForm.joiningDate} onChange={(event) => setProfileForm({ ...profileForm, joiningDate: event.target.value })} /></label>
              <label className="field">Employment type<select value={profileForm.employmentType} onChange={(event) => setProfileForm({ ...profileForm, employmentType: event.target.value })}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="consultant">Consultant</option><option value="intern">Intern</option></select></label>
              <label className="field">Employment status<select value={profileForm.employmentStatus} onChange={(event) => setProfileForm({ ...profileForm, employmentStatus: event.target.value })}><option value="active">Active</option><option value="probation">Probation</option><option value="on_notice">On notice</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option></select></label>
              <label className="field">Emergency contact<input value={profileForm.emergencyContactName} onChange={(event) => setProfileForm({ ...profileForm, emergencyContactName: event.target.value })} /></label>
              <label className="field">Emergency phone<input value={profileForm.emergencyContactPhone} onChange={(event) => setProfileForm({ ...profileForm, emergencyContactPhone: event.target.value })} /></label>
              <label className="field">Monthly salary<input type="number" min="0" value={profileForm.salaryMonthly} onChange={(event) => setProfileForm({ ...profileForm, salaryMonthly: event.target.value })} /></label>
              <label className="field">Notes<textarea value={profileForm.notes} onChange={(event) => setProfileForm({ ...profileForm, notes: event.target.value })} /></label>
              <button className="primary-button" disabled={saving} type="submit">Save Profile</button>
            </form>
          </aside>
        </section>
      ) : null}

      {activeTab === "Attendance" ? (
        <section className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Attendance</div>
              <h3>Daily attendance sheet</h3>
            </div>
            <div className="action-row">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                <option value="">All departments</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </div>
          </div>
          <div className="action-row hr-attendance-actions">
            <button className="secondary-button" type="button" onClick={() => markAll("present")}>Mark All Present</button>
            <button className="secondary-button" type="button" onClick={() => markAll("absent")}>Mark All Absent</button>
            <span className="pill">Present {attendanceCounts.present || 0}</span>
            <span className="pill">Absent {attendanceCounts.absent || 0}</span>
            <span className="pill">Leave {attendanceCounts.leave || 0}</span>
          </div>
          <div className="table-shell">
            <table className="data-table hr-attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Late</th>
                  <th>Early Exit</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row) => (
                  <tr key={row.userId}>
                    <td><strong>{row.fullName}</strong><div className="muted-text">{row.department}</div></td>
                    <td><select value={row.status} onChange={(event) => setAttendanceRows((rows) => setRowValue(rows, row.userId, { status: event.target.value }))}>{attendanceStatuses.map((status) => <option key={status} value={status}>{titleize(status)}</option>)}</select></td>
                    <td><input type="time" value={row.checkInTime || ""} onChange={(event) => setAttendanceRows((rows) => setRowValue(rows, row.userId, { checkInTime: event.target.value }))} /></td>
                    <td><input type="time" value={row.checkOutTime || ""} onChange={(event) => setAttendanceRows((rows) => setRowValue(rows, row.userId, { checkOutTime: event.target.value }))} /></td>
                    <td><input type="number" min="0" value={row.lateMinutes || 0} onChange={(event) => setAttendanceRows((rows) => setRowValue(rows, row.userId, { lateMinutes: event.target.value }))} /></td>
                    <td><input type="number" min="0" value={row.earlyExitMinutes || 0} onChange={(event) => setAttendanceRows((rows) => setRowValue(rows, row.userId, { earlyExitMinutes: event.target.value }))} /></td>
                    <td><input value={row.notes || ""} onChange={(event) => setAttendanceRows((rows) => setRowValue(rows, row.userId, { notes: event.target.value }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="action-row hr-save-row">
            <button className="primary-button" disabled={saving} type="button" onClick={() => runSave(
              () => saveHrAttendanceBulk({ items: attendanceRows.map((row) => ({ ...row, attendanceDate: date })) }),
              "Attendance sheet saved."
            )}>Save Attendance</button>
          </div>
        </section>
      ) : null}

      {activeTab === "Leaves" ? (
        <section className="content-grid">
          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Leave</div><h3>Requests and approvals</h3></div></div>
            <div className="table-shell">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Status</th><th>Reason</th><th></th></tr></thead>
                <tbody>
                  {leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td>{leave.fullName}<div className="muted-text">{leave.department}</div></td>
                      <td>{titleize(leave.leaveType)}</td>
                      <td>{leave.startDate} to {leave.endDate}<div className="muted-text">{leave.totalDays} day(s)</div></td>
                      <td><span className="status-pill waiting">{titleize(leave.status)}</span></td>
                      <td>{leave.reason || "No reason added"}</td>
                      <td className="action-row">
                        <button className="button-link" type="button" onClick={() => runSave(() => updateHrLeaveStatus(leave.id, { status: "approved" }), "Leave approved.")}>Approve</button>
                        <button className="button-link danger-link" type="button" onClick={() => runSave(() => updateHrLeaveStatus(leave.id, { status: "rejected" }), "Leave rejected.")}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <aside className="content-card">
            <div className="section-header"><div><div className="eyebrow">New Leave</div><h3>Add leave entry</h3></div></div>
            <form className="form-stack" onSubmit={(event) => { event.preventDefault(); runSave(() => createHrLeave(leaveForm), "Leave request saved."); }}>
              <label className="field">Employee<select value={leaveForm.userId} onChange={(event) => setLeaveForm({ ...leaveForm, userId: event.target.value })}><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
              <label className="field">Leave type<select value={leaveForm.leaveType} onChange={(event) => setLeaveForm({ ...leaveForm, leaveType: event.target.value })}><option value="casual">Casual</option><option value="sick">Sick</option><option value="earned">Earned</option><option value="unpaid">Unpaid</option><option value="other">Other</option></select></label>
              <label className="field">Start date<input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm({ ...leaveForm, startDate: event.target.value })} /></label>
              <label className="field">End date<input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm({ ...leaveForm, endDate: event.target.value })} /></label>
              <label className="field">Reason<textarea value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} /></label>
              <button className="primary-button" disabled={saving} type="submit">Save Leave</button>
            </form>
          </aside>
        </section>
      ) : null}

      {activeTab === "Shifts" ? (
        <section className="content-grid">
          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Duty Roster</div><h3>Shifts and assignments</h3></div></div>
            <div className="table-shell">
              <table className="data-table">
                <thead><tr><th>Shift</th><th>Time</th><th>Break</th><th>Grace</th><th>Assigned</th></tr></thead>
                <tbody>{shiftsData.shifts.map((shift) => <tr key={shift.id}><td>{shift.shiftName}</td><td>{shift.startTime} - {shift.endTime}</td><td>{shift.breakMinutes} min</td><td>{shift.graceMinutes} min</td><td>{shift.assignedEmployees}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="stack-list">
              {shiftsData.assignments.map((assignment) => <div className="quick-action" key={assignment.id}><strong>{assignment.fullName} - {assignment.shiftName}</strong><div className="timeline-copy">{assignment.startTime} to {assignment.endTime} | Week off: {assignment.weekOff || "Not set"}</div></div>)}
            </div>
          </article>
          <aside className="content-card">
            <div className="section-header"><div><div className="eyebrow">Shift Setup</div><h3>Create and assign</h3></div></div>
            <form className="form-stack" onSubmit={(event) => { event.preventDefault(); runSave(() => createHrShift(shiftForm), "Shift created."); }}>
              <label className="field">Shift name<input value={shiftForm.shiftName} onChange={(event) => setShiftForm({ ...shiftForm, shiftName: event.target.value })} /></label>
              <label className="field">Start<input type="time" value={shiftForm.startTime} onChange={(event) => setShiftForm({ ...shiftForm, startTime: event.target.value })} /></label>
              <label className="field">End<input type="time" value={shiftForm.endTime} onChange={(event) => setShiftForm({ ...shiftForm, endTime: event.target.value })} /></label>
              <label className="field">Break minutes<input type="number" value={shiftForm.breakMinutes} onChange={(event) => setShiftForm({ ...shiftForm, breakMinutes: event.target.value })} /></label>
              <label className="field">Grace minutes<input type="number" value={shiftForm.graceMinutes} onChange={(event) => setShiftForm({ ...shiftForm, graceMinutes: event.target.value })} /></label>
              <button className="secondary-button" disabled={saving} type="submit">Create Shift</button>
            </form>
            <form className="form-stack" onSubmit={(event) => { event.preventDefault(); runSave(() => assignHrShift(assignmentForm), "Shift assigned."); }}>
              <label className="field">Employee<select value={assignmentForm.userId} onChange={(event) => setAssignmentForm({ ...assignmentForm, userId: event.target.value })}><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
              <label className="field">Shift<select value={assignmentForm.shiftId} onChange={(event) => setAssignmentForm({ ...assignmentForm, shiftId: event.target.value })}><option value="">Select shift</option>{shiftsData.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.shiftName}</option>)}</select></label>
              <label className="field">Effective from<input type="date" value={assignmentForm.effectiveFrom} onChange={(event) => setAssignmentForm({ ...assignmentForm, effectiveFrom: event.target.value })} /></label>
              <label className="field">Week off<input value={assignmentForm.weekOff} onChange={(event) => setAssignmentForm({ ...assignmentForm, weekOff: event.target.value })} /></label>
              <button className="primary-button" disabled={saving} type="submit">Assign Shift</button>
            </form>
          </aside>
        </section>
      ) : null}

      {activeTab === "Payroll" ? (
        <section className="content-grid">
          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Payroll</div><h3>Monthly payroll records</h3></div><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
            <div className="table-shell"><table className="data-table"><thead><tr><th>Employee</th><th>Month</th><th>Basic</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>{payroll.map((item) => <tr key={item.id}><td>{item.fullName}</td><td>{item.payrollMonth}</td><td>{item.basicSalary}</td><td>{item.deductions}</td><td>{item.netSalary}</td><td>{titleize(item.paymentStatus)}</td></tr>)}</tbody></table></div>
          </article>
          <aside className="content-card">
            <div className="section-header"><div><div className="eyebrow">Salary</div><h3>Add payroll</h3></div></div>
            <form className="form-stack" onSubmit={(event) => { event.preventDefault(); runSave(() => saveHrPayroll(payrollForm), "Payroll record saved."); }}>
              <label className="field">Employee<select value={payrollForm.userId} onChange={(event) => setPayrollForm({ ...payrollForm, userId: event.target.value })}><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
              <label className="field">Month<input type="month" value={payrollForm.payrollMonth} onChange={(event) => setPayrollForm({ ...payrollForm, payrollMonth: event.target.value })} /></label>
              <label className="field">Basic salary<input type="number" min="0" value={payrollForm.basicSalary} onChange={(event) => setPayrollForm({ ...payrollForm, basicSalary: event.target.value })} /></label>
              <label className="field">Allowances<input type="number" min="0" value={payrollForm.allowances} onChange={(event) => setPayrollForm({ ...payrollForm, allowances: event.target.value })} /></label>
              <label className="field">Deductions<input type="number" min="0" value={payrollForm.deductions} onChange={(event) => setPayrollForm({ ...payrollForm, deductions: event.target.value })} /></label>
              <label className="field">Status<select value={payrollForm.paymentStatus} onChange={(event) => setPayrollForm({ ...payrollForm, paymentStatus: event.target.value })}><option value="draft">Draft</option><option value="processed">Processed</option><option value="paid">Paid</option><option value="withheld">Withheld</option></select></label>
              <button className="primary-button" disabled={saving} type="submit">Save Payroll</button>
            </form>
          </aside>
        </section>
      ) : null}

      {activeTab === "Documents" ? (
        <section className="content-grid">
          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Documents</div><h3>Employee document tracker</h3></div></div>
            <div className="table-shell"><table className="data-table"><thead><tr><th>Employee</th><th>Document</th><th>Number</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{documents.map((doc) => <tr key={doc.id}><td>{doc.fullName}</td><td>{doc.documentName}<div className="muted-text">{titleize(doc.documentType)}</div></td><td>{doc.documentNumber || "N/A"}</td><td>{doc.expiryDate || "N/A"}</td><td>{titleize(doc.status)}</td></tr>)}</tbody></table></div>
          </article>
          <aside className="content-card">
            <div className="section-header"><div><div className="eyebrow">Add Document</div><h3>Document metadata</h3></div></div>
            <form className="form-stack" onSubmit={(event) => { event.preventDefault(); runSave(() => createHrDocument(documentForm), "Employee document saved."); }}>
              <label className="field">Employee<select value={documentForm.userId} onChange={(event) => setDocumentForm({ ...documentForm, userId: event.target.value })}><option value="">Select employee</option>{employeeOptions(employees)}</select></label>
              <label className="field">Type<input value={documentForm.documentType} onChange={(event) => setDocumentForm({ ...documentForm, documentType: event.target.value })} /></label>
              <label className="field">Document name<input value={documentForm.documentName} onChange={(event) => setDocumentForm({ ...documentForm, documentName: event.target.value })} /></label>
              <label className="field">Document number<input value={documentForm.documentNumber} onChange={(event) => setDocumentForm({ ...documentForm, documentNumber: event.target.value })} /></label>
              <label className="field">Issue date<input type="date" value={documentForm.issueDate} onChange={(event) => setDocumentForm({ ...documentForm, issueDate: event.target.value })} /></label>
              <label className="field">Expiry date<input type="date" value={documentForm.expiryDate} onChange={(event) => setDocumentForm({ ...documentForm, expiryDate: event.target.value })} /></label>
              <label className="field">File URL<input value={documentForm.fileUrl} onChange={(event) => setDocumentForm({ ...documentForm, fileUrl: event.target.value })} /></label>
              <button className="primary-button" disabled={saving} type="submit">Save Document</button>
            </form>
          </aside>
        </section>
      ) : null}

      {activeTab === "Reports" ? (
        <section className="content-card">
          <div className="section-header"><div><div className="eyebrow">Reports</div><h3>Monthly HR snapshot</h3></div></div>
          <section className="stat-grid">
            <StatCard label="Present" value={String(attendanceCounts.present || 0)} note={`For ${date}`} />
            <StatCard label="Absent" value={String(attendanceCounts.absent || 0)} note={`For ${date}`} />
            <StatCard label="Half Day" value={String(attendanceCounts.half_day || 0)} note="Marked manually" />
            <StatCard label="Leaves" value={String(leaves.length)} note="All leave records" />
          </section>
          <div className="table-shell hr-report-table">
            <table className="data-table">
              <thead><tr><th>Department</th><th>Total</th><th>Present</th><th>Absent</th><th>Leave</th></tr></thead>
              <tbody>{(summary.departmentAttendance || []).map((item) => <tr key={item.department}><td>{item.department}</td><td>{item.total}</td><td>{item.present}</td><td>{item.absent}</td><td>{item.leave}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  );
}
