# Deploy research fork on Railway (free trial)

Formbricks needs more than a single Next.js service: **Postgres (pgvector)**, **Redis/Valkey**, and for v5 also **Hub + Cube**. Railway free trial gives about **$5 credit / 30 days**, **1 GB RAM per service**, max **5 services** — enough to try, not for long-running production.

## 1. GitHub

Push this repo (private is fine), then connect GitHub to Railway during signup so you get the **Full Trial** (outbound network unlocked).

## 2. Railway project

1. Create project → **Deploy from GitHub** → this repository.
2. Build uses `apps/web/Dockerfile` via `railway.toml`.
3. Add plugins / services in the **same** project:
   - **PostgreSQL** (prefer an image with `pgvector`, or enable the extension after create)
   - **Redis**
4. Optional later: Hub + Cube (official images). Without them some analytics paths fail; Research modules still need a healthy web + DB + Redis.

## 3. Environment variables (web service)

Set on the Formbricks web service (generate secrets with `openssl rand -hex 32`):

| Variable | Notes |
|----------|--------|
| `WEBAPP_URL` / `NEXTAUTH_URL` | Public HTTPS URL Railway gives you (or custom domain) |
| `DATABASE_URL` | From Postgres service (private URL) |
| `REDIS_URL` | From Redis service |
| `NEXTAUTH_SECRET` | Random |
| `ENCRYPTION_KEY` | Random 32-byte hex |
| `CRON_SECRET` | Random |
| `RESEARCH_PLATFORM_ENABLED` | `1` |
| `EMAIL_VERIFICATION_DISABLED` | `1` (no SMTP on trial) |
| `PASSWORD_RESET_DISABLED` | `1` |
| `HUB_API_KEY` / `HUB_API_URL` | Required by v5 validate-env — set even if Hub is stubbed later |
| `CUBEJS_API_URL` / `CUBEJS_API_SECRET` | Same |

After first deploy, open the public URL, sign up, create an organization/workspace, then open Research in the sidebar.

## 4. Cost reality

- Trial: good for a short smoke test.
- After credits: Free plan is ~$1/mo — **Formbricks + DB + Redis will pause**.
- Comfortable next step: **Hobby ($5/mo)** or a small VPS with Docker Compose (`docker/docker-compose.yml`).

## 5. Custom domain

Skip on trial; use `*.up.railway.app`. Point DNS later when you keep the stack.
