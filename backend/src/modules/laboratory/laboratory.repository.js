import { query, withTransaction } from "../../config/postgres.js";
import { toIsoDate, toIsoDateTime } from "../../utils/dateTime.js";
import { nullableUuid } from "../../utils/ids.js";

function toNumber(value) {
  return Number(value || 0);
}

async function existingUuid(client, tableName, value) {
  const id = nullableUuid(value);
  if (!id) return null;

  const result = await client.query(`SELECT id FROM ${tableName} WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0]?.id || null;
}

function toCamelTestMaster(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    department: row.department || "",
    price: toNumber(row.price),
    normalRange: row.normal_range || "",
    unit: row.unit || "",
    isActive: Boolean(row.is_active),
    metadata: row.metadata || {}
  };
}

function toCamelOrderTest(row) {
  return {
    id: row.id,
    testId: row.metadata?.sourceTestId || row.test_id || "",
    testName: row.test_name,
    code: row.code || "",
    department: row.department || "",
    normalRange: row.normal_range || "",
    result: row.result || "",
    remarks: row.remarks || "",
    resultFlag: row.result_flag || "normal",
    status: row.status || "pending",
    completedAt: toIsoDateTime(row.completed_at),
    metadata: row.metadata || {}
  };
}

function toCamelPatient(row) {
  if (!row) return null;

  return {
    ...row,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    fullName: row.full_name || row.patient_name || "",
    dateOfBirth: toIsoDate(row.date_of_birth),
    ageYears: row.age_years,
    bloodGroup: row.blood_group || "",
    altPhone: row.alt_phone || "",
    houseStreet: row.house_street || "",
    areaVillage: row.area_village || "",
    idType: row.id_type || "",
    emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "",
    registrationDate: toIsoDate(row.registration_date)
  };
}

function toCamelVisit(row) {
  if (!row) return null;

  return {
    ...row,
    opdNumber: row.opd_number,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    doctorId: row.doctor_id || "",
    appointmentId: row.appointment_id || "",
    visitDate: toIsoDate(row.visit_date),
    visitType: row.visit_type || "new",
    chiefComplaint: row.chief_complaint || "",
    consultationFee: toNumber(row.consultation_fee)
  };
}

function toCamelBill(row) {
  if (!row) return null;

  return {
    ...row,
    billNumber: row.bill_number,
    patientId: row.patient_id || "",
    patientName: row.patient_name,
    visitId: row.visit_id || "",
    billType: row.bill_type,
    billDate: toIsoDate(row.bill_date),
    totalAmount: toNumber(row.total_amount),
    paymentStatus: row.payment_status
  };
}

function toCamelOrder(row, tests = [], patient = null, visit = null, bill = null) {
  if (!row) return null;

  return {
    id: row.id,
    orderNumber: row.order_number,
    patientId: row.patient_id || row.metadata?.sourcePatientId || "",
    patientName: row.patient_name,
    orderedBy: row.ordered_by || row.metadata?.sourceOrderedBy || "",
    visitId: row.visit_id || row.metadata?.sourceVisitId || "",
    orderDate: toIsoDate(row.order_date),
    priority: row.priority,
    status: row.status,
    tests,
    reportUrl: row.report_url || "",
    sampleCollectionTime: toIsoDateTime(row.sample_collection_time),
    sampleCollectedBy: row.sample_collected_by || row.metadata?.sourceSampleCollectedBy || "",
    sampleType: row.sample_type || "",
    collectionNote: row.collection_note || "",
    processingSummary: row.processing_summary || "",
    completedTests: Number(row.completed_tests || 0),
    reportedAt: toIsoDateTime(row.reported_at),
    reportedBy: row.reported_by || row.metadata?.sourceReportedBy || "",
    billId: row.bill_id || "",
    patient: toCamelPatient(patient),
    visit: toCamelVisit(visit),
    bill: toCamelBill(bill),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadOrderBundle(client, orderId) {
  const orderResult = await client.query(
    `
    SELECT
      lo.*,
      to_jsonb(p.*) AS patient_json,
      to_jsonb(ov.*) AS visit_json,
      to_jsonb(b.*) AS bill_json
    FROM lab_orders lo
    LEFT JOIN patients p ON p.id = lo.patient_id
    LEFT JOIN opd_visits ov ON ov.id = lo.visit_id
    LEFT JOIN bills b ON b.id = lo.bill_id
    WHERE lo.id = $1
    `,
    [orderId]
  );

  const row = orderResult.rows[0];
  if (!row) return null;

  const testsResult = await client.query("SELECT * FROM lab_order_tests WHERE order_id = $1 ORDER BY id", [orderId]);
  return toCamelOrder(
    row,
    testsResult.rows.map(toCamelOrderTest),
    row.patient_json,
    row.visit_json,
    row.bill_json
  );
}

export async function listLabTestRecords() {
  const result = await query("SELECT * FROM lab_test_masters WHERE is_active = true ORDER BY department, name");
  return result.rows.map(toCamelTestMaster);
}

export async function findLabTestRecord(id) {
  const uuid = nullableUuid(id);
  const result = await query(
    `
    SELECT *
    FROM lab_test_masters
    WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) OR metadata->>'sourceId' = $2
    LIMIT 1
    `,
    [uuid, id]
  );

  return toCamelTestMaster(result.rows[0]);
}

export async function findLabOrderRecord(id) {
  return withTransaction((client) => loadOrderBundle(client, id));
}

export async function listLabOrderRecords(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.patientId) {
    params.push(nullableUuid(filters.patientId));
    params.push(filters.patientId);
    conditions.push(`(lo.patient_id = $${params.length - 1}::uuid OR lo.metadata->>'sourcePatientId' = $${params.length})`);
  }
  if (filters.visitId) {
    params.push(nullableUuid(filters.visitId));
    params.push(filters.visitId);
    conditions.push(`(lo.visit_id = $${params.length - 1}::uuid OR lo.metadata->>'sourceVisitId' = $${params.length})`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`lo.status = $${params.length}`);
  }
  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`lo.priority = $${params.length}`);
  }
  if (filters.orderDate) {
    params.push(filters.orderDate);
    conditions.push(`lo.order_date = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    conditions.push(`(
      LOWER(lo.order_number) LIKE $${params.length}
      OR LOWER(lo.patient_name) LIKE $${params.length}
      OR LOWER(lo.priority) LIKE $${params.length}
      OR LOWER(lo.status) LIKE $${params.length}
      OR EXISTS (
        SELECT 1 FROM lab_order_tests lot
        WHERE lot.order_id = lo.id
          AND LOWER(lot.test_name) LIKE $${params.length}
      )
    )`);
  }

  const result = await query(
    `
    SELECT lo.id
    FROM lab_orders lo
    WHERE ${conditions.join(" AND ")}
    ORDER BY lo.order_date DESC, lo.order_number DESC
    `,
    params
  );

  const orders = [];
  for (const row of result.rows) {
    orders.push(await findLabOrderRecord(row.id));
  }

  return orders;
}

