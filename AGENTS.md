# Agent instructions — exametry

Read this before changing anything. It assumes you already know how to code;
it exists to stop you from breaking conventions that are not obvious from the
file tree.

## What this is

A personal health-record dashboard. A signed-in user uploads a lab-report PDF;
the backend converts it to Markdown, asks Groq (an LLM) for structured data, and
stores the exam plus its individual biomarkers. The UI then shows exam history,
biomarker trends, a medication list, and a calendar of exams and medications.

Two processes, one repo:

- `backend/` — FastAPI + SQLModel, the whole API. Runs on port 8000.
- `frontend/` — React 18 + Vite + Tailwind, a single-page app. Proxies `/api`
  and `/health` to 8000 in dev.

There are no tests. "Verified" means the CI steps below pass plus a manual API
smoke test (see *Verification*).

## Layout

```
api/index.py            ASGI entrypoint used by Freebuff hosting (re-exports backend app)
api/requirements.txt    canonical production dependency list (hosting installs this)
backend/main.py         all routes, auth dependencies, upload size guard
backend/models.py       SQLModel tables + Pydantic request/response schemas
backend/database.py     engine/session setup, DATABASE_URL vs SQLite, init_db()
backend/auth.py         Google ID-token verification, JWT issue/verify, current user
backend/parser.py       PDF -> Markdown -> Groq extraction, exam search
backend/object_storage.py  Backblaze B2 (S3 API) with local-disk fallback
frontend/src/app.tsx    auth gate: SignInView when signed out, DashboardView when signed in
frontend/src/api-client.ts  typed fetch wrapper; every protected call sends Bearer token
frontend/src/auth-context.tsx  user bootstrap; JWT lives in localStorage (`vitals.jwt`)
frontend/src/components/  dashboard-view, calendar-grid, analytics-chart,
                          medication-modal, sign-in-view, ui/ primitives
scripts/preview.sh      starts uvicorn (8000) + vite ($PORT) for the preview
scripts/github_sync.py  PR/checks/merge via the GitHub API
scripts/push_history.py commit + push helper
```

## Commands

```bash
# backend (needs GROQ_API_KEY for uploads)
cd backend && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# frontend
npm --prefix frontend install
npm --prefix frontend run dev        # 5173, proxies /api + /health -> 8000
npm --prefix frontend run typecheck  # tsc --noEmit
npm --prefix frontend run build      # vite build -> frontend/dist
```

CI (`.github/workflows/ci.yml`) runs exactly: `npm ci && npm run typecheck &&
npm run build` in `frontend/`, and `pip install -r requirements.txt` plus an
import + table-schema assertion in `backend/`. Do not add slow or network-heavy
steps to CI.

In the Freebuff workspace, do **not** start the dev server by hand. Use
`freebuff-preview restart` / `status`; `scripts/preview.sh` binds both processes
to `0.0.0.0` and reads `$PORT` for the frontend.

## Conventions that matter

- **Backend has no package and uses flat imports** (`from database import ...`,
  `from models import ...`). Anything importing backend modules must run with
  `backend/` as the working directory or on `sys.path`. That is why
  `api/index.py` inserts `backend/` into `sys.path` instead of using relative
  imports. Never convert these to `backend.xxx` imports without also fixing the
  `api/` adapter and every script.
- **`api/index.py` is a shim, not a second app.** All routes belong in
  `backend/main.py`. Keep `app` re-exported; keep the guarded `init_db()` call
  (serverless hosts may skip ASGI startup events) and keep it non-fatal so
  `/health` still answers when the database is unreachable.
- **No migrations.** Tables are created by `SQLModel.metadata.create_all` in
  `init_db()`. Adding a column to an existing production table will not
  backfill — write a small migration or make it nullable/defaulted.
- **Database**: `DATABASE_URL` selects Postgres (production); unset means
  SQLite at `backend/health.db`. `postgres://` is normalized to
  `postgresql://`. Keep both paths working; CI runs on SQLite.
