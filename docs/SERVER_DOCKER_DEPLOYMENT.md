# HMS Server Docker Deployment

This setup runs the HMS app in Docker while using the PostgreSQL 16 service already installed on the Windows server.

## Server Ports

Current server IP:

```txt
192.168.29.29
```

Use these ports for HMS:

```txt
5000 -> HMS backend API
5173 -> HMS frontend
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
FRONTEND_URL=http://192.168.29.29:5173

PERSISTENCE_ENABLED=true
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=hms_db
DB_USER=hms_user
DB_PASSWORD=replace_with_server_db_password
DB_SSL=false

VITE_API_BASE_URL=http://192.168.29.29:5000/api/v1
```

Set `DB_PASSWORD` to the password created for `hms_user` on the server. Replace both JWT secrets with long random values before go-live.

## Build And Start

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml up -d --build
```

The containers use `restart: unless-stopped`, so they restart automatically after crashes and Docker restarts.

## Run Database Setup

Run this once after the first deployment or after new migrations are added:

```powershell
docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm backend npm --workspace backend run db:setup
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
http://localhost:5000/health
```

On other hospital computers:

```txt
http://192.168.29.29:5173
http://192.168.29.29:5000/health
```

## Firewall

Run PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "HMS Backend 5000" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
New-NetFirewallRule -DisplayName "HMS Frontend 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
```

Keep PostgreSQL port `5432` closed to other computers unless direct database access is specifically required.

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
docker compose --env-file .env.production.server -f docker-compose.prod.yml run --rm backend npm --workspace backend run db:migrate
```
