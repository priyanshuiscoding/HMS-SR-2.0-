# Phase 0 Field Catalog (Frozen Specification)

Date: 2026-04-24
Purpose: Define exact business fields before DB/API/UI implementation.

Field type legend:
- `M`: Mandatory
- `O`: Optional
- `C`: Computed/System

## 1. Patients

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| patient_id | UUID/string | C | Internal primary identifier |
| registration_number | string | C | Human-readable running number |
| uhid | string | C | Hospital unique ID |
| first_name | string | M |  |
| last_name | string | M |  |
| gender | enum(male,female,other) | M |  |
| age | number | O | Derive from DOB where possible |
| date_of_birth | date | O |  |
| contact_number | string | M |  |
| alternate_contact | string | O |  |
| address | string | O |  |
| patient_type | enum(new,follow_up) | M |  |

## 2. Doctors

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| doctor_id | UUID/string | C |  |
| doctor_name | string | M |  |
| department | string | M |  |
| active | boolean | C | Soft status |

## 3. Therapies

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| therapy_id | UUID/string | C |  |
| therapy_name | string | M |  |
| duration_minutes | number | M |  |
| gender_type | enum(male,female,both) | M | For slot policy |
| price | number | M | Billing integration |

## 4. Therapy Plans

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| plan_id | UUID/string | C |  |
| patient_id | FK | M |  |
| diagnosis_ref | string | O | Linked OPD diagnosis |
| start_date | date | M |  |
| end_date | date | M |  |
| sessions_planned | number | M |  |
| status | enum(draft,active,paused,completed,cancelled) | C | Workflow state |
| created_by | user_id | C | Audit |

## 5. Slots

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| slot_id | UUID/string | C |  |
| slot_date | date | M |  |
| start_time | time | M |  |
| end_time | time | M |  |
| room_type | string | M |  |
| gender_rule | enum(male,female,mixed) | M | Mandatory for new policy |
| capacity | number | M |  |
| status | enum(open,blocked,booked,completed) | C |  |

## 6. Therapy Assignments

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| assignment_id | UUID/string | C |  |
| patient_id | FK | M |  |
| plan_id | FK | M |  |
| therapist_id | FK | M |  |
| slot_id | FK | M |  |
| assignment_date | date | M |  |
| execution_status | enum(scheduled,in_progress,completed,missed,cancelled) | C |  |
| execution_notes | string | O |  |

## 7. Therapists

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| therapist_id | UUID/string | C |  |
| therapist_name | string | M |  |
| gender | enum(male,female,other) | M | For gender slot compatibility |
| availability | string/json | M | Working windows |
| active | boolean | C |  |

## 8. Yoga

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| yoga_batch_id | UUID/string | C |  |
| batch_name | string | M |  |
| type | enum(batch,private) | M |  |
| trainer_id | FK | M |  |
| schedule_pattern | string/json | M | Days/time |
| monthly_fee | number | M | Billing |
| capacity | number | O | Required for batch type |
| active | boolean | C |  |

## 9. Attendance

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| attendance_id | UUID/string | C |  |
| patient_id | FK | M |  |
| yoga_batch_id | FK | M |  |
| attendance_date | date | M |  |
| status | enum(present,absent,late,excused) | M |  |
| marked_by | user_id | C |  |

## 10. Billing

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| bill_id | UUID/string | C |  |
| patient_id | FK | M |  |
| service_type | enum(opd,therapy,package,yoga,lab,pharmacy,ipd,misc) | M | Include new yoga/package |
| amount | number | M |  |
| tax_amount | number | O |  |
| discount_amount | number | O |  |
| total_amount | number | C |  |
| payment_status | enum(unpaid,partial,paid,refunded) | C |  |
| billing_date | date | C |  |

## 11. Inventory

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| item_id | UUID/string | C |  |
| item_name | string | M |  |
| batch_number | string | M |  |
| expiry_date | date | M |  |
| quantity | number | M |  |
| unit | string | O |  |
| location | string | O |  |

## 12. Department Inventory

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| dept_txn_id | UUID/string | C |  |
| department_name | string | M |  |
| item_id | FK | M |  |
| quantity_issued | number | M |  |
| quantity_returned | number | O |  |
| txn_date | date | C |  |
| issued_by | user_id | C |  |

## 13. Reports

| Field | Type | M/O/C | Notes |
|---|---|---|---|
| report_id | UUID/string | C | Snapshot/export reference |
| report_type | string | M | Revenue, attendance, therapy, inventory, etc. |
| period_start | date | M |  |
| period_end | date | M |  |
| generated_at | datetime | C |  |

## 14. Mandatory Master Data Before Development Start

1. Final therapy catalog with duration, gender rule, pricing.
2. Therapist roster with gender and availability.
3. Yoga trainer and proposed batches with fee policy.
4. Department list for inventory issuance.
5. Billing and GST rule confirmation by service type.