export async function getLabSummaryRecord() {
  const result = await query(
    `
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE order_date = CURRENT_DATE)::int AS today_orders,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
      COUNT(*) FILTER (WHERE status = 'sample_collected')::int AS collected_orders,
      COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_orders,
      COUNT(*) FILTER (WHERE status = 'reported')::int AS reported_orders,
      COUNT(*) FILTER (WHERE status = 'reported' AND bill_id IS NULL)::int AS pending_billing
    FROM lab_orders
    `
  );

  const row = result.rows[0] || {};
  return {
    totalOrders: Number(row.total_orders || 0),
    todayOrders: Number(row.today_orders || 0),
    pendingOrders: Number(row.pending_orders || 0),
    collectedOrders: Number(row.collected_orders || 0),
    processingOrders: Number(row.processing_orders || 0),
    reportedOrders: Number(row.reported_orders || 0),
    pendingBilling: Number(row.pending_billing || 0)
  };
}

export async function createLabOrderRecord(payload) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["lab:number"]);
    const numberResult = await client.query("SELECT COUNT(*)::int + 1 AS next_number FROM lab_orders");
    const orderNumber =
      payload.orderNumber || `LAB-${new Date().getFullYear()}-${String(numberResult.rows[0].next_number).padStart(5, "0")}`;
    const patientId = await existingUuid(client, "patients", payload.patientId);
    const visitId = await existingUuid(client, "opd_visits", payload.visitId);
    const orderedBy = await existingUuid(client, "users", payload.orderedBy);

    const orderResult = await client.query(
      `
      INSERT INTO lab_orders (
        id, order_number, patient_id, patient_name, ordered_by, visit_id, order_date,
        priority, status, report_url, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', '', $9::jsonb)
      RETURNING *
      `,
      [
        payload.id,
        orderNumber,
        patientId,
        payload.patientName,
        orderedBy,
        visitId,
        payload.orderDate,
        payload.priority || "routine",
        JSON.stringify({
          ...(payload.metadata || {}),
          sourcePatientId: payload.patientId || "",
          sourceVisitId: payload.visitId || "",
          sourceOrderedBy: payload.orderedBy || ""
        })
      ]
    );

    for (const test of payload.tests) {
      await client.query(
        `
        INSERT INTO lab_order_tests (
          id, order_id, test_id, test_name, code, department, normal_range,
          result, result_flag, remarks, status, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, '', 'normal', '', 'pending', $8::jsonb)
        `,
        [
          test.id,
          orderResult.rows[0].id,
          nullableUuid(test.testId),
          test.testName,
          test.code || "",
          test.department || "",
          test.normalRange || "",
          JSON.stringify({ ...(test.metadata || {}), sourceTestId: test.testId || "" })
        ]
      );
    }

    return loadOrderBundle(client, orderResult.rows[0].id);
  });
}

