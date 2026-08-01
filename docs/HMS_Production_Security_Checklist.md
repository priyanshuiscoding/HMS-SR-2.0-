# HMS Production Security and Recovery Checklist

Use this before running HMS on a real hospital server.

## Required Environment

- `NODE_ENV=production`
- `PERSISTENCE_ENABLED=true`
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be long, random, and different.
- `JWT_ISSUER` and `JWT_AUDIENCE` must match the values used by the deployed web client/API.
- `COOKIE_SECURE=true` behind HTTPS.
- `TRUST_PROXY=true` when using Nginx, load balancer, or reverse proxy.
- `FRONTEND_URL` must contain only trusted hospital domains/IPs.
- Change default database passwords before production.
- Run `npm run check:deployment`; it must report zero seeded/default user passwords.
- Do not run `db:seed` or `db:setup` in production. Use `db:migrate` and the one-time `db:bootstrap-admin` command.
- Do not expose PostgreSQL or Redis ports publicly. Keep them on the server/private network.

## OTP Setup

Password reset is intentionally set to `OTP_DELIVERY_MODE=disabled` for production until a real provider is integrated. Development supports:

- `OTP_DELIVERY_MODE=dev`: logs OTP in backend logs for local testing only.
- `OTP_DELIVERY_MODE=email`, `sms`, or `email_sms` are reserved but will fail closed until provider delivery is implemented and tested.

Configure these when provider integration is added:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMS_PROVIDER_URL`
- `SMS_PROVIDER_TOKEN`
- `OTP_TTL_MINUTES`

## Backup

Run before risky changes, deployments, imports, or migrations:

```powershell
docker exec hms_postgres pg_dump -U hms_user -d hms_db -Fc -f /tmp/hms_backup.dump
docker cp hms_postgres:/tmp/hms_backup.dump C:\HMS_SR\backups\hms_backup.dump
```

## Restore

Only restore after confirming the target database is correct:

```powershell
docker cp C:\HMS_SR\backups\hms_backup.dump hms_postgres:/tmp/hms_backup.dump
docker exec hms_postgres pg_restore -U hms_user -d hms_db --clean --if-exists /tmp/hms_backup.dump
```

## Operational Rules

- Do not hard-delete hospital records.
- Cancel/no-show/transfer/reopen/refund/payment changes must include a reason.
- Review audit logs after sensitive activity.
- Keep Docker images, Node packages, and OS packages updated.
