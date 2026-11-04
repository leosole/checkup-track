# Vitals — Health Dashboard Monorepo

Google-signed-in health dashboard that parses lab-report PDFs into structured
biomarker data (via MarkItDown + Groq) and visualizes exams, medications,
search, and multi-series time charts.

```
backend/    FastAPI + SQLModel + SQLite — decoupled, API-first JSON REST API
            (stateless JWT auth; usable by web and future Android clients)
frontend/   React + TypeScript + Vite + Tailwind CSS, Untitled UI aesthetics
```

## Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Interactive docs: http://localhost:8000/docs
- Storage: `backend/storage/pdfs/` (raw PDFs), `backend/storage/markdowns/` (parsed `.md`)
- Database: `backend/health.db` (SQLite, auto-created on startup)

### Environment variables

Copy `env.example` and set:

| Key | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq API key for structured biomarker extraction |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 web client ID for ID-token verification |
| `JWT_SECRET` | Signing secret for local JWTs (a dev secret is auto-generated when unset) |
| `DATABASE_URL` | Postgres URL for production; SQLite (`backend/health.db`) is used when unset |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` | Backblaze B2 bucket for PDFs; local disk is used when unset |

### Production (Freebuff hosting)

FastAPI is served through `api/index.py` (the ASGI entrypoint hosting loads)
and its dependencies are declared in `api/requirements.txt`;
`backend/requirements.txt` includes that file. Set `DATABASE_URL` to a hosted
Postgres database for production, since the deploy filesystem is ephemeral.

## Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api → :8000
npm run typecheck  # tsc --noEmit
npm run build      # vite build → dist/
```

All frontend files use lowercase-with-hyphens naming (`app.tsx`,
`dashboard-view.tsx`, `calendar-grid.tsx`, `analytics-chart.tsx`, …).

## API overview

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | – |
| GET | `/api/auth/config` | – |
| POST | `/api/auth/google` | – (Google ID token → local JWT) |
| GET | `/api/auth/me` | JWT |
| POST | `/api/exams/upload` | JWT |
| GET | `/api/exams` | JWT |
| GET | `/api/exams/search?q=` | JWT |
| POST/GET/DELETE | `/api/medications` | JWT |
| GET | `/api/calendar` | JWT |
| GET | `/api/analytics/time-series?start_date&end_date&specs=A&specs=B` | JWT |

All responses are JSON; protected routes require
`Authorization: Bearer <TOKEN>`.
