# Phase 0 SOP and RBAC Matrix

Date: 2026-04-24
Status: Proposed for approval

## 1. SOP Task Matrix

| Role | Operational SOP | Required System Actions |
|---|---|---|
| Reception | Register patient -> Book appointment -> Generate bill | Patient create/update, appointment booking, bill creation, payment collection |
| Doctor | Check patient -> Create treatment plan -> Prescribe therapy | OPD consult, diagnosis entry, therapy plan create, prescription entry |
| Therapist | Check daily schedule -> Perform therapy -> Update status | Session queue view, start/complete session, execution notes |
| Yoga Trainer | Manage batches -> Take attendance | Batch management, private session scheduling, attendance mark |
| Pharmacy | Maintain stock -> Issue medicine -> Update inventory | Purchase receive, issue, stock transaction, alerts review |
| Admin | Monitor reports -> Manage staff -> Track revenue | Users/roles, report dashboards, financial oversight |

## 2. RBAC Action Matrix

Legend:
- `Y`: Allowed
- `A`: Allowed with approval workflow
- `N`: Not allowed

| Action | Admin | Reception | Doctor | Therapist | Yoga Trainer | Pharmacy | Accounts |
|---|---|---|---|---|---|---|---|
| Register patient | Y | Y | N | N | N | N | N |
| Book/cancel appointment | Y | Y | N | N | N | N | N |
| Start OPD visit | Y | Y | Y | N | N | N | N |
| Enter diagnosis | Y | N | Y | N | N | N | N |
| Create therapy plan | Y | N | Y | N | N | N | N |
| Assign therapist/slot | Y | Y | Y | N | N | N | N |
| Execute therapy session | Y | N | Y | Y | N | N | N |
| Create yoga batch/private session | Y | N | N | N | Y | N | N |
| Mark yoga attendance | Y | N | N | N | Y | N | N |
| Create bill | Y | Y | Y | N | N | N | Y |
| Collect payment | Y | Y | N | N | N | N | Y |
| Apply discount | A | N | N | N | N | N | A |
| Approve refund | A | N | N | N | N | N | A |
| Receive stock | Y | N | N | N | N | Y | N |
| Department issue/return | Y | N | N | N | N | Y | N |
| Configure users/roles | Y | N | N | N | N | N | N |
| View all reports | Y | Y | Y | Y | Y | Y | Y |

## 3. Approval Matrix (Freeze)

| Workflow | Primary Approver | Secondary Approver | Notes |
|---|---|---|---|
| High-value discount | Accounts | Admin | Threshold to be finalized |
| Refund | Accounts | Admin | Mandatory reason and audit |
| Billing correction/void | Accounts | Admin | Immutable audit event |
| Slot block override | Admin | Doctor Lead | For emergency exceptions |
| Inventory adjustment | Pharmacy Lead | Admin | Reason code required |

## 4. Audit Requirements (Mandatory)

Audit trail must be captured for:

1. Billing changes (discount/refund/void)
2. Therapy assignment changes
3. Yoga attendance edits after day close
4. Department inventory adjustments
5. Role and permission changes

Minimum audit fields:

- `actor_id`
- `actor_role`
- `action`
- `entity_type`
- `entity_id`
- `before_state`
- `after_state`
- `timestamp`
- `reason`
