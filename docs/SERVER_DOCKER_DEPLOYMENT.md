# HMS Server Docker Deployment

This setup runs the HMS app in Docker while using the PostgreSQL 16 service already installed on the Windows server.

## Server Ports

Current server IP:

```txt
192.168.29.29
```

Use this application port for HMS:

```txt
127.0.0.1:5173 -> HMS frontend and same-origin API proxy (server-local only)
5432 -> PostgreSQL on Windows host, not exposed by Docker
```

Ports `80` and `443` are already used on the server, so the frontend is mapped to `5173`.

## Get The Code Onto The Server

Recommended: use Git. The server needs the project files so Docker can build the images.

```powershell
cd C:\
git clone <your-repo-url> HMS_SR
cd C:\HMS_SR
```

For updates later:

```powershell
cd C:\HMS_SR
git pull
```

You do not need to copy `node_modules`. Docker installs dependencies inside the images.

## Create Server Env

Copy the example:

```powershell
Copy-Item .env.production.server.example .env.production.server
```

Edit `.env.production.server` and confirm these values:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://hms.example.org

PERSISTENCE_ENABLED=true
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=hms_db
DB_USER=hms_user
DB_PASSWORD=replace_with_server_db_password
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
TRUST_PROXY=true
OTP_DELIVERY_MODE=disabled

VITE_API_BASE_URL=
```

Set `DB_PASSWORD` to the password created for `hms_user` on the server. Replace both JWT secrets with different random values of at least 48 characters. Production requires HTTPS; terminate TLS at the server's existing reverse proxy and forward to `http://127.0.0.1:5173`.

Keep `VITE_API_BASE_URL` blank so browser API calls use the same HTTPS origin. Password reset is deliberately disabled until a real email/SMS provider is integrated.

## Back Up, Build And Start

Create and verify a PostgreSQL backup before every release. Then run:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml up -d --build
```

The one-shot `migrate` service applies migrations under a database advisory lock before the backend starts. The backend must become ready before the frontend starts.

## First Deployment Administrator

Do not run `db:setup` or `db:seed` in production; those commands contain local/reference data and are blocked by default. On the first deployment only, set the `INITIAL_ADMIN_*` values in `.env.production.server`, then run:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps backend npm run db:bootstrap-admin
```

Remove `INITIAL_ADMIN_PASSWORD` from the environment file immediately afterward. The bootstrap command never changes the password of an existing administrator.

## Release Validation

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps backend npm run check:deployment
Invoke-RestMethod https://hms.example.org/health
Invoke-RestMethod https://hms.example.org/ready
```

## Check Status

```powershell
docker ps
docker compose --env-file .env.production.server -f docker-compose.prod.yml logs -f
```

Check ports:

```powershell
netstat -ano | findstr :5000
netstat -ano | findstr :5173
netstat -ano | findstr :5432
```

## Access HMS

On the server:

```txt
http://localhost:5173
http://localhost:5173/health
```

On other hospital computers:

```txt
https://hms.example.org
https://hms.example.org/health
```

## Firewall And TLS

Do not open ports `5000`, `5173`, or `5432` to the hospital network. Docker binds the frontend to loopback only. Configure the server's existing HTTPS reverse proxy to forward the HMS hostname to `http://127.0.0.1:5173`, preserve `Host` and `X-Forwarded-Proto`, and enable HSTS at that TLS endpoint. Keep PostgreSQL private to the server.

## Restart, Stop, Update

Restart:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml restart
```

Stop:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml down
```

Update from Git and rebuild:

```powershell
cd C:\HMS_SR
git pull
docker compose --env-file .env.production.server -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm --no-deps backend npm run check:deployment
```
