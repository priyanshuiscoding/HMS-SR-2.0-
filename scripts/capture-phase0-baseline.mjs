import { pgPool, query } from "../backend/src/config/postgres.js";

const countTargets = [
  ["patients", "patients"],
  ["appointments", "appointments"],
  ["opdVisits", "opd_visits"],
  ["prescriptions", "prescriptions"],
  ["generalExaminations", "opd_general_examinations"],
  ["systemicExaminations", "opd_systemic_examinations"],
  ["historyTaking", "opd_history_taking"],
  ["labOrders", "lab_orders"],
  ["bills", "bills"],
  ["payments", "payments"],
  ["patientDocuments", "patient_documents"],
  ["ipdAdmissions", "ipd_admissions"],
  ["panchkarmaSessions", "panchkarma_sessions"]
];

const patientLinkedTables = [
  "appointments",
  "opd_visits",
  "prescriptions",
  "opd_general_examinations",
  "opd_systemic_examinations",
  "opd_history_taking",
  "lab_orders",
  "bills",
  "payments",
  "patient_documents",
  "ipd_admissions",
  "panchkarma_sessions"
];

try {
  const identityResult = await query(
    "SELECT current_database() AS database, inet_server_addr()::text AS server_address, inet_server_port() AS server_port, current_user AS database_user, current_setting('server_version') AS server_version"
  );
  const patientResult = await query(
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS archived FROM patients"
  );
  const counts = {};
  for (const [label, table] of countTargets) {
    const result = await query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    counts[label] = result.rows[0].count;
  }
  const orphanedPatientReferences = {};
  for (const table of patientLinkedTables) {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM ${table} AS linked
       WHERE linked.patient_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM patients AS patient WHERE patient.id = linked.patient_id)`
    );
    orphanedPatientReferences[table] = result.rows[0].count;
  }
  const migrations = await query("SELECT COUNT(*)::int AS count, MAX(applied_at) AS latest_applied_at FROM schema_migrations");
  console.log(JSON.stringify({
    capturedAt: new Date().toISOString(),
    identity: identityResult.rows[0],
    patients: patientResult.rows[0],
    counts,
    orphanedPatientReferences,
    migrations: migrations.rows[0]
  }, null, 2));
} finally {
  await pgPool.end();
}
