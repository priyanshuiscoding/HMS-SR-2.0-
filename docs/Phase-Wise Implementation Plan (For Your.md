Phase-Wise Implementation Plan (For Your New HMS Update Model)

Phase 0: Freeze Scope and Rules (2-3 days)
Finalize hospital-approved workflows for Therapy, Yoga, Follow-up, and Department Inventory.
Freeze billing rules for Yoga monthly plans, package logic, and therapy billing.
Freeze slot rules including male/female separation where needed.
Output: signed MVP scope + field list + SOP mapping document.
Phase 1: Data Model Upgrade (4-6 days)
Add normalized tables for:
therapy_plans, therapy_slots, therapy_assignment_logs
yoga_batches, yoga_enrollments, yoga_attendance, yoga_sessions
department_inventory_ledger, department_issues
followup_tasks, followup_outcomes
Keep current modules running with backward-compatible migration.
Output: migration scripts + seed + rollback scripts.
Phase 2: Core Therapy Workflow Completion (5-7 days)
Add full “Diagnosis → Therapy Plan → Slot Allocation → Therapist Assignment → Daily Execution”.
Add male/female slot partition support.
Add Therapy Plan lifecycle states: draft / active / completed / paused.
Output: APIs + UI screens + validation for overlap/capacity.
Phase 3: Yoga Module (6-8 days)
Build Yoga flow end-to-end:
Registration link to patient
Batch assignment and private session handling
Daily attendance marking
Monthly billing auto-generation
Output: Yoga management dashboard + batch calendar + billing integration.
Phase 4: Department Inventory Layer (4-6 days)
Add department-wise stock issue and consumption tracking.
Add low-stock and expiry alerts at department level.
Add inventory reports by department, item, period.
Output: Department inventory screen + alert panel + reports.
Phase 5: Follow-up and SOP Enforcement (3-5 days)
Add dedicated Follow-up module (not just follow-up field).
SOP role actions:
Reception: register/appoint/bill
Doctor: diagnosis/plan/prescribe
Therapist: execute/update
Yoga trainer: attendance/batch handling
Pharmacy/admin: stock/report governance
Output: RBAC policy refinement + audit trail for critical actions.
Phase 6: Reporting & Analytics Alignment (4-5 days)
Expand reports to include:
Therapy utilization, therapist productivity
Yoga batch attendance and monthly revenue
Department inventory movement and wastage
Follow-up conversion/completion metrics
Output: Reports dashboard matching hospital intake sheet.
Phase 7: Stabilization, UAT, and Go-Live (5-7 days)
End-to-end scenario testing:
OPD to therapy billing
Yoga monthly cycle
Inventory purchase-to-usage-to-alert
Fix blockers, run role-based UAT, train staff.
Output: production readiness checklist + signoff.