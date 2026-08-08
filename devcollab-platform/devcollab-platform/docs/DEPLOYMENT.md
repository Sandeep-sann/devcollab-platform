# Deployment Guide

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Enable GitHub OAuth under Authentication providers if using the sample login.
4. Configure redirect URLs for the frontend domain.

## Backend

Recommended platforms include Render, Railway or Fly.io.

Environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY
- FRONTEND_URL
- SENTRY_DSN

Start command: `npm start` from `backend`.

## Frontend

Recommended platforms include Vercel, Netlify or Cloudflare Pages.

Environment variables:
- VITE_API_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_SENTRY_DSN

Build command: `npm run build`
Output: `dist`

## GitHub Branch Protection

Repository Settings → Branches → Add branch protection rule for `main`:
- Require a pull request before merging
- Require at least 1 approval
- Require status checks to pass
- Select the `backend` and `frontend` CI checks
- Require branches to be up to date
- Do not allow force pushes

## Loom

Record 2–4 minutes covering:
1. Login/team boundary
2. Project/task and sub-task workflow
3. Comment + mention notification
4. Real-time activity
5. Search
6. Report CSV
7. Security/RLS and CI

Paste the Loom share URL into README.
