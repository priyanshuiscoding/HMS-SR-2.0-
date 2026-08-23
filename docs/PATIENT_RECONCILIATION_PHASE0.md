# Patient Reconciliation Phase 0

Run this checklist from the hospital server at C:\HMS_SR during an approved maintenance window.

## Approved revision

- Branch: patient-import-tool
- Phase 1-4 commit: eeac895

## 1. Confirm target and create a pre-deployment backup

    Set-Location -LiteralPath 'C:\HMS_SR'
    git status --short
    git fetch origin
    git rev-parse HEAD
    docker compose --env-file .env.production.server -f docker-compose.prod.yml ps
    New-Item -ItemType Directory -Force -Path backups | Out-Null
    docker exec hms_postgres pg_dump -U hms_user -d hms_db -Fc -f /tmp/hms_before_patient_reconciliation.dump
    docker cp hms_postgres:/tmp/hms_before_patient_reconciliation.dump C:\HMS_SR\backups\hms_before_patient_reconciliation.dump
    docker exec hms_postgres pg_restore --list /tmp/hms_before_patient_reconciliation.dump | Select-Object -First 25
    Get-Item -LiteralPath C:\HMS_SR\backups\hms_before_patient_reconciliation.dump

Stop if the dump is missing, empty, unreadable, or reports a PostgreSQL version mismatch.

## 2. Deploy the approved revision

    git switch patient-import-tool
    git pull --ff-only origin patient-import-tool
    git rev-parse HEAD
    docker compose --env-file .env.production.server -f docker-compose.prod.yml up -d --build
    docker compose --env-file .env.production.server -f docker-compose.prod.yml ps
    docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps backend npm run check:deployment

The deployed revision must include eeac895. Stop if containers are unhealthy or checks reveal an unexpected configuration.

## 3. Enter maintenance mode

Confirm reception, doctors, laboratory, pharmacy, billing, IPD, and Panchkarma users have stopped writing data.

    docker compose --env-file .env.production.server -f docker-compose.prod.yml stop backend
    docker compose --env-file .env.production.server -f docker-compose.prod.yml ps

## 4. Record identity and baseline counts

Run the backend as a one-off container while the normal backend remains stopped:

    docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps backend npm run phase0:baseline |
      Tee-Object -FilePath C:\HMS_SR\backups\phase0-baseline-before.json

Review database identity, PostgreSQL version, table counts, migration count, and orphan counts. Every orphan count must be zero.

## 5. Verify rollback on an isolated database

A PostgreSQL administrator must create an isolated database. Never test restoration over hms_db.

    docker exec hms_postgres createdb -U postgres hms_phase0_restore_check
    docker exec hms_postgres pg_restore -U postgres -d hms_phase0_restore_check --clean --if-exists /tmp/hms_before_patient_reconciliation.dump

Run the baseline script against the isolated database using administrator-approved connection settings and compare all counts. Then remove only the test database:

    docker exec hms_postgres dropdb -U postgres hms_phase0_restore_check

## 6. Rollback command

Use only after confirming the target and receiving explicit rollback approval:

    docker compose --env-file .env.production.server -f docker-compose.prod.yml stop backend
    docker cp C:\HMS_SR\backups\hms_before_patient_reconciliation.dump hms_postgres:/tmp/hms_before_patient_reconciliation.dump
    docker exec hms_postgres pg_restore -U postgres -d hms_db --clean --if-exists /tmp/hms_before_patient_reconciliation.dump
    docker compose --env-file .env.production.server -f docker-compose.prod.yml start backend

Do not start reconciliation until the backup, baseline report, and isolated restore test are verified.