export async function collectLabSampleRecord(orderId, payload = {}) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`lab:${orderId}`]);
    const actorId = await existingUuid(client, "users", payload.sampleCollectedBy);

    const result = await client.query(
      `
      UPDATE lab_orders
      SET
        status = 'sample_collected',
        sample_collection_time = COALESCE($2::timestamptz, NOW()),
        sample_collected_by = $3,
        sample_type = $4,
        collection_note = $5,
        metadata = metadata || $6::jsonb,
        updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'sample_collected')
      RETURNING *
      `,
      [
        orderId,
        payload.sampleCollectionTime || null,
        actorId,
        payload.sampleType || "",
        payload.collectionNote || "",
        JSON.stringify({ sourceSampleCollectedBy: payload.sampleCollectedBy || "" })
      ]
    );

    if (!result.rows[0]) return null;

    await client.query("UPDATE lab_order_tests SET status = 'sample_collected' WHERE order_id = $1", [orderId]);
    return loadOrderBundle(client, orderId);
  });
}

export async function saveLabResultsRecord(orderId, payload = {}) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`lab:${orderId}`]);

    const current = await loadOrderBundle(client, orderId);
    if (!current) return null;

    const nextStatus = payload.markReported ? "reported" : "processing";
    let completedCount = 0;

    for (const test of current.tests) {
      const incoming = (payload.tests || []).find((entry) => entry.testId === test.testId || entry.testId === test.metadata?.sourceTestId);
      const nextResult = incoming?.result ?? test.result;
      const nextTestStatus = nextResult || nextStatus === "reported" ? "completed" : test.status;
      if (nextTestStatus === "completed") completedCount += 1;

      if (!incoming) continue;

      await client.query(
        `
        UPDATE lab_order_tests
        SET
          result = $2,
          remarks = $3,
          result_flag = $4,
          status = $5::varchar,
          completed_at = CASE WHEN $5::varchar = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
        WHERE id = $1
        `,
        [
          test.id,
          nextResult || "",
          incoming.remarks ?? test.remarks ?? "",
          incoming.resultFlag || test.resultFlag || "normal",
          nextTestStatus
        ]
      );
    }

    const reportedBy = await existingUuid(client, "users", payload.reportedBy);
    await client.query(
      `
      UPDATE lab_orders
      SET
        status = $2::varchar,
        reported_at = CASE WHEN $2::varchar = 'reported' THEN COALESCE(reported_at, NOW()) ELSE reported_at END,
        reported_by = $3,
        report_url = CASE WHEN $2::varchar = 'reported' THEN $4 ELSE report_url END,
        processing_summary = $5,
        completed_tests = $6,
        metadata = metadata || $7::jsonb,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        orderId,
        nextStatus,
        reportedBy,
        `/lab/reports/${current.orderNumber}`,
        payload.processingSummary || current.processingSummary || "",
        completedCount,
        JSON.stringify({ sourceReportedBy: payload.reportedBy || "" })
      ]
    );

    return loadOrderBundle(client, orderId);
  });
}

export async function linkLabBillRecord(orderId, billId) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`lab:${orderId}`]);
    const result = await client.query(
      `
      UPDATE lab_orders
      SET bill_id = $2, updated_at = NOW()
      WHERE id = $1 AND bill_id IS NULL
      RETURNING *
      `,
      [orderId, billId]
    );

    if (!result.rows[0]) return null;
    return loadOrderBundle(client, orderId);
  });
}

export async function updateLabOrderStatusRecord(orderId, payload = {}) {
  return withTransaction(async (client) => {
    const current = await loadOrderBundle(client, orderId);
    if (!current) return null;
    if (current.status === "reported" && payload.status === "cancelled") return { conflict: "reported" };

    await client.query(
      `
      UPDATE lab_orders
      SET status = $2, metadata = metadata || $3::jsonb, updated_at = NOW()
      WHERE id = $1
      `,
      [orderId, payload.status, JSON.stringify(payload.metadata || {})]
    );

    await client.query("UPDATE lab_order_tests SET status = $2 WHERE order_id = $1", [orderId, payload.status]);
    return loadOrderBundle(client, orderId);
  });
}
