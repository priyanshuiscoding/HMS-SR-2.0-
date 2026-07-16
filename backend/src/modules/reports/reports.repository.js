import { query } from "../../config/postgres.js";
import { toTime } from "../../utils/dateTime.js";

function toNumber(value) {
  return Number(value || 0);
}

function firstRow(result) {
  return result.rows[0] || {};
}

export async function getOverviewReadModel({ dateFrom, dateTo }) {
  const [opd, ipd, bills, payments, lab, panchkarma] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM opd_visits WHERE visit_date BETWEEN $1 AND $2", [dateFrom, dateTo]),
    query("SELECT COUNT(*)::int AS count FROM ipd_admissions WHERE admission_date BETWEEN $1 AND $2", [dateFrom, dateTo]),
    query("SELECT COALESCE(SUM(total_amount), 0) AS amount FROM bills WHERE bill_date BETWEEN $1 AND $2", [dateFrom, dateTo]),
    query("SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE payment_date::date BETWEEN $1 AND $2", [dateFrom, dateTo]),
    query("SELECT COUNT(*)::int AS count FROM lab_orders WHERE order_date BETWEEN $1 AND $2", [dateFrom, dateTo]),
    query("SELECT COUNT(*)::int AS count FROM panchkarma_sessions WHERE scheduled_date BETWEEN $1 AND $2", [dateFrom, dateTo])
  ]);

  return {
    opdVisits: Number(firstRow(opd).count || 0),
    ipdAdmissions: Number(firstRow(ipd).count || 0),
    revenue: toNumber(firstRow(bills).amount),
    collections: toNumber(firstRow(payments).amount),
    labOrders: Number(firstRow(lab).count || 0),
    panchkarmaSessions: Number(firstRow(panchkarma).count || 0)
  };
}

export async function getDashboardSummaryReadModel(reportDate) {
  const [opd, ipd, registrations, appointments, revenue, modes] = await Promise.all([
    query(
      "SELECT COUNT(*)::int AS count FROM opd_visits WHERE visit_date = $1",
      [reportDate]
    ),
    query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM ipd_admissions WHERE status = 'active') AS active_ipd,
        (
          SELECT COUNT(*)::int
          FROM ipd_admissions
          WHERE status = 'discharged'
            AND COALESCE(discharge_summary->>'dischargeDate', '') = $1::text
        ) AS discharged_today
      `,
      [reportDate]
    ),
    query(
      "SELECT COUNT(*)::int AS count FROM patients WHERE registration_date = $1 AND deleted_at IS NULL",
      [reportDate]
    ),
    query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE type = 'new')::int AS new_visits,
        COUNT(*) FILTER (WHERE type = 'follow_up')::int AS follow_up,
        COUNT(*) FILTER (WHERE type = 'emergency')::int AS emergency
      FROM appointments
      WHERE appointment_date = $1 AND status <> 'cancelled'
      `,
      [reportDate]
    ),
    query(
      `
      SELECT
        (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE bill_date = $1) AS revenue_today,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date::date = $1) AS collected_today,
        (
          SELECT COALESCE(SUM(GREATEST(b.total_amount - GREATEST(COALESCE(p.paid, 0) - COALESCE(r.refunded, 0), 0), 0)), 0)
          FROM bills b
          LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM payments GROUP BY bill_id) p ON p.bill_id = b.id
          LEFT JOIN (SELECT bill_id, SUM(amount) AS refunded FROM refunds GROUP BY bill_id) r ON r.bill_id = b.id
        ) AS pending_total
      `,
      [reportDate]
    ),
    query(
      `
      SELECT payment_mode, COALESCE(SUM(amount), 0) AS amount
      FROM payments
      WHERE payment_date::date = $1
      GROUP BY payment_mode
      `,
      [reportDate]
    )
  ]);

  const ipdRow = firstRow(ipd);
  const apptRow = firstRow(appointments);
  const revenueRow = firstRow(revenue);

  const collectionByMode = { cash: 0, upi: 0, card: 0, other: 0 };
  for (const row of modes.rows) {
    const mode = String(row.payment_mode || "").toLowerCase();
    const amount = toNumber(row.amount);
    if (mode === "cash" || mode === "upi" || mode === "card") {
      collectionByMode[mode] += amount;
    } else {
      collectionByMode.other += amount;
    }
  }

  return {
    opdPatients: Number(firstRow(opd).count || 0),
    ipdPatients: Number(ipdRow.active_ipd || 0),
    dischargedPatients: Number(ipdRow.discharged_today || 0),
    newRegistrations: Number(firstRow(registrations).count || 0),
    todaysAppointments: Number(apptRow.total || 0),
    followUpPatients: Number(apptRow.follow_up || 0),
    emergencyCases: Number(apptRow.emergency || 0),
    revenueToday: toNumber(revenueRow.revenue_today),
    collectedToday: toNumber(revenueRow.collected_today),
    pendingPayments: toNumber(revenueRow.pending_total),
    collectionByMode
  };
}

