import { Fragment, useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { getModuleCatalog, getUsers, getUsersSummary, updateUserModuleAccess } from "../../services/api.js";

function titleize(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [moduleCatalog, setModuleCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [error, setError] = useState("");

  const [editingUserId, setEditingUserId] = useState("");
  const [draftModules, setDraftModules] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");

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

      if (isAdmin) {
        try {
          const catalogResponse = await getModuleCatalog();
          setModuleCatalog(catalogResponse.items || []);
        } catch {
          // Non-fatal: the directory still renders without the access editor.
        }
      }
    }

    loadUsersDirectory();
  }, [isAdmin]);

  const roles = useMemo(
    () => Array.from(new Set(users.map((user) => user.role))).sort((left, right) => left.localeCompare(right)),
    [users]
  );
  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department))).sort((left, right) => left.localeCompare(right)),
    [users]
  );

  const moduleLabels = useMemo(
    () => Object.fromEntries(moduleCatalog.map((module) => [module.key, module.label])),
    [moduleCatalog]
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
  const columnCount = isAdmin ? 7 : 6;

  const startEditAccess = (user) => {
    setEditingUserId(user.id);
    setDraftModules(Array.isArray(user.grantedModules) ? user.grantedModules : []);
    setAccessMessage("");
    setError("");
  };

  const cancelEditAccess = () => {
    setEditingUserId("");
    setDraftModules([]);
  };

  const toggleDraftModule = (moduleKey) => {
    setDraftModules((current) =>
      current.includes(moduleKey) ? current.filter((key) => key !== moduleKey) : [...current, moduleKey]
    );
  };

  const saveAccess = async (user) => {
    setSavingAccess(true);
    setError("");
    setAccessMessage("");

    try {
      const response = await updateUserModuleAccess(user.id, draftModules);
      const grantedModules = response.item?.grantedModules || [];
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, grantedModules } : entry))
      );
      setAccessMessage(`Module access updated for ${user.fullName}.`);
      setEditingUserId("");
      setDraftModules([]);
    } catch (apiError) {
      setError(apiError.message || "Unable to update module access.");
    } finally {
      setSavingAccess(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="hero-panel">
        <div className="eyebrow">Staff Directory</div>
        <h2>Hospital employee records imported into the HMS admin workspace.</h2>
        <p>
          This directory is now seeded from your Excel employee list and shared with the doctor masters used in
          appointments and OPD. Admin can review staffing, department placement, role coverage, and grant extra module
          access from one place.
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
          {accessMessage ? <div className="success-text">{accessMessage}</div> : null}

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
                    {isAdmin ? <th>Module Access</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <Fragment key={user.id}>
                      <tr>
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
                        {isAdmin ? (
                          <td>
                            {user.grantedModules?.length ? (
                              <div className="badge-row">
                                {user.grantedModules.map((moduleKey) => (
                                  <span className="alert-badge" key={`${user.id}-${moduleKey}`}>
                                    {moduleLabels[moduleKey] || titleize(moduleKey)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="muted-text">Base role only</span>
                            )}
                            <div style={{ marginTop: 8 }}>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => (editingUserId === user.id ? cancelEditAccess() : startEditAccess(user))}
                              >
                                {editingUserId === user.id ? "Close" : "Manage access"}
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                      {isAdmin && editingUserId === user.id ? (
                        <tr>
                          <td colSpan={columnCount}>
                            <div className="access-editor">
                              <div className="eyebrow">Grant module access to {user.fullName}</div>
                              <p className="muted-text">
                                Select the modules this user can open in addition to their base role. Changes apply on
                                their next request; unchecking a module revokes it.
                              </p>
                              <div className="access-editor-grid">
                                {moduleCatalog.map((module) => (
                                  <label className="access-editor-option" key={`${user.id}-opt-${module.key}`}>
                                    <input
                                      type="checkbox"
                                      checked={draftModules.includes(module.key)}
                                      onChange={() => toggleDraftModule(module.key)}
                                    />
                                    <span>{module.label}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="toolbar" style={{ marginTop: 12 }}>
                                <Button type="button" disabled={savingAccess} onClick={() => saveAccess(user)}>
                                  {savingAccess ? "Saving..." : "Save access"}
                                </Button>
                                <Button type="button" variant="secondary" disabled={savingAccess} onClick={cancelEditAccess}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
