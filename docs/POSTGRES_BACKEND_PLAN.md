# SR-AIIMS HMS PostgreSQL Backend Plan

This phase moves the HMS from in-memory demo data toward a durable, multi-user PostgreSQL backend.

## What Is Implemented Now

- Users, patients, and auth now read/write PostgreSQL through repository files while keeping the API response shape unchanged.
- Appointments now read/write PostgreSQL through `appointments.repository.js`.
- Appointment booking uses PostgreSQL transactions and an active-slot partial unique index to prevent duplicate live bookings.
- Cancelling/no-showing an appointment frees the doctor/time slot for reuse.
- OPD now reads/writes PostgreSQL through `opd.repository.js`.
- OPD queue reads from PostgreSQL appointments + OPD visits.
- OPD visit creation, vitals, Ayurveda assessment, prescription headers, and prescription medicines are persisted in PostgreSQL.
- Billing now reads/writes PostgreSQL through `billing.repository.js`.
- Bills, bill items, payments, discounts, and refunds are persisted with transaction locks for bill, receipt, and refund numbering.
- Billing mirrors load from PostgreSQL on backend startup so IPD, Panchkarma, and lab workflows can keep using the current API shape during migration.
- Patient writes also update the temporary in-memory mirror so unconverted modules can continue to work during the migration phase.
- Backend startup syncs patient, appointment, OPD, prescription, billing, payment, and refund mirrors from PostgreSQL when persistence is enabled.
- Rooms and IPD now read/write PostgreSQL through `rooms.repository.js` and `ipd.repository.js`.
- IPD admission + bed occupancy, bed transfer, notes, vitals, and discharge + bed release are persisted with PostgreSQL row locks/transactions.
- Panchkarma now reads/writes PostgreSQL through `panchkarma.repository.js`.
- Panchkarma completion now persists material usage, deducts inventory stock, writes stock transactions, creates the therapy bill, and links the bill to the session in one PostgreSQL transaction.
- Pharmacy and inventory now read/write PostgreSQL through `pharmacy.repository.js` and `inventory.repository.js`.
- Medicine masters, suppliers, inventory batches, stock transactions, purchase orders, and dispensations are persisted in PostgreSQL.
- Prescription dispensing now uses PostgreSQL transactions for prescription status, batch stock deduction, stock issue transaction, and dispensation records.
- Laboratory now reads/writes PostgreSQL through `laboratory.repository.js`.
- Lab orders, order tests, sample collection, result entry, report readiness, and lab bill links are persisted in PostgreSQL.
- Lab order numbering, result updates, and bill linking use PostgreSQL transactions/advisory locks where concurrent users can touch the same order.
- Reports now read from PostgreSQL through `reports.repository.js`.
- Overview, daily OPD, IPD census, revenue, pharmacy sales, lab workload, and Panchkarma stats are generated from SQL read models instead of temporary mirrors.
- Production hardening is in place:
  - bcrypt password hashing for new/updated users and seeded users.
  - legacy seed-hash login upgrade to bcrypt on successful login.
  - request validation middleware on auth and user-management writes.
  - authenticated write audit logging into `audit_logs`.
  - database backup/restore scripts and deployment readiness checks.
- Patient document upload is in place for the Puru Software migration:
  - Basic patient demographics can be migrated from Excel into the normalized `patients` table.
  - Old prescriptions, lab reports, discharge summaries, case sheets, and extra patient details can be uploaded as patient-linked PDFs.
  - PDFs are stored in PostgreSQL via `patient_documents`, so they remain durable on Vercel/serverless deployments.
  - Patient profile now lists uploaded documents, supports opening PDFs, and allows admin/reception removal.
- Shared hospital calendar is in place:
  - Calendar shows manual events plus system-generated appointments, Panchkarma sessions, and lab orders.
  - Staff can schedule, update, and remove manual events with patient links, staff assignment, location, status, and reminder timing.
  - Month, week, and day views are available in the frontend calendar page.
- IPD therapy scheduling is in place:
  - Doctors/nursing/therapists can schedule Panchkarma/therapy sessions directly from an active IPD admission.
  - IPD package presets are available from the Shanti Ratnam packages page as clinical planning templates.
  - Scheduled IPD therapies are linked back to the admission and appear in admission details.
  - Completed linked therapies that do not already have their own therapy bill are added to the IPD discharge bill.
- Inventory and pharmacy stock are now separated:
  - Pharmacy owns medicine stock, medicine batch receiving, stock alerts, expiry visibility, and prescription dispensing.
  - Inventory is now hospital-wide non-pharmacy stock for linen, equipment, ward supplies, housekeeping, office, and department items.
  - Hospital inventory has its own item master and receipt/issue/adjustment ledger.

- `backend/src/database/migrations/001_core_schema.sql`
  - Core normalized schema for users, patients, appointments, OPD, Ayurveda assessment, prescriptions, rooms/beds, IPD, Panchkarma, pharmacy/inventory, lab, billing, payments, refunds, settings, and audit logs.
  - Indexes and foreign keys for multi-user hospital operations.
  - `metadata JSONB` columns for future fields without urgent schema churn.