export async function getDailyOpdReadModel(reportDate) {
  const [summaryResult, byDoctorResult, itemResult] = await Promise.all([
    query(
      `
      SELECT
        COUNT(*)::int AS total_visits,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_visits,
        COUNT(*) FILTER (WHERE status = 'in_consultation')::int AS in_progress_visits,
        COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting_visits,
        COALESCE(SUM(consultation_fee), 0) AS consultation_value
      FROM opd_visits
      WHERE visit_date = $1
      `,
      [reportDate]
    ),
    query(
      `
      SELECT
        COALESCE(v.doctor_id::text, '') AS doctor_id,
        COALESCE(u.full_name, 'Assigned doctor') AS doctor_name,
        COUNT(*)::int AS total_visits,
        COUNT(*) FILTER (WHERE v.status = 'completed')::int AS completed_visits,
        COUNT(*) FILTER (WHERE v.status <> 'completed')::int AS waiting_visits
      FROM opd_visits v
      LEFT JOIN users u ON u.id = v.doctor_id
      WHERE v.visit_date = $1
      GROUP BY v.doctor_id, u.full_name
      ORDER BY total_visits DESC, doctor_name ASC
      `,
      [reportDate]
    ),
    query(
      `
      SELECT
        v.opd_number,
        v.patient_name,
        COALESCE(v.doctor_id::text, '') AS doctor_id,
        a.appointment_time,
        v.chief_complaint,
        v.status,
        v.consultation_fee
      FROM opd_visits v
      LEFT JOIN appointments a ON a.id = v.appointment_id
      WHERE v.visit_date = $1
      ORDER BY a.appointment_time ASC NULLS LAST, v.created_at ASC
      `,
      [reportDate]
    )
  ]);

  const summary = firstRow(summaryResult);
  return {
    summary: {
      totalVisits: Number(summary.total_visits || 0),
      completedVisits: Number(summary.completed_visits || 0),
      inProgressVisits: Number(summary.in_progress_visits || 0),
      waitingVisits: Number(summary.waiting_visits || 0),
      consultationValue: toNumber(summary.consultation_value)
    },
    byDoctor: byDoctorResult.rows.map((row) => ({
      doctorId: row.doctor_id || "",
      doctorName: row.doctor_name || "Assigned doctor",
      totalVisits: Number(row.total_visits || 0),
      completedVisits: Number(row.completed_visits || 0),
      waitingVisits: Number(row.waiting_visits || 0)
    })),
    items: itemResult.rows.map((row) => ({
      opdNumber: row.opd_number,
      patientName: row.patient_name,
      doctorId: row.doctor_id || "",
      appointmentTime: toTime(row.appointment_time),
      chiefComplaint: row.chief_complaint || "General consultation",
      status: row.status,
      consultationFee: toNumber(row.consultation_fee)
    }))
  };
}

