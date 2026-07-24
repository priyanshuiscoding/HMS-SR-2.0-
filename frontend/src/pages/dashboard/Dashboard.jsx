import { useEffect, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { getDailyHospitalReports, getDashboardSummary } from "../../services/api.js";
import { formatCurrency } from "../../utils/format.js";

const dailyReportRoles = new Set(["admin", "hr"]);

function displayTime(value) {
  if (!value) return "Waiting for data";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function CollectionNote({ modes = {} }) {
  return (
    <span>
      Cash {formatCurrency(modes.cash)} · UPI {formatCurrency(modes.upi)} · Card {formatCurrency(modes.card)}
    </span>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [dailyReports, setDailyReports] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const canViewDailyReports = dailyReportRoles.has(user?.role);

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) setRefreshing(true);

    try {
      const response = await getDashboardSummary();
      setSummary(response);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load today's hospital summary.");
    }

    if (canViewDailyReports) {
      try {
        const response = await getDailyHospitalReports({ limit: 14 });
        setDailyReports(response.items || []);
      } catch (apiError) {
        setError((current) => current || apiError.message || "Unable to load daily hospital reports.");
      }
    } else {
      setDailyReports([]);
    }

    if (!silent) setRefreshing(false);
  }

  useEffect(() => {
    loadDashboard();

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadDashboard({ silent: true });
      }
    }, 15000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadDashboard({ silent: true });
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [canViewDailyReports]);

  const operationalCards = [
    { label: "Total OPD Patients", value: summary?.opdPatients || 0, note: "Today" },
    { label: "Total IPD Patients", value: summary?.ipdPatients || 0, note: "Currently admitted" },
    { label: "New Registrations", value: summary?.newRegistrations || 0, note: "Today" },
    { label: "Follow-up Patients", value: summary?.followUpPatients || 0, note: "Scheduled today" },
    { label: "Today's Appointments", value: summary?.todaysAppointments || 0, note: "Active appointments" },
    { label: "Discharged Patients", value: summary?.dischargedPatients || 0, note: "Today" },
    { label: "Emergency Cases", value: summary?.emergencyCases || 0, note: "Today" }
  ];

  return (
    <DashboardLayout>
      <section className="dashboard-summary-panel" aria-labelledby="today-summary-title">
        <div className="dashboard-summary-header">
          <div>
            <div className="eyebrow">Today's Summary</div>
            <h2 id="today-summary-title">Hospital operations</h2>
            <div className={`dashboard-live-status ${error ? "stale" : ""}`} role="status">
              <span aria-hidden="true" />
              {error ? "Showing last available information" : `Live · Updated ${displayTime(summary?.updatedAt)}`}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => loadDashboard()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>

        {error ? <div className="dashboard-summary-error">{error} Automatic refresh will retry.</div> : null}

        <div className="dashboard-metric-grid">
          {operationalCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={String(card.value)} note={card.note} />
          ))}

          {summary?.permissions?.financials ? (
            <>
              <StatCard
                label="Total Revenue Today"
                value={`₹${formatCurrency(summary.revenueToday)}`}
                note="Bills generated today"
              />
              <StatCard
                label="Pending Payments"
                value={`₹${formatCurrency(summary.pendingPayments)}`}
                note="Current outstanding"
              />
              <StatCard
                label="Cash / UPI / Card Collection"
                value={`₹${formatCurrency(summary.collectedToday)}`}
                note={<CollectionNote modes={summary.collectionByMode} />}
              />
            </>
          ) : null}
        </div>
      </section>

      {canViewDailyReports ? (
        <section className="content-card dashboard-daily-log">
          <div className="section-header">
            <div>
              <div className="eyebrow">Database Daily Log</div>
              <h3>Hospital and employee reports</h3>
            </div>
            <span className="dashboard-log-access">Admin & HR only</span>
          </div>

          <div className="table-shell">
            <table className="data-table dashboard-log-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient Flow</th>
                  <th>Clinical Work</th>
                  <th>Employees</th>
                  <th>Finance</th>
                  <th>Saved</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map((report) => (
                  <tr key={report.id || report.date}>
                    <td><strong>{report.date}</strong></td>
                    <td>
                      <span>OPD {report.opdPatients}</span>
                      <span>IPD active {report.ipdPatients}</span>
                      <span>IPD admitted {report.ipdAdmissions}</span>
                      <span>New {report.newRegistrations} · Discharged {report.dischargedPatients}</span>
                    </td>
                    <td>
                      <span>Appointments {report.todaysAppointments}</span>
                      <span>Panchkarma {report.panchkarmaSessions}</span>
                      <span>Lab {report.labOrders} · Pharmacy {report.pharmacyDispensations}</span>
                      <span>Emergency {report.emergencyCases}</span>
                    </td>
                    <td>
                      <span>Total {report.employees?.total || 0}</span>
                      <span>Present {report.employees?.present || 0} · Absent {report.employees?.absent || 0}</span>
                      <span>Leave {report.employees?.onLeave || 0} · Half day {report.employees?.halfDay || 0}</span>
                    </td>
                    <td>
                      <span>Billed ₹{formatCurrency(report.revenueToday)}</span>
                      <span>Collected ₹{formatCurrency(report.collectedToday)}</span>
                      <span>Pending ₹{formatCurrency(report.pendingPayments)}</span>
                    </td>
                    <td>{displayTime(report.capturedAt)}</td>
                  </tr>
                ))}
                {!dailyReports.length ? (
                  <tr>
                    <td colSpan="6">The first daily database snapshot is being prepared.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  );
}