- `backend/src/database/migrations/006_patient_documents.sql`
  - Patient-linked PDF archive for legacy Puru Software records and optional new-patient supporting documents.
  - Stores document metadata and PDF bytes in PostgreSQL instead of relying on ephemeral app server storage.

- `backend/src/database/migrations/007_calendar_events.sql`
  - Manual calendar events/reminders with optional patient and staff assignment links.
  - System schedule items are read from their source modules so appointments and therapy/lab work stay consistent.

- `backend/src/database/migrations/008_hospital_inventory.sql`
  - Hospital-wide inventory item master and movement ledger, separate from pharmacy medicine batches.
  - Supports non-medicine stock by category, department, location, supplier, reorder level, and unit.

- `backend/src/database/migrate.js`
  - Applies SQL migrations once.
  - Tracks applied files in `schema_migrations`.
  - Detects changed migration checksums after apply.

- `backend/src/database/seed.js`
  - Seeds current SR-AIIMS master data into PostgreSQL:
    - users/staff
    - staff schedules
    - OPD consultation charge and hours
    - IPD ward charges
    - Panchkarma therapy rates
    - rooms/beds
    - lab test starters
    - medicine/supplier masters
    - starter bills and payments

## Local Setup Steps

Run these in PostgreSQL as an admin user:

```sql
CREATE DATABASE hms_db;
CREATE USER hms_user WITH PASSWORD 'hms_password';
GRANT ALL PRIVILEGES ON DATABASE hms_db TO hms_user;
```

If PostgreSQL 15/16 restricts schema permissions, also run inside `hms_db`:

```sql
GRANT ALL ON SCHEMA public TO hms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hms_user;
```

Then from the project root:

```bash
npm run db:setup
```

For only migrations:

```bash
npm run db:migrate
```

For only seed data:

```bash
npm run db:seed
```

## Hospital Server Setup

On the hospital server, use a strong password instead of `hms_password`.

1. Install PostgreSQL 16.
2. Create `hms_db` and `hms_user`.
3. Copy `.env.example` to `.env`.
4. Set:

```env
PERSISTENCE_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hms_db
DB_USER=hms_user
DB_PASSWORD=<strong-password>
DB_SSL=false
```

5. Run:

```bash
npm install
npm run db:setup
npm --workspace backend run start
```

## Next Backend Work

The schema is ready, and the repository migration has started. Move modules one by one:

1. `billing`
   - Done: bills, bill items, payments, discounts, refunds.
2. `rooms/ipd`
   - Done: rooms, beds, admissions, notes, vitals, discharge summaries, and bed occupancy/release.
3. `panchkarma`
   - Done: therapy sessions, material usage, stock issue, and therapy billing link.
4. `pharmacy/inventory`
   - Done: medicine masters, suppliers, stock batches, stock transactions, purchase orders, and dispensations.
5. `laboratory`
   - Done: lab test masters, lab orders, lab order tests, sample collection, results, reports, and bill links.
6. `reports`
   - Done: overview, OPD daily, IPD census, revenue, pharmacy sales, lab workload, and Panchkarma stats.

Critical workflows must use PostgreSQL transactions:

- patient registration + UHID
- appointment booking + token number
- IPD admission + bed occupancy
- billing + payment
- pharmacy dispense + stock deduction
- Panchkarma completion + material issue + bill

## Manual Data Still Needed

- Puru Software Excel export with stable old patient identifier, name, phone, gender, DOB/age, address, registration date, and any old OPD/IPD number.
- Folder of old patient PDFs named or mapped with the same stable old patient identifier from the Excel export.
- Final room/bed list with exact numbers and capacity.
- Full lab test catalogue, prices, units, and normal ranges.
- Final medicine master review with GST/HSN.
- Invoice legal header and GST details.
- Discount/refund approval rules.
- SMS/WhatsApp templates and provider credentials.
- Production server domain or local LAN hostname.

## Next Implementation Phases

1. Puru Software data migration
   - Finalize the Excel column mapping to HMS patient fields.
   - Add an import script or admin import screen for patient demographics.
   - Use the patient profile PDF upload for old prescriptions/history after each imported patient is matched.
   - Keep the old Puru patient ID in patient `metadata` for traceability.
2. Go-live readiness
   - Replace default JWT secrets in production `.env`.
   - Set `COOKIE_SECURE=true` and `TRUST_PROXY=true` when running behind HTTPS/proxy.
   - Run `npm run check:deployment` and require zero failures before go-live.
   - Schedule `npm run db:backup` and periodically test `npm run db:restore -- <backup-file.dump>` on a non-production database.
3. Calendar follow-up phase
   - Add SMS/WhatsApp reminder dispatch after provider credentials are finalized.
   - Add real-time push updates with WebSockets/SSE if the hospital wants multi-desk live calendar refresh without manual navigation.
   - Add drag-and-drop rescheduling after appointment conflict rules are finalized.
4. IPD therapy follow-up phase
   - Confirm final IPD package pricing and package-wise default therapy plans with the hospital.
   - Add one-click package plan generation once doctors approve which therapies belong to each package day-by-day.
   - Add therapy conflict checks for therapist/room overlap if required for go-live.
5. Hospital inventory follow-up phase
   - Import the final hospital inventory item list when provided.
   - Add approval rules for high-value issues or asset write-offs if required.
   - Add department-wise reports after real stock categories are finalized.