export async function getIpdCensusReadModel(reportDate) {
  const [summaryResult, activeResult, roomResult] = await Promise.all([
    query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM ipd_admissions WHERE status = 'active') AS active_admissions,
        (SELECT COUNT(*)::int FROM ipd_admissions WHERE admission_date = $1) AS admissions_today,
        (
          SELECT COUNT(*)::int
          FROM ipd_admissions
          WHERE status = 'discharged'
            AND COALESCE(discharge_summary->>'dischargeDate', '') = $1::text
        ) AS discharges_today,
        (SELECT COUNT(*)::int FROM beds) AS total_beds,
        (SELECT COUNT(*)::int FROM beds WHERE status = 'occupied') AS occupied_beds
      `,
      [reportDate]
    ),
    query(
      `
      SELECT
        a.admission_number,
        a.patient_name,
        r.room_number,
        b.bed_number,
        a.diagnosis,
        a.expected_discharge_date
      FROM ipd_admissions a
      LEFT JOIN rooms r ON r.id = a.room_id
      LEFT JOIN beds b ON b.id = a.bed_id
      WHERE a.status = 'active'
      ORDER BY a.admission_date ASC, a.admission_time ASC
      `
    ),
    query(
      `
      SELECT
        r.id AS room_id,
        r.room_number,
        r.ward,
        COUNT(b.id)::int AS total_beds,
        COUNT(b.id) FILTER (WHERE b.status = 'occupied')::int AS occupied_beds,
        COUNT(b.id) FILTER (WHERE b.status = 'available')::int AS available_beds,
        COUNT(b.id) FILTER (WHERE b.status IN ('cleaning', 'maintenance'))::int AS blocked_beds
      FROM rooms r
      LEFT JOIN beds b ON b.room_id = r.id
      WHERE r.deleted_at IS NULL
      GROUP BY r.id, r.room_number, r.ward
      ORDER BY r.room_number ASC
      `
    )
  ]);

  const summary = firstRow(summaryResult);
  return {
    summary: {
      activeAdmissions: Number(summary.active_admissions || 0),
      admissionsToday: Number(summary.admissions_today || 0),
      dischargesToday: Number(summary.discharges_today || 0),
      totalBeds: Number(summary.total_beds || 0),
      occupiedBeds: Number(summary.occupied_beds || 0)
    },
    activePatients: activeResult.rows.map((row) => ({
      admissionNumber: row.admission_number,
      patientName: row.patient_name,
      room: row.room_number || "",
      bed: row.bed_number || "",
      diagnosis: row.diagnosis || "",
      expectedDischargeDate: row.expected_discharge_date ? String(row.expected_discharge_date).slice(0, 10) : ""
    })),
    roomCensus: roomResult.rows.map((row) => {
      const totalBeds = Number(row.total_beds || 0);
      const occupiedBeds = Number(row.occupied_beds || 0);

      return {
        roomId: row.room_id,
        roomNumber: row.room_number,
        ward: row.ward,
        totalBeds,
        occupiedBeds,
        availableBeds: Number(row.available_beds || 0),
        blockedBeds: Number(row.blocked_beds || 0),
        occupancyPercent: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0
      };
    })
  };
}

export async function getRevenueReadModel({ dateFrom, dateTo }) {
  const [summaryResult, byTypeResult, byModeResult] = await Promise.all([
    query(
      `
      WITH bill_totals AS (
        SELECT
          b.id,
          b.total_amount,
          COALESCE(p.paid_amount, 0) AS paid_amount,
          COALESCE(r.refund_amount, 0) AS refund_amount
        FROM bills b
        LEFT JOIN (
          SELECT bill_id, SUM(amount) AS paid_amount
          FROM payments
          GROUP BY bill_id
        ) p ON p.bill_id = b.id
        LEFT JOIN (
          SELECT bill_id, SUM(amount) AS refund_amount
          FROM refunds
          GROUP BY bill_id
        ) r ON r.bill_id = b.id
        WHERE b.bill_date BETWEEN $1 AND $2
      )
      SELECT
        COUNT(*)::int AS total_bills,
        COALESCE(SUM(total_amount), 0) AS total_billed,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE payment_date::date BETWEEN $1 AND $2
        ) AS total_collected,
        COALESCE(SUM(GREATEST(total_amount - GREATEST(paid_amount - refund_amount, 0), 0)), 0) AS outstanding
      FROM bill_totals
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      WITH payment_totals AS (
        SELECT bill_id, SUM(amount) AS paid_amount
        FROM payments
        GROUP BY bill_id
      ),
      refund_totals AS (
        SELECT bill_id, SUM(amount) AS refund_amount
        FROM refunds
        GROUP BY bill_id
      )
      SELECT
        b.bill_type,
        COUNT(*)::int AS bills,
        COALESCE(SUM(b.total_amount), 0) AS total_amount,
        COALESCE(SUM(GREATEST(COALESCE(p.paid_amount, 0) - COALESCE(r.refund_amount, 0), 0)), 0) AS paid_amount
      FROM bills b
      LEFT JOIN payment_totals p ON p.bill_id = b.id
      LEFT JOIN refund_totals r ON r.bill_id = b.id
      WHERE b.bill_date BETWEEN $1 AND $2
      GROUP BY b.bill_type
      ORDER BY total_amount DESC
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      SELECT
        payment_mode,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount), 0) AS amount
      FROM payments
      WHERE payment_date::date BETWEEN $1 AND $2
      GROUP BY payment_mode
      ORDER BY amount DESC
      `,
      [dateFrom, dateTo]
    )
  ]);

  const summary = firstRow(summaryResult);
  return {
    summary: {
      totalBills: Number(summary.total_bills || 0),
      totalBilled: toNumber(summary.total_billed),
      totalCollected: toNumber(summary.total_collected),
      outstanding: toNumber(summary.outstanding)
    },
    byType: byTypeResult.rows.map((row) => ({
      billType: row.bill_type,
      bills: Number(row.bills || 0),
      totalAmount: toNumber(row.total_amount),
      paidAmount: toNumber(row.paid_amount)
    })),
    byMode: byModeResult.rows.map((row) => ({
      paymentMode: row.payment_mode,
      count: Number(row.count || 0),
      amount: toNumber(row.amount)
    }))
  };
}

export async function getPharmacySalesReadModel({ dateFrom, dateTo }) {
  const [summaryResult, medicineResult] = await Promise.all([
    query(
      `
      SELECT
        COUNT(DISTINCT d.id)::int AS prescriptions_dispensed,
        COALESCE(SUM(i.amount), 0) AS sales_amount,
        COUNT(i.id)::int AS medicine_lines
      FROM dispensations d
      LEFT JOIN dispensation_items i ON i.dispensation_id = d.id
      WHERE d.dispensed_date::date BETWEEN $1 AND $2
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      SELECT
        COALESCE(i.medicine_id::text, i.metadata->>'sourceMedicineId', '') AS medicine_id,
        i.medicine_name,
        COALESCE(SUM(i.quantity), 0) AS quantity,
        COALESCE(SUM(i.amount), 0) AS amount
      FROM dispensations d
      JOIN dispensation_items i ON i.dispensation_id = d.id
      WHERE d.dispensed_date::date BETWEEN $1 AND $2
      GROUP BY COALESCE(i.medicine_id::text, i.metadata->>'sourceMedicineId', ''), i.medicine_name
      ORDER BY amount DESC
      `,
      [dateFrom, dateTo]
    )
  ]);

  const summary = firstRow(summaryResult);
  return {
    summary: {
      prescriptionsDispensed: Number(summary.prescriptions_dispensed || 0),
      salesAmount: toNumber(summary.sales_amount),
      medicineLines: Number(summary.medicine_lines || 0)
    },
    byMedicine: medicineResult.rows.map((row) => ({
      medicineId: row.medicine_id || "",
      medicineName: row.medicine_name,
      quantity: toNumber(row.quantity),
      amount: toNumber(row.amount)
    }))
  };
}

export async function getLabWorkloadReadModel({ dateFrom, dateTo }) {
  const [summaryResult, statusResult, testResult] = await Promise.all([
    query(
      `
      SELECT
        COUNT(DISTINCT o.id)::int AS total_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'reported')::int AS reported_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('pending', 'sample_collected', 'processing'))::int AS pending_orders,
        COUNT(t.id)::int AS test_lines
      FROM lab_orders o
      LEFT JOIN lab_order_tests t ON t.order_id = o.id
      WHERE o.order_date BETWEEN $1 AND $2
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      SELECT status, COUNT(*)::int AS count
      FROM lab_orders
      WHERE order_date BETWEEN $1 AND $2
      GROUP BY status
      ORDER BY count DESC
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      SELECT
        COALESCE(t.test_id::text, t.metadata->>'sourceTestId', '') AS test_id,
        t.test_name,
        COUNT(*)::int AS count
      FROM lab_orders o
      JOIN lab_order_tests t ON t.order_id = o.id
      WHERE o.order_date BETWEEN $1 AND $2
      GROUP BY COALESCE(t.test_id::text, t.metadata->>'sourceTestId', ''), t.test_name
      ORDER BY count DESC, t.test_name ASC
      `,
      [dateFrom, dateTo]
    )
  ]);

  const summary = firstRow(summaryResult);
  return {
    summary: {
      totalOrders: Number(summary.total_orders || 0),
      reportedOrders: Number(summary.reported_orders || 0),
      pendingOrders: Number(summary.pending_orders || 0),
      testLines: Number(summary.test_lines || 0)
    },
    byStatus: statusResult.rows.map((row) => ({
      status: row.status,
      count: Number(row.count || 0)
    })),
    byTest: testResult.rows.map((row) => ({
      testId: row.test_id || "",
      testName: row.test_name,
      count: Number(row.count || 0)
    }))
  };
}

export async function getPanchkarmaStatsReadModel({ dateFrom, dateTo }) {
  const [summaryResult, therapyResult, therapistResult] = await Promise.all([
    query(
      `
      SELECT
        COUNT(*)::int AS total_sessions,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_sessions,
        COUNT(*) FILTER (WHERE status <> 'completed')::int AS pending_sessions,
        COALESCE(SUM(billed_amount), 0) AS total_billed
      FROM panchkarma_sessions
      WHERE scheduled_date BETWEEN $1 AND $2
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      SELECT
        COALESCE(therapy_id::text, metadata->>'sourceTherapyId', '') AS therapy_id,
        therapy_name,
        COUNT(*)::int AS sessions,
        COALESCE(SUM(billed_amount), 0) AS billed_amount
      FROM panchkarma_sessions
      WHERE scheduled_date BETWEEN $1 AND $2
      GROUP BY COALESCE(therapy_id::text, metadata->>'sourceTherapyId', ''), therapy_name
      ORDER BY sessions DESC, therapy_name ASC
      `,
      [dateFrom, dateTo]
    ),
    query(
      `
      SELECT
        COALESCE(therapist_id::text, metadata->>'sourceTherapistId', '') AS therapist_id,
        therapist_name,
        COUNT(*)::int AS sessions
      FROM panchkarma_sessions
      WHERE scheduled_date BETWEEN $1 AND $2
      GROUP BY COALESCE(therapist_id::text, metadata->>'sourceTherapistId', ''), therapist_name
      ORDER BY sessions DESC, therapist_name ASC
      `,
      [dateFrom, dateTo]
    )
  ]);

  const summary = firstRow(summaryResult);
  return {
    summary: {
      totalSessions: Number(summary.total_sessions || 0),
      completedSessions: Number(summary.completed_sessions || 0),
      pendingSessions: Number(summary.pending_sessions || 0),
      totalBilled: toNumber(summary.total_billed)
    },
    byTherapy: therapyResult.rows.map((row) => ({
      therapyId: row.therapy_id || "",
      therapyName: row.therapy_name,
      sessions: Number(row.sessions || 0),
      billedAmount: toNumber(row.billed_amount)
    })),
    byTherapist: therapistResult.rows.map((row) => ({
      therapistId: row.therapist_id || "",
      therapistName: row.therapist_name,
      sessions: Number(row.sessions || 0)
    }))
  };
}
