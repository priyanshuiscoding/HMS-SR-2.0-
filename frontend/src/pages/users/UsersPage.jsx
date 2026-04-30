import { useEffect, useMemo, useState } from "react";

import { StatCard } from "../../components/common/StatCard.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { getUsers, getUsersSummary } from "../../services/api.js";

function titleize(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsersDirectory() {
      try {
        const [usersResponse, summaryResponse] = await Promise.all([getUsers(), getUsersSummary()]);
        setUsers(usersResponse.items || []);
        setSummary(summaryResponse);
        setError("");
      } catch (apiError) {
        setError(apiError.message || "Unable to load employee directory.");
      }
    }

    loadUsersDirectory();
  }, []);

  const roles = useMemo(
    () => Array.from(new Set(users.map((user) => user.role))).sort((left, right) => left.localeCompare(right)),
    [users]
  );
  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department))).sort((left, right) => left.localeCompare(right)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !searchValue ||
        [user.fullName, user.employeeId, user.department, user.designation, user.phone, user.email]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(searchValue));
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesDepartment = !departmentFilter || user.department === departmentFilter;

      return matchesSearch && matchesRole && matchesDepartment;
    });
  }, [departmentFilter, roleFilter, search, users]);

  const topDepartments = summary?.departmentsList?.slice(0, 4) || [];

  return (
    <DashboardLayout>
      <section className="hero-panel">
        <div className="eyebrow">Staff Directory</div>
        <h2>Hospital employee records imported into the HMS admin workspace.</h2>
        <p>
          This directory is now seeded from your Excel employee list and shared with the doctor masters used in
          appointments and OPD. Admin can review staffing, department placement, and role coverage from one place.
        </p>
      </section>

      <section className="stat-grid">
        <StatCard label="Employees" value={String(summary?.totalEmployees || users.length)} note="Imported from the hospital roster" />
        <StatCard label="Doctors" value={String(summary?.doctors || 0)} note="Available in appointment and OPD masters" />
        <StatCard label="Departments" value={String(summary?.departments || 0)} note="Cross-functional staff distribution" />
        <StatCard label="Active" value={String(summary?.activeEmployees || users.length)} note="Visible in the admin directory" />
      </section>

      <section className="content-grid users-grid">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Employee List</div>
              <h3>All imported hospital staff</h3>
            </div>
            <div className="pill">{filteredUsers.length} visible</div>
          </div>

          <div className="toolbar">
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, employee ID, phone, designation, or department"
            />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {titleize(role)}
                </option>
              ))}
            </select>
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          {error ? <div className="error-text">{error}</div> : null}

          {!filteredUsers.length ? (
            <div className="empty-state">No employees matched the current filters.</div>
          ) : (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Designation</th>
                    <th>Schedule</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.fullName}</strong>
                        <div className="muted-text">{user.employeeId}</div>
                        <div className="muted-text">{user.email}</div>
                      </td>
                      <td>{user.department}</td>
                      <td>
                        <span className="status-pill waiting">{titleize(user.role)}</span>
                      </td>
                      <td>{user.designation || user.title || "Not specified"}</td>
                      <td>
                        {user.workSchedules?.length ? (
                          user.workSchedules.map((schedule, index) => (
                            <div className="muted-text" key={`${user.id}-schedule-${index}`}>
                              {schedule.workingTime} | Break: {schedule.breakTime || "N/A"} | Off: {schedule.weekOff || "N/A"}
                            </div>
                          ))
                        ) : (
                          <span className="muted-text">Not available</span>
                        )}
                      </td>
                      <td>{user.phone || "Not available"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Coverage</div>
              <h3>Department snapshot</h3>
            </div>
          </div>

          <div className="stack-list timeline-stack compact-list">
            {topDepartments.map((department) => (
              <div className="quick-action" key={department.department}>
                <strong>{department.department}</strong>
                <div className="timeline-copy">{department.count} employees assigned</div>
              </div>
            ))}
          </div>

          <div className="section-header users-summary-header">
            <div>
              <div className="eyebrow">Role Mix</div>
              <h3>Imported staffing by role</h3>
            </div>
          </div>

          <div className="badge-row users-summary-badges">
            {(summary?.roles || []).map((item) => (
              <span className="alert-badge" key={item.role}>
                {titleize(item.role)}: {item.count}
              </span>
            ))}
          </div>
        </aside>
      </section>
    </DashboardLayout>
  );
}
