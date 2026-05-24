# SR-AIIMS HMS

Phase 1 foundation scaffold for the SR-AIIMS Hospital Management System.

## Included

- Monorepo layout for `backend` and `frontend`
- Express API foundation with auth and RBAC-ready middleware
- React + Vite frontend shell with branded dashboard UI
- White, blue, and saffron visual system for the HMS dashboard
- Local Docker services for PostgreSQL and Redis

## Current Phase

This repository currently implements the first platform phase:

- project scaffold
- backend app bootstrap
- auth flow skeleton
- protected frontend routing
- dashboard shell
- design system foundation

## Run Plan

1. Copy `.env.example` to `.env` for the backend.
2. Install dependencies in the root, `backend`, and `frontend`.
3. Start Docker services for PostgreSQL and Redis.
4. Run backend and frontend in development mode.

## Environment Files

- `.env.example` is the local development template.
- `.env.production.server.example` is the production server template.
- `.env` and `.env.production` are real machine-specific files and are intentionally ignored by Git.

Backend commands now load env values in this order: explicit `ENV_FILE`, `backend/.env`, project `.env`, then project `.env.production`. This means a server that only has `.env.production` can run:

```powershell
npm --workspace backend run db:migrate
```

Production Docker reads `.env.production` for the backend. To rebuild the server containers:

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

## Demo Login

- Email: `admin@sraiims.in`
- Password: `Admin@123`

These demo credentials are only for the foundation scaffold and should be replaced once database-backed auth is added.
