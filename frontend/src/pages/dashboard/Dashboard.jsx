import { useEffect, useState } from "react";

import { StatCard } from "../../components/common/StatCard.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { getDashboardSummary, getSystemOverview } from "../../services/api.js";
import { formatCurrency } from "../../utils/format.js";

const timeline = [
  {
    time: "08:00",
    title: "Morning OPD preparation",
    copy: "Reception token desk, doctor room readiness, and today's slot visibility will live here."
  },
  {
    time: "10:30",
    title: "Clinical workflow stream",
    copy: "OPD consultation, Ayurvedic assessment, and prescription handoff will anchor this core panel."
  },
  {
    time: "14:00",
    title: "Operational continuity",
    copy: "Billing desk, pharmacy dispensing, inventory control, and lab hooks are now extending the working HMS shell."
  }
];

const quickActions = [
  {
    title: "Phase 6 active",
    copy: "Patients, appointments, OPD, billing desk, lab, pharmacy, and inventory are now connected in the HMS shell."
  },
  {
    title: "Brand alignment",
    copy: "The interface now follows the Shanti-Ratnam white, blue, and saffron visual language."
  },
  {
    title: "Next build target",
    copy: "Room/IPD flow, admissions, and bed management are the next operational upgrades."
  }
];

export function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    async function loadOverview() {
      try {
        const response = await getSystemOverview();
        setOverview(response);
      } catch {
        setOverview(null);
      }
    }

    loadOverview();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setSummary(null);
      return;
    }

    async function loadSummary() {
      try {
        const response = await getDashboardSummary();
        setSummary(response);
      } catch {
        setSummary(null);
      }
    }

    loadSummary();
  }, [isAdmin]);

  return (
    <DashboardLayout>
      <section className="hero-panel">
        <div className="eyebrow">Operational Dashboard</div>
        <h2>One Shanti-Ratnam system for reception, clinical care, patient journeys, and hospital operations.</h2>
        <p>
          Welcome back, {user?.fullName || "team member"}. This dashboard is the live working layer of the
          SR-AIIMS HMS and now includes patient flow, OPD consultation, lab and billing hooks, plus pharmacy
          and inventory control, with a working billing desk for payments and invoices.
        </p>
      </section>

      {isAdmin && summary ? (
        <section className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Today's Summary</div>
              <h3>Operations for {summary.date}</h3>
            </div>
          </div>
          <div className="stat-grid">
            <StatCard label="Total OPD Patients" value={String(summary.opdPatients)} note="OPD visits today" />
            <StatCard label="Total IPD Patients" value={String(summary.ipdPatients)} note="Currently admitted" />
            <StatCard label="New Registrations" value={String(summary.newRegistrations)} note="Registered today" />
            <StatCard label="Follow-up Patients" value={String(summary.followUpPatients)} note="Follow-up appointments" />
            <StatCard label="Today's Appointments" value={String(summary.todaysAppointments)} note="Excludes cancelled" />
            <StatCard label="Discharged Patients" value={String(summary.dischargedPatients)} note="Discharged today" />
            <StatCard label="Emergency Cases" value={String(summary.emergencyCases)} note="Emergency appointments" />
            <StatCard label="Total Revenue Today" value={`Rs. ${formatCurrency(summary.revenueToday)}`} note="Billed today" />
            <StatCard label="Pending Payments" value={`Rs. ${formatCurrency(summary.pendingPayments)}`} note="Total outstanding" />
            <StatCard
              label="Collection Today"
              value={`Rs. ${formatCurrency(summary.collectedToday)}`}
              note={`Cash ${formatCurrency(summary.collectionByMode?.cash)} · UPI ${formatCurrency(summary.collectionByMode?.upi)} · Card ${formatCurrency(summary.collectionByMode?.card)}`}
            />
          </div>
        </section>
      ) : null}

      <section className="stat-grid">
        <StatCard label="Phase" value="06" note="Billing desk and payments live" />
        <StatCard label="Role" value={user?.role || "guest"} note="RBAC-aware shell active" />
        <StatCard
          label="Modules Ready"
          value={String(overview?.modulesReady?.length || 9)}
          note="Auth, patients, appointments, opd, lab, billing, pharmacy, inventory"
        />
        <StatCard label="Next Sprint" value="07" note="IPD admissions and bed flow" />
      </section>

      <section className="content-grid">
        <article className="content-card">
          <h3>Build Timeline</h3>
          {timeline.map((item) => (
            <div className="timeline-item" key={item.time}>
              <div className="timeline-time">{item.time}</div>
              <div>
                <strong>{item.title}</strong>
                <div className="timeline-copy">{item.copy}</div>
              </div>
            </div>
          ))}
        </article>

        <aside className="content-card">
          <h3>Quick Notes</h3>
          <div className="quick-actions">
            {quickActions.map((item) => (
              <div className="quick-action" key={item.title}>
                <strong>{item.title}</strong>
                <div className="timeline-copy">{item.copy}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </DashboardLayout>
  );
}
