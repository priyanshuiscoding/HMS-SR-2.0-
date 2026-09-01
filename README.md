# SR-AIIMS Hospital Management System

Full-stack HMS for Shanti-Ratnam, maintained as an npm monorepo.

## Stack and modules

- Frontend: React 18, Vite, Redux Toolkit
- Backend: Node.js, Express, JWT authentication, role/module access control
- Database: PostgreSQL 16 with ordered, checksummed SQL migrations
- Modules: users, patients, appointments, OPD, IPD, laboratory, billing, pharmacy, inventory/godown, Panchkarma, rooms, HR, certificates, calendar and reports
- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api/v1`
- Health: `http://localhost:5000/health`

## Repository layout

```text
backend/                     API, modules and database code
  src/database/migrations/  Ordered PostgreSQL migrations
frontend/                    React/Vite application
scripts/                     Validation, backup, restore and import tools
docs/                        Operational and workflow guides
docker-compose.yml           Complete local Docker environment
docker-compose.prod.yml      Production-oriented containers
```

## Prerequisites

Recommended: Git and Docker Desktop with Docker Compose.

For native development, also install Node.js 24 (Docker uses 24.18.0), npm and PostgreSQL 16 unless PostgreSQL runs in Docker.

## Quick start with Docker (recommended)

```powershell
git clone https://github.com/priyanshuiscoding/HMS-SR-2.0-.git
cd HMS-SR-2.0-
docker compose up -d postgres redis
docker compose run --rm backend npm run db:setup
docker compose up -d --build backend frontend
```

The setup applies every migration and loads development seed data. It is safe to rerun: applied migrations are skipped and seed records are upserted.

Open `http://localhost:5173`. Verify the API at `http://localhost:5000/health`.

Local development login:

- Email: `admin@sraiims.in`
- Password: `Admin@123`

Never use these demo credentials in production.

```powershell
# Status and logs
docker compose ps
docker compose logs -f backend frontend

# Stop while preserving database data
docker compose down

# Rebuild application containers
docker compose up -d --build backend frontend
```

Do not add `-v` to `docker compose down` unless you intend to delete local PostgreSQL and Redis data.

## Native frontend/backend development

### 1. Clone and install

```powershell
git clone https://github.com/priyanshuiscoding/HMS-SR-2.0-.git
cd HMS-SR-2.0-
npm ci
```

The root lockfile covers both npm workspaces; separate frontend/backend installs are unnecessary.

### 2. Start PostgreSQL and Redis

```powershell
docker compose up -d postgres redis
```

Default connection: `localhost:5432`, database `hms_db`, user `hms_user`, password `hms_password`.

### 3. Configure environment

```powershell
Copy-Item .env.example .env
```

The template matches Docker PostgreSQL. Replace both JWT secrets with different long random values outside disposable development. Never commit `.env`.

Configuration loads in this order: `ENV_FILE`, `backend/.env`, root `.env`, then root `.env.production`.

### 4. Create and seed the database

```powershell
npm run db:setup
```

### 5. Run both applications

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
npm run dev:frontend
```

Visit `http://localhost:5173`.

## Existing PostgreSQL installation

Create an empty database/user and configure `.env`:

```dotenv
PERSISTENCE_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hms_db
DB_USER=hms_user
DB_PASSWORD=your_password
DB_SSL=false
```

Or use `DATABASE_URL=postgresql://hms_user:your_password@localhost:5432/hms_db`. Then run `npm run db:setup`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev:frontend` | Start Vite with hot reload |
| `npm run dev:backend` | Start API with Node watch mode |
| `npm run build:frontend` | Build production frontend |
| `npm run start:backend` | Start backend without watch mode |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Load/update development seed data |
| `npm run db:setup` | Run migrations and seed |
| `npm run db:bootstrap-admin` | Create configured initial admin |
| `npm run db:backup` | Create PostgreSQL backup |
| `npm run db:restore -- <file>` | Restore PostgreSQL backup |
| `npm run validate:workflows` | Validate critical workflows |
| `npm run check:api` | Smoke-test a running API |
| `npm run check:deployment` | Check deployment readiness |

Read `docs/PURU_PATIENT_SERVER_IMPORT.md` and `docs/PATIENT_RECONCILIATION_PRODUCTION_RUNBOOK.md` before patient imports or reconciliation.

## Verify setup

With services running:

```powershell
Invoke-RestMethod http://localhost:5000/health
npm run build:frontend
npm run validate:workflows
npm run check:api
```

## Troubleshooting

- Missing tables: run `npm run db:migrate`, or `npm run db:setup` for a new development database.
- Port 5432 busy: stop the other PostgreSQL instance or change the compose port and `DB_PORT`.
- Frontend cannot call API: check `/health`; set `VITE_API_BASE_URL` for a custom API.
- Fresh login fails: run `npm run db:setup`.
- Migration checksum error: never edit an applied migration; add a new numbered migration and verify the code/database histories match.

## Data safety and production

- Never commit `.env`, dumps, raw patient exports or reconciliation reports.
- Back up populated databases before migrations, imports or bulk corrections.
- Do not run demo seed data against production unless the documented override is intentional.
- Never rewrite an applied migration.
- Transfer patient data and credentials outside Git.

For production, start from `.env.production.server.example`, then follow `docs/SERVER_DOCKER_DEPLOYMENT.md` and `docs/HMS_Production_Security_Checklist.md`. Run `npm run check:deployment` before go-live.
