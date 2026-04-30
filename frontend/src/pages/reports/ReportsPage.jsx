import { useEffect, useState } from "react";

import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { formatCurrency } from "../../utils/format.js";
import {
  getDailyOpdReport,
  getIpdCensusReport,
  getLabWorkloadReport,
  getPanchkarmaStatsReport,
  getPharmacySalesReport,
  getReportsOverview,
  getRevenueReport
} from "../../services/api.js";

const today = new Date().toISOString().slice(0, 10);

export function ReportsPage() {
  const [filters, setFilters] = useState({ dateFrom: today, dateTo: today, date: today });
  const [overview, setOverview] = useState(null);
  const [dailyOpd, setDailyOpd] = useState(null);
  const [ipdCensus, setIpdCensus] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [pharmacySales, setPharmacySales] = useState(null);
  const [labWorkload, setLabWorkload] = useState(null);
  const [panchkarmaStats, setPanchkarmaStats] = useState(null);
  const [error, setError] = useState("");

  async function loadReports(nextFilters = filters) {
    try {
      const [overviewResponse, dailyOpdResponse, ipdCensusResponse, revenueResponse, pharmacyResponse, labResponse, therapyResponse] =
        await Promise.all([
          getReportsOverview({ dateFrom: nextFilters.dateFrom, dateTo: nextFilters.dateTo }),
          getDailyOpdReport({ date: nextFilters.date }),
          getIpdCensusReport({ date: nextFilters.date }),
          getRevenueReport({ dateFrom: nextFilters.dateFrom, dateTo: nextFilters.dateTo }),
          getPharmacySalesReport({ dateFrom: nextFilters.dateFrom, dateTo: nextFilters.dateTo }),
          getLabWorkloadReport({ dateFrom: nextFilters.dateFrom, dateTo: nextFilters.dateTo }),
          getPanchkarmaStatsReport({ dateFrom: nextFilters.dateFrom, dateTo: nextFilters.dateTo })
        ]);

      setOverview(overviewResponse);
      setDailyOpd(dailyOpdResponse);
      setIpdCensus(ipdCensusResponse);
      setRevenue(revenueResponse);
      setPharmacySales(pharmacyResponse);
      setLabWorkload(labResponse);
      setPanchkarmaStats(therapyResponse);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load reports.");
    }
  }

  useEffect(() => {
    loadReports({ dateFrom: today, dateTo: today, date: today });
  }, []);

  const handleFilterChange = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    await loadReports(filters);
  };

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Operational Reports</div>
        <h2>Track OPD, IPD, revenue, pharmacy, lab, and Panchkarma performance from one reporting desk.</h2>
        <p>
          These reports are generated from the current transactional HMS data so leadership and operations can review
          throughput, occupancy, billing, and module workload without leaving the system.
        </p>
      </section>

      <section className="content-card" style={{ marginTop: 18 }}>
        <form className="toolbar" onSubmit={applyFilters}>
          <input type="date" name="date" value={filters.date} onChange={handleFilterChange} />
          <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} />
          <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} />
          <button className="primary-button" type="submit">Refresh Reports</button>
        </form>
        {error ? <div className="error-text">{error}</div> : null}
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">OPD</div><div className="stat-value">{overview?.opdVisits || 0}</div><div className="stat-note">Visits in selected range</div></article>
        <article className="stat-card"><div className="stat-label">IPD</div><div className="stat-value">{overview?.ipdAdmissions || 0}</div><div className="stat-note">Admissions in selected range</div></article>
        <article className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">Rs. {overview?.revenue || 0}</div><div className="stat-note">Billed in selected range</div></article>
        <article className="stat-card"><div className="stat-label">Collections</div><div className="stat-value">Rs. {overview?.collections || 0}</div><div className="stat-note">Payments in selected range</div></article>
      </section>

      <section className="content-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Daily OPD</div><h3>Visit load and doctor mix</h3></div></div>
          <div className="detail-list">
            <div><strong>Total:</strong> {dailyOpd?.summary?.totalVisits || 0}</div>
            <div><strong>Completed:</strong> {dailyOpd?.summary?.completedVisits || 0}</div>
            <div><strong>In progress:</strong> {dailyOpd?.summary?.inProgressVisits || 0}</div>
            <div><strong>Waiting:</strong> {dailyOpd?.summary?.waitingVisits || 0}</div>
          </div>
          <div className="stack-list">
            {(dailyOpd?.byDoctor || []).map((item) => (
              <div className="quick-action" key={item.doctorId || item.doctorName}>
                <strong>{item.doctorName}</strong>
                <div className="timeline-copy">{item.totalVisits} visits</div>
                <div className="timeline-copy">{item.completedVisits} completed</div>
              </div>
            ))}
          </div>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">IPD Census</div><h3>Occupancy and active patients</h3></div></div>
          <div className="detail-list">
            <div><strong>Active admissions:</strong> {ipdCensus?.summary?.activeAdmissions || 0}</div>
            <div><strong>Admissions today:</strong> {ipdCensus?.summary?.admissionsToday || 0}</div>
            <div><strong>Discharges today:</strong> {ipdCensus?.summary?.dischargesToday || 0}</div>
            <div><strong>Occupied beds:</strong> {ipdCensus?.summary?.occupiedBeds || 0}</div>
          </div>
          <div className="stack-list">
            {(ipdCensus?.activePatients || []).map((item) => (
              <div className="quick-action" key={item.admissionNumber}>
                <strong>{item.patientName}</strong>
                <div className="timeline-copy">{item.admissionNumber}</div>
                <div className="timeline-copy">{item.room} / {item.bed}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Revenue</div><h3>Billing and payment mix</h3></div></div>
          <div className="detail-list">
            <div><strong>Total billed:</strong> Rs. {formatCurrency(revenue?.summary?.totalBilled)}</div>
            <div><strong>Total collected:</strong> Rs. {formatCurrency(revenue?.summary?.totalCollected)}</div>
            <div><strong>Outstanding:</strong> Rs. {formatCurrency(revenue?.summary?.outstanding)}</div>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr><th>Bill Type</th><th>Bills</th><th>Total</th><th>Paid</th></tr>
              </thead>
              <tbody>
                {(revenue?.byType || []).map((item) => (
                  <tr key={item.billType}>
                    <td>{item.billType}</td>
                    <td>{item.bills}</td>
                    <td>Rs. {formatCurrency(item.totalAmount)}</td>
                    <td>Rs. {formatCurrency(item.paidAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Pharmacy Sales</div><h3>Dispensing volume</h3></div></div>
          <div className="detail-list">
            <div><strong>Dispensed prescriptions:</strong> {pharmacySales?.summary?.prescriptionsDispensed || 0}</div>
            <div><strong>Sales amount:</strong> Rs. {formatCurrency(pharmacySales?.summary?.salesAmount)}</div>
            <div><strong>Medicine lines:</strong> {pharmacySales?.summary?.medicineLines || 0}</div>
          </div>
          <div className="stack-list">
            {(pharmacySales?.byMedicine || []).slice(0, 6).map((item) => (
              <div className="quick-action" key={item.medicineId}>
                <strong>{item.medicineName}</strong>
                <div className="timeline-copy">Qty: {item.quantity}</div>
                <div className="timeline-copy">Rs. {formatCurrency(item.amount)}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Lab Workload</div><h3>Order status and test demand</h3></div></div>
          <div className="detail-list">
            <div><strong>Total orders:</strong> {labWorkload?.summary?.totalOrders || 0}</div>
            <div><strong>Reported:</strong> {labWorkload?.summary?.reportedOrders || 0}</div>
            <div><strong>Pending:</strong> {labWorkload?.summary?.pendingOrders || 0}</div>
            <div><strong>Test lines:</strong> {labWorkload?.summary?.testLines || 0}</div>
          </div>
          <div className="stack-list">
            {(labWorkload?.byTest || []).slice(0, 6).map((item) => (
              <div className="quick-action" key={item.testId}>
                <strong>{item.testName}</strong>
                <div className="timeline-copy">{item.count} orders</div>
              </div>
            ))}
          </div>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Panchkarma</div><h3>Therapy throughput</h3></div></div>
          <div className="detail-list">
            <div><strong>Total sessions:</strong> {panchkarmaStats?.summary?.totalSessions || 0}</div>
            <div><strong>Completed:</strong> {panchkarmaStats?.summary?.completedSessions || 0}</div>
            <div><strong>Pending:</strong> {panchkarmaStats?.summary?.pendingSessions || 0}</div>
            <div><strong>Total billed:</strong> Rs. {formatCurrency(panchkarmaStats?.summary?.totalBilled)}</div>
          </div>
          <div className="stack-list">
            {(panchkarmaStats?.byTherapy || []).slice(0, 6).map((item) => (
              <div className="quick-action" key={item.therapyId}>
                <strong>{item.therapyName}</strong>
                <div className="timeline-copy">{item.sessions} sessions</div>
                <div className="timeline-copy">Rs. {formatCurrency(item.billedAmount)}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}
