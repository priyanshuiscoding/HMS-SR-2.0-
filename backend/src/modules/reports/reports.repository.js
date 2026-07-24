import { query } from "../../config/postgres.js";
import { toTime } from "../../utils/dateTime.js";

function toNumber(value) {
  return Number(value || 0);
}

function firstRow(result) {
  return result.rows[0] || {};
}

function toReportDate(value) {
  if (!value) return "";
  if (!(value instanceof Date)) return String(value).slice(0, 10);

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDailyHospitalReport(row) {
  if (!row) return null;

  return {
    id: row.id,
    date: toReportDate(row.report_date),
    opdPatients: Number(row.opd_patients || 0),
    ipdPatients: Number(row.ipd_patients || 0),
    ipdAdmissions: Number(row.ipd_admissions || 0),
    newRegistrations: Number(row.new_registrations || 0),
    followUpPatients: Number(row.follow_up_patients || 0),
    todaysAppointments: Number(row.appointments || 0),
    dischargedPatients: Number(row.discharged_patients || 0),
    emergencyCases: Number(row.emergency_cases || 0),
    panchkarmaSessions: Number(row.panchkarma_sessions || 0),
    labOrders: Number(row.lab_orders || 0),
    pharmacyDispensations: Number(row.pharmacy_dispensations || 0),
    billsGenerated: Number(row.bills_generated || 0),
    revenueToday: toNumber(row.revenue_amount),
    collectedToday: toNumber(row.collected_amount),
    pendingPayments: toNumber(row.pending_amount),
    collectionByMode: {
      cash: toNumber(row.cash_collection),
      upi: toNumber(row.upi_collection),
      card: toNumber(row.card_collection),
      other: toNumber(row.other_collection)
    },
    employees: {
      total: Number(row.employees_total || 0),
      present: Number(row.employees_present || 0),
      absent: Number(row.employees_absent || 0),
      onLeave: Number(row.employees_on_leave || 0),
      halfDay: Number(row.employees_half_day || 0)
    },
    metadata: row.metadata || {},
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
  return upsertDailyHospitalReportRecord(reportDate);
}

export async function upsertDailyHospitalReportRecord(reportDate, executeQuery = query) {
  const result = await executeQuery(
    `
    WITH payment_totals AS (
      SELECT bill_id, SUM(amount) AS paid FROM payments GROUP BY bill_id
    ),
    refund_totals AS (
      SELECT bill_id, SUM(amount) AS refunded FROM refunds GROUP BY bill_id
    ),
    current_pending AS (
      SELECT COALESCE(
        SUM(GREATEST(b.total_amount - GREATEST(COALESCE(p.paid, 0) - COALESCE(r.refunded, 0), 0), 0)),
        0
      ) AS amount
      FROM bills b
      LEFT JOIN payment_totals p ON p.bill_id = b.id
      LEFT JOIN refund_totals r ON r.bill_id = b.id
    ),
    emergency_patients AS (
      SELECT COALESCE(patient_id::text, id::text) AS case_key
      FROM appointments
      WHERE appointment_date = $1 AND status <> 'cancelled' AND type = 'emergency'
      UNION
      SELECT COALESCE(patient_id::text, id::text) AS case_key
      FROM ipd_admissions
      WHERE admission_date = $1 AND status <> 'cancelled' AND admission_source = 'emergency'
    ),
    employees_on_leave AS (
      SELECT a.user_id
      FROM staff_attendance a
      JOIN users u ON u.id = a.user_id
      WHERE a.attendance_date = $1 AND a.status = 'leave' AND u.deleted_at IS NULL AND u.is_active = true
      UNION
      SELECT l.user_id
      FROM hr_leave_requests l
      JOIN users u ON u.id = l.user_id
      WHERE l.status = 'approved'
        AND $1::date BETWEEN l.start_date AND l.end_date
        AND u.deleted_at IS NULL
        AND u.is_active = true
    )
    INSERT INTO daily_hospital_reports (
      report_date, opd_patients, ipd_patients, ipd_admissions, new_registrations,
      follow_up_patients, appointments, discharged_patients, emergency_cases,
      panchkarma_sessions, lab_orders, pharmacy_dispensations, bills_generated,
      revenue_amount, collected_amount, pending_amount,
      cash_collection, upi_collection, card_collection, other_collection,
      employees_total, employees_present, employees_absent, employees_on_leave, employees_half_day,
      metadata, captured_at
    )
    SELECT
      $1::date,
      (SELECT COUNT(*)::int FROM opd_visits WHERE visit_date = $1 AND status <> 'cancelled'),
      (SELECT COUNT(*)::int FROM ipd_admissions WHERE status = 'active'),
      (SELECT COUNT(*)::int FROM ipd_admissions WHERE admission_date = $1 AND status <> 'cancelled'),
      (SELECT COUNT(*)::int FROM patients WHERE registration_date = $1 AND deleted_at IS NULL),
      (SELECT COUNT(*)::int FROM appointments WHERE appointment_date = $1 AND status <> 'cancelled' AND type = 'follow_up'),
      (SELECT COUNT(*)::int FROM appointments WHERE appointment_date = $1 AND status <> 'cancelled'),
      (
        SELECT COUNT(*)::int
        FROM ipd_admissions
        WHERE status = 'discharged' AND COALESCE(discharge_summary->>'dischargeDate', '') = $1::text
      ),
      (SELECT COUNT(*)::int FROM emergency_patients),
      (SELECT COUNT(*)::int FROM panchkarma_sessions WHERE scheduled_date = $1 AND status <> 'cancelled'),
      (SELECT COUNT(*)::int FROM lab_orders WHERE order_date = $1 AND status <> 'cancelled'),
      (SELECT COUNT(*)::int FROM dispensations WHERE dispensed_date::date = $1 AND status = 'completed'),
      (SELECT COUNT(*)::int FROM bills WHERE bill_date = $1),
      (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE bill_date = $1),
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date::date = $1),
      (SELECT amount FROM current_pending),
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date::date = $1 AND LOWER(payment_mode) = 'cash'),
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date::date = $1 AND LOWER(payment_mode) = 'upi'),
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date::date = $1 AND LOWER(payment_mode) = 'card'),
      (
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE payment_date::date = $1 AND LOWER(payment_mode) NOT IN ('cash', 'upi', 'card')
      ),
      (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND is_active = true),
      (
        SELECT COUNT(*)::int
        FROM staff_attendance a JOIN users u ON u.id = a.user_id
        WHERE a.attendance_date = $1 AND a.status = 'present' AND u.deleted_at IS NULL AND u.is_active = true
      ),
      (
        SELECT COUNT(*)::int
        FROM staff_attendance a JOIN users u ON u.id = a.user_id
        WHERE a.attendance_date = $1 AND a.status = 'absent' AND u.deleted_at IS NULL AND u.is_active = true
      ),
      (SELECT COUNT(*)::int FROM employees_on_leave),
      (
        SELECT COUNT(*)::int
        FROM staff_attendance a JOIN users u ON u.id = a.user_id
        WHERE a.attendance_date = $1 AND a.status = 'half_day' AND u.deleted_at IS NULL AND u.is_active = true
      ),
      jsonb_build_object('source', 'live_hms_transactions', 'version', 1),
      NOW()
    ON CONFLICT (report_date) DO UPDATE
    SET opd_patients = EXCLUDED.opd_patients,
        ipd_patients = EXCLUDED.ipd_patients,
        ipd_admissions = EXCLUDED.ipd_admissions,
        new_registrations = EXCLUDED.new_registrations,
        follow_up_patients = EXCLUDED.follow_up_patients,
        appointments = EXCLUDED.appointments,
        discharged_patients = EXCLUDED.discharged_patients,
        emergency_cases = EXCLUDED.emergency_cases,
        panchkarma_sessions = EXCLUDED.panchkarma_sessions,
        lab_orders = EXCLUDED.lab_orders,
        pharmacy_dispensations = EXCLUDED.pharmacy_dispensations,
        bills_generated = EXCLUDED.bills_generated,
        revenue_amount = EXCLUDED.revenue_amount,
        collected_amount = EXCLUDED.collected_amount,
        pending_amount = EXCLUDED.pending_amount,
        cash_collection = EXCLUDED.cash_collection,
        upi_collection = EXCLUDED.upi_collection,
        card_collection = EXCLUDED.card_collection,
        other_collection = EXCLUDED.other_collection,
        employees_total = EXCLUDED.employees_total,
        employees_present = EXCLUDED.employees_present,
        employees_absent = EXCLUDED.employees_absent,
        employees_on_leave = EXCLUDED.employees_on_leave,
        employees_half_day = EXCLUDED.employees_half_day,
        metadata = daily_hospital_reports.metadata || EXCLUDED.metadata,
        captured_at = NOW()
    RETURNING *
    `,
    [reportDate]
  );

  return toDailyHospitalReport(result.rows[0]);
}

export async function listDailyHospitalReportRecords({ dateFrom, dateTo, limit = 31 } = {}) {
  const params = [];
  const conditions = ["1 = 1"];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`report_date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`report_date <= $${params.length}`);
  }

  params.push(Math.min(Math.max(Number(limit) || 31, 1), 366));
  const result = await query(
    `
    SELECT *
    FROM daily_hospital_reports
    WHERE ${conditions.join(" AND ")}
    ORDER BY report_date DESC
    LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map(toDailyHospitalReport);
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
