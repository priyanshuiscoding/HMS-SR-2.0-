giv# Puru Patient Insert-Only Server Import

This runbook imports only patients that are missing from the production HMS database. It never updates or deletes an existing patient. Exact PPIN matches and probable manually entered duplicates are skipped.

## Before starting

- Work on the hospital server through AnyDesk.
- Confirm the project is at `C:\HMS_SR` and `.env.production.server` exists there.
- Transfer the patient CSV to `C:\HMS_SR\secure-imports\Patient_PhoneNumberSRAIIMS.csv`.
- Do not commit the patient CSV, a database dump, or `.env.production.server` to Git.
- Copy `import-puru-patients.mjs` and `puru-patient-export.mjs` from the transfer bundle into `C:\HMS_SR\scripts`.

## 1. Build the backend image containing the importer

Open PowerShell as the normal HMS deployment user:

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\HMS_SR'
docker compose --env-file .env.production.server -f docker-compose.prod.yml build backend
```

## 2. Run the production dry run

This command reads the production database but does not modify it:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps `
  -v 'C:\HMS_SR\secure-imports:/imports:ro' `
  backend node scripts/import-puru-patients.mjs /imports/Patient_PhoneNumberSRAIIMS.csv
```

Save the JSON output. Review these values before proceeding:

- `serverAddress` and `serverPort` identify the production PostgreSQL server.
- `existingPpinSkipped` are already represented and will not be touched.
- `possibleManualDuplicatesSkipped` are quarantined and will not be inserted.
- `invalidRowsSkipped` must be zero or reviewed.
- `eligibleMissingPatients` is the maximum number that apply mode will insert.
- `inserted` must be zero in dry-run mode.

Stop here until the dry-run counts are approved.

## 3. Create and verify a production backup

Use the server's established PostgreSQL backup procedure. If PostgreSQL client tools and Node are available on the host, the project helper can be used:

```powershell
$env:ENV_FILE = 'C:\HMS_SR\.env.production.server'
npm run db:backup
```

Confirm the new dump in `C:\HMS_SR\backups` is non-zero and inspect it with `pg_restore --list`. Do not continue with an empty or unreadable dump.

## 4. Apply during a maintenance window

Replace `<verified-backup.dump>` with the exact verified dump filename. Stop the API briefly so a receptionist cannot register a patient during UHID allocation:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml stop backend

docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps `
  -v 'C:\HMS_SR\secure-imports:/imports:ro' `
  -v 'C:\HMS_SR\backups:/backups:ro' `
  backend node scripts/import-puru-patients.mjs /imports/Patient_PhoneNumberSRAIIMS.csv `
  --apply --backup /backups/<verified-backup.dump> --confirm-db hms_db

docker compose --env-file .env.production.server -f docker-compose.prod.yml start backend
```

If the importer reports an error, its database transaction rolls back. Start the backend again and investigate before retrying.

## 5. Validate

Run the same dry-run command from step 2 again. Successfully inserted PPINs should now be counted under `existingPpinSkipped`, while `eligibleMissingPatients` should be zero. Quarantined possible duplicates will remain skipped for manual review.

Check application readiness:

```powershell
Invoke-RestMethod http://localhost:5173/health
Invoke-RestMethod http://localhost:5173/ready
```

Verify several newly inserted patients in HMS and confirm that existing manually entered patients retained their original UHIDs and clinical records.
