# Phase 0 Requirements Freeze

Date: 2026-04-24
Status: Proposed for business sign-off
Scope type: Custom update over current HMS baseline

## 1. Flow Freeze

### 1.1 Core Patient and Therapy Flow (Approved for implementation)

Patient Registration -> OPD Consultation -> Diagnosis -> Therapy Plan Creation -> Slot Allocation -> Therapist Assignment -> Daily Therapy Execution -> Billing -> Follow-up -> Reports

### 1.2 Yoga Flow (Approved for implementation)

Registration -> Batch Assignment -> Attendance -> Monthly Billing

### 1.3 Inventory Flow (Approved for implementation)

Purchase -> Stock Entry -> Usage -> Alerts -> Reports

## 2. Screen Scope Freeze

Status legend:
- `Now`: Required in implementation scope
- `Later`: Post-MVP
- `Mapped`: Already covered in current system baseline

| Screen/Module | Freeze Status | Note |
|---|---|---|
| Dashboard (daily overview) | Now | Needs final KPI layout freeze |
| Patient Registration | Mapped | Already present, may need field adjustment only |
| OPD Consultation | Mapped | Already present, keep backward compatibility |
| Therapy Planning | Now | Expand from current session scheduling model |
| Slot Booking (Male/Female separate) | Now | New policy rule to be enforced |
| Therapist Assignment | Mapped | Existing base present, extend with plan linkage |
| Daily Therapy Dashboard | Now | Unified therapist operational board |
| Yoga Management (Batch + Private) | Now | New module |
| Billing (OPD, Therapy, Package, Yoga) | Now | Extend billing types and rules |
| Inventory (Medicine + Department) | Now | Add department-level ledger |
| Reports Dashboard | Mapped | Add new analytics for yoga and department inventory |

## 3. Data Model Freeze (Business-Level)

Approved entities from requirement:

- Patients
- Doctors
- Therapies
- Therapy Plans
- Slots
- Therapy Assignments
- Therapists
- Yoga
- Attendance
- Billing
- Inventory
- Department Inventory
- Reports

Decision:
- Current baseline data structures remain operational until migration phase.
- New entities will be added in Phase 1 with compatibility strategy.

## 4. SOP Freeze

Approved SOP roles:

- Reception
- Doctor
- Therapist
- Yoga Trainer
- Pharmacy
- Admin

Each role must have:

1. Defined actions
2. Permissions
3. Approval authority
4. Audit visibility

Detailed mapping is in `PHASE_0_SOP_RBAC_MATRIX.md`.

## 5. Billing Policy Freeze Points

The following must be confirmed before coding:

1. Yoga monthly billing cycle date rule
2. Package billing behavior (prepaid vs per-session deduction)
3. Discount authority by role and limit
4. Refund approval matrix
5. GST behavior by service type

## 6. Scheduling Policy Freeze Points

1. Male/female separation rule:
   - by slot, by room, or both
2. Overbooking rules
3. Therapist daily capacity limits
4. Missed session rescheduling rules
5. Holiday and Sunday policy for OPD and therapy

## 7. Out-of-Scope for This Update Cycle

These are intentionally not included in this cycle unless re-approved:

1. Multi-branch architecture
2. Advanced CRM campaigns
3. External WhatsApp automation
4. Deep BI warehouse integration

## 8. Acceptance Criteria for Phase 0 Completion

Phase 0 is complete only when all are true:

1. Scope table approved by hospital stakeholder.
2. Field catalog approved by operations + clinical users.
3. SOP and approval matrix approved by admin.
4. Sign-off checklist completed with owner names and dates.
