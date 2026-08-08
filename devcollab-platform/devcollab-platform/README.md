# DevCollab Platform

Multi-tenant project collaboration platform with team RBAC, projects/tasks, threaded comments, mentions, notifications, real-time activity, PostgreSQL full-text search, reports, Supabase RLS, tests and CI.

## Status

This repository is a production-oriented assignment implementation. The code, schema, tests, CI and documentation are included. **Live deployment URLs, Sentry DSN, GitHub branch protection and Loom URL must be filled with the values from your own deployments/accounts**; they cannot be truthfully created from a local ZIP.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database/Auth: Supabase PostgreSQL + Supabase Auth
- Realtime: Socket.io
- Validation: Zod
- Tests: Vitest + Supertest
- CI: GitHub Actions
- Monitoring: Sentry-compatible server integration
- Search: PostgreSQL `tsvector` + GIN
- Reports: CSV export

## Live URLs

- Frontend: `https://YOUR-FRONTEND-DOMAIN`
- Backend: `https://YOUR-BACKEND-DOMAIN`
- Loom walkthrough: `https://www.loom.com/share/YOUR-VIDEO-ID`

Replace these placeholders after deployment.

## Features

- Multi-tenant teams and invitation workflow
- Team roles: owner/admin/member/viewer
- Projects, tasks, sub-tasks, due dates, assignees, labels and priority
- Threaded comments and `@mentions`
- In-app notifications
- Socket.io project activity feed
- PostgreSQL full-text search across tasks/comments
- Per-user completion rate and average cycle time
- CSV report export
- Supabase RLS with team membership/role enforcement
- 10+ automated tests
- GitHub Actions CI with coverage threshold
- Sentry error capture
- Security and system-design documentation

## Local Setup

### 1. Database

Create a Supabase project. Run:

`supabase/schema.sql`

in the Supabase SQL editor.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm test
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`; API defaults to `http://localhost:5000`.

## Required Environment Variables

Never commit `.env`.

Backend:
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SENTRY_DSN`
- `FRONTEND_URL`

Frontend:
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SENTRY_DSN`

The Supabase service-role key is server-only and must never be exposed to the browser.

## Testing

```bash
cd backend
npm test
npm run test:coverage
```

The CI pipeline requires all tests to pass and a 70% global coverage threshold.

## GitHub / Production Checklist

1. Create a **public** repository named `devcollab-platform`.
2. Push this project.
3. Configure GitHub Actions secrets/environment variables.
4. Deploy frontend and backend.
5. Replace the three README URL placeholders.
6. Configure Sentry DSN.
7. Add screenshots under `docs/screenshots/`.
8. Record a 2–4 minute Loom walkthrough and replace the Loom placeholder.
9. Protect `main`: require pull-request review and required CI status checks.
10. Confirm no secrets exist in Git history.

See `SYSTEM-DESIGN.md` and `docs/security.md` for architecture and RLS rationale.