- **Storage**: `object_storage.py` uses B2 only when all three of
  `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` are set, otherwise local
  `backend/storage/`. Both must keep working — dev has no B2 keys. Never assume
  a returned PDF path is a local file; use `local_pdf_path()` / `download_pdf()`.
- **Auth**: Google ID token verified server-side (audience = `GOOGLE_CLIENT_ID`);
  the app then issues its own HS256 JWT. Protected routes use
  `Depends(get_current_user)`. Frontend stores the token and sends
  `Authorization: Bearer …`. Never move verification to the client.
- **Frontend has no router.** `app.tsx` switches on auth state. Don't add a
  routing library for one screen.
- **The localStorage token key is still `vitals.jwt`** from before the rename to
  exametry. Renaming it signs every existing user out; do it deliberately or not
  at all.
- **Frontend naming is lowercase-with-hyphens** (`dashboard-view.tsx`,
  `analytics-chart.tsx`). UI primitives live in `components/ui/`; feature
  components sit directly in `components/`. Keep components small and read
  data through `api-client.ts`.
- **Styling**: Tailwind with the project's own tokens (`index.css` CSS vars,
  `tailwind.config.ts` brand palette). Reuse existing UI primitives and the
  Untitled-UI-ish spacing/shadow styles instead of inventing a new look. Do not
  remove the Tailwind directives, theme variables, or body styles.
- **`vite.config.ts` has HMR disabled on purpose** and a dev proxy to 8000.
  Leave it alone.

## Environment

| Key | Needed for | Missing behavior |
| --- | --- | --- |
| `GROQ_API_KEY` | PDF extraction (`POST /api/exams/upload`) | upload fails with a config error |
| `GOOGLE_CLIENT_ID` | sign-in | `/api/auth/config` reports not configured, sign-in disabled |
| `JWT_SECRET` | signing tokens | dev: auto-generated `backend/.jwt_secret`; prod: unstable tokens |
| `DATABASE_URL` | Postgres in production | falls back to SQLite |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` | durable PDF storage | local disk (ephemeral in production) |

`env.example` is the template; `.env.local` holds real dev values and is loaded
automatically into terminals and the preview. Never read or print it. Production
variables are managed separately (`freebuff-deploy env set`) and GitHub Actions
secrets do not reach the running app — they only exist inside CI runners.

## API map

Public: `GET /health`, `GET /api/auth/config`, `POST /api/auth/google`.
JWT: `GET /api/auth/me`; `POST /api/exams/upload` (multipart `file`, ≤ 25 MB);
`GET /api/exams`; `GET /api/exams/search?q=`; `POST|GET /api/medications`,
`DELETE /api/medications/{id}`; `GET /api/calendar`;
`GET /api/analytics/time-series?specs=Glucose&specs=Hemoglobin&start_date=&end_date=`.
Routes keep the `/api/` prefix so the Vite proxy and the hosting catch-all both
work.

## Verification

Before calling work done:

1. `cd backend && python3 -c "import main, parser, auth, database, models; from sqlmodel import SQLModel; print(sorted(SQLModel.metadata.tables))"` — must list `exam, exambiomarker, medication, user`.
2. `npm --prefix frontend run typecheck` (and `build` when touching UI).
3. Smoke the changed endpoints against a running backend. Use a throwaway DB
   (e.g. `DATABASE_URL=sqlite:////tmp/smoke.db`) so you never pollute `backend/health.db`.
   Unauthenticated protected routes must still return 401.
4. `freebuff-deploy check` must stay `deployable: true` with `problems: []` when
   you touch `api/`, requirements, or the build setup.

## Known constraints

- Hosting caps request bodies around a few MB, below the app's 25 MB upload
  guard; large PDFs will fail in production even though they pass locally.
- Parsing is LLM-based and non-deterministic; `parser.py` pins a primary Groq
  model with fallbacks, but do not assert exact extracted values in tests.
- All dates are plain `date` columns (`Exam.date_performed`, `Medication.start_date`/
  `end_date`) serialized as ISO `YYYY-MM-DD`. Keep new date logic consistent with
  `CalendarExam` and `frontend/src/date-utils.ts`; avoid inventing timestamps.
