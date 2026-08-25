# Patient reconciliation production runbook

This runbook applies the locally approved PPIN-to-UHID manifest to the existing production `hms_db` in place. Never restore the audit database over production.

## Preconditions

- The approved source changes are committed, pushed, and deployed.
- Patient registration and all clinical writes are stopped.
- A fresh production custom-format backup has been created and verified with `pg_restore --list`.
- That exact backup has been restored locally, audited read-only, and used to create the final manifest.
- The final manifest and its exact backup are present on the production server.
- The production backend remains stopped until migration 032 and reconciliation finish.

## Prepare the production shell

Run from `C:\HMS_SR` in an Administrator PowerShell window. Adjust only the manifest and backup filenames.

```powershell
Set-Location 'C:\HMS_SR'

$env:ENV_FILE='C:\HMS_SR\.env.production.server'
$env:DATABASE_URL=''
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='5432'

$manifest='C:\HMS_SR\secure-imports\patient-reconciliation\master-manifest.json'
$backup='C:\HMS_SR\backups\hms-production-final.dump'

$manifestEnvelope=Get-Content -Raw -LiteralPath $manifest | ConvertFrom-Json
$manifestSha256=$manifestEnvelope.sha256
$backupSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $backup).Hash.ToLowerInvariant()

$manifestSha256
$backupSha256
```

The printed hashes must equal the approved hashes recorded during the local audit. Stop if either differs.

## Stop application writes and migrate

```powershell
docker compose --env-file '.\.env.production.server' -f '.\docker-compose.prod.yml' stop frontend backend
docker compose --env-file '.\.env.production.server' -f '.\docker-compose.prod.yml' run --rm --no-deps backend npm run db:migrate
```

Confirm migration `032_numeric_patient_uhid_sequence.sql` was applied successfully.

## Production rollback rehearsal

```powershell
$commonArgs=@(
  'apply',
  '--manifest', $manifest,
  '--backup', $backup,
  '--confirm-db', 'hms_db',
  '--expected-manifest-sha256', $manifestSha256,
  '--expected-backup-sha256', $backupSha256,
  '--maintenance-confirmation', 'WRITES_STOPPED',
  '--production-confirmation', 'RECONCILE hms_db TO 6342 ACTIVE PATIENTS'
)

node '.\scripts\reconcile-master-patients.mjs' @commonArgs --production-dry-run
```

Continue only if the result says `rolled-back-production-dry-run`, active patients are 6,342, all UHIDs are unique, references are unchanged, and orphan total is zero.

## Commit production reconciliation

```powershell
node '.\scripts\reconcile-master-patients.mjs' @commonArgs --production --commit
```

Continue only if the result says `committed-production-reconciliation` with the same successful validations.

## Restart and verify

```powershell
docker compose --env-file '.\.env.production.server' -f '.\docker-compose.prod.yml' up -d --no-deps backend frontend
docker compose --env-file '.\.env.production.server' -f '.\docker-compose.prod.yml' ps
```

Verify the backend is healthy, the registry shows 6,342 active patients, linked clinical histories open correctly, and the Recycle Bin contains 22 archived HMS-only records. Register a controlled patient only after all read-only checks pass; it must receive UHID 6343.

If any reconciliation or validation command fails, keep the application stopped. Do not rerun with changed confirmations or bypass a guard. Investigate the reported mismatch and retain the fresh backup for rollback.
