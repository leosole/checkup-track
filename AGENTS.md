# Agent instructions — CheckUpTrack

Read this before changing anything. It assumes you already know how to code;
it exists to stop you from breaking conventions that are not obvious from the
file tree.

## What this is

A personal health-record dashboard. A signed-in user uploads a lab-report PDF;
the backend converts it to Markdown, calls the user's ordered LLM provider list,
and stores the exam plus its individual biomarkers. The UI then shows exam history,
biomarker trends, a medication list, and a calendar of exams and medications.

Two processes, one repo:

- `backend/` — FastAPI + SQLModel, the whole API. Runs on port 8000.
- `frontend/` — React 18 + Vite + Tailwind, a single-page app. Proxies `/api`
  and `/health` to 8000 in dev.

Focused backend tests live in `backend/tests/`. "Verified" means the CI steps
below pass plus a manual API smoke test (see *Verification*).

## Layout

```
api/index.py            ASGI entrypoint used by Render (re-exports backend app)
api/requirements.txt    canonical production dependency list (used by Render)
backend/main.py         all routes, auth dependencies, upload size guard
backend/models.py       SQLModel tables + Pydantic request/response schemas
backend/database.py     engine/session setup, DATABASE_URL vs SQLite, init_db()
backend/auth.py         Google ID-token verification, JWT issue/verify, current user
backend/parser.py       PDF -> Markdown -> ordered per-user provider extraction, exam search
backend/credentials.py  authenticated encryption/decryption for provider API keys
backend/object_storage.py  Backblaze B2 (S3 API) with local-disk fallback
frontend/src/app.tsx    auth gate: SignInView when signed out, DashboardView when signed in
frontend/src/api-client.ts  typed fetch wrapper; every protected call sends Bearer token
frontend/src/auth-context.tsx  user bootstrap; JWT lives in localStorage (`vitals.jwt`)
frontend/src/components/  dashboard/, calendar-grid, analytics-chart,
                          medication-modal, symptom-modal, sign-in-view,
                          share-view (owner), guest-view (public read-only),
                          ui/ primitives
scripts/preview.sh      starts uvicorn (8000) + vite (5173 by default) locally
```

## Commands

```bash
# backend; create the venv once. Upload extraction requires a signed-in user with
# at least one provider key configured in Profile and CREDENTIAL_ENCRYPTION_KEY:
#   cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
# Always run the backend with the venv interpreter: the system `python3` may be
# older than the dependencies allow (uvicorn, markitdown).
cd backend && .venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or start the backend and frontend together:
sh scripts/preview.sh

# frontend
npm --prefix frontend install
npm --prefix frontend run dev        # 5173, proxies /api + /health -> 8000
npm --prefix frontend run typecheck  # tsc --noEmit
npm --prefix frontend run build      # vite build -> frontend/dist
```

CI (`.github/workflows/ci.yml`) runs exactly: `npm ci && npm run typecheck &&
npm run build` in `frontend/`, and `pip install -r requirements.txt`, focused
`unittest` checks, and a table-schema assertion in `backend/`. Do not add slow or
network-heavy steps to CI.

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
- **Frontend routing** uses TanStack Router file-based routing. Add page routes
  under `frontend/src/routes/`; the auth gate lives in `__root.tsx`. Keep router
  construction in `frontend/src/router.tsx` and avoid manual History API use.
- **The localStorage token key is still `vitals.jwt`**, a leftover from the
  project's earlier names. Renaming it signs every existing user out; do it
  deliberately or not at all.
- **Frontend naming is lowercase-with-hyphens** (`dashboard-view.tsx`,
  `analytics-chart.tsx`). UI primitives live in `components/ui/`; feature
  components sit directly in `components/`. Keep components small and read
  data through `api-client.ts`.
- **Styling**: Tailwind with the project's own tokens (`index.css` CSS vars,
  `tailwind.config.ts` brand palette). Reuse existing UI primitives and the
  Untitled-UI-ish spacing/shadow styles instead of inventing a new look. Do not
  remove the Tailwind directives, theme variables, or body styles.
- **`vite.config.ts`** has a dev proxy to 8000 and HMR enabled by default; set
  `VITE_NO_HMR=1` when serving through a proxy that cannot upgrade the HMR
  websocket. Leave the proxy targets alone.
- **Use `git` and `gh` for GitHub work.** The former
  `scripts/git-askpass.sh`, `github_sync.py`, `push_history.py` and
  `sync_branches.py` were sandbox workarounds that pulled a token out of
  `.env.local` to bypass unauthenticated git; they have been removed. Do not
  reintroduce askpass/token-wrapper scripts or read `.env.local` for a
  credential.

## Frontend file structure

These rules apply to every file under `frontend/src/`:

- **Route files own the route.** A file in `routes/` contains the route
  definition and the page's structural shell (layout container, loading branch,
  which view renders). It must not be a bare passthrough that only returns
  another component.
- **Types live in their own files.** No `interface`/`type` declarations inline in
  a component file. Split components put them in the folder's `types.ts`, UI
  primitives use `components/ui/types.ts`, single-file components share
  `components/types.ts`, and anything describing API payloads goes in
  `src/types/`.
- **Split files that do too much.** When one file mixes data loading, handlers
  and several rendered sections, break it into chunks.
- **Chunks live in a folder named after the component**, with `index.tsx` as the
  entry point (`components/analytics-chart/index.tsx`).
- **Do not repeat the component name in chunk filenames.** Use
  `calendar-grid/bars.ts`, `share-view/group-list.tsx`,
  `share-view/created-code.tsx` — not `calendar-grid/calendar-grid-bars.ts`.
- A component that is a single self-contained file stays flat as
  `components/name.tsx`; only split components get a folder.
- Pure helpers, formatting and constants go in a named module (`format.ts`,
  `bars.ts`, `share-utils.ts`) rather than being buried inside JSX.
- **Functions and hooks are camelCase** — `formatDate`, `useRouteContent`,
  `api.listExams()` — never `snake_case`. Wire-format fields from the API keep
  the names the backend sends.

## Environment

| Key | Needed for | Missing behavior |
| --- | --- | --- |
| `CREDENTIAL_ENCRYPTION_KEY` | encrypting user-owned provider keys at rest | saving keys fails closed; keep the value stable or saved keys become unreadable |
| `GOOGLE_CLIENT_ID` | sign-in | `/api/auth/config` reports not configured, sign-in disabled |
| `JWT_SECRET` | signing tokens | dev: auto-generated `backend/.jwt_secret`; prod: unstable tokens |
| `DATABASE_URL` | Postgres in production | falls back to SQLite |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` | durable PDF storage | local disk (ephemeral in production) |
| `SERVE_STATIC` | set `1` on Render so FastAPI also serves `frontend/dist` at `/` | unset locally |

`env.example` is the template; `.env.local` holds real dev values. Never read or
print it. `backend/env_loader.py` loads `.env.local` / `.env` into `os.environ`
when the backend is imported (existing shell/CI/platform values always win), so
plain `uvicorn main:app` picks them up too — do not reintroduce `--env-file`
flags or shell `source` steps, and keep the `load_env_files()` call before any
module reads configuration. Configure production variables in Render's service
environment; GitHub Actions secrets are only available inside CI and do not
reach the running app.

Provider API keys are entered by each user in Profile, encrypted before database
storage, and never returned by the profile API. The backend decrypts them at
runtime, so the Render service owner remains trusted. Supported providers are
Gemini, Groq, OpenAI, Claude, DeepSeek, Mistral, and OpenRouter.

## API map

Public: `GET /health`, `GET /api/auth/config`, `POST /api/auth/google`,
`POST /api/shares/redeem`.
JWT: `GET /api/auth/me`; `GET /api/profile/providers`,
`PUT /api/profile/providers/{provider}`, `DELETE /api/profile/providers/{provider}`,
`PUT /api/profile/providers/order`; `POST /api/exams/upload` (multipart `file` + optional
`title`, ≤ 25 MB); `GET /api/exams`; `PATCH /api/exams/{id}` (rename / change date);
`GET /api/exams/{id}/pdf` (streams the stored PDF); `GET /api/exams/search?q=`;
`POST|GET /api/medications` (JSON: `medication_name` + `uses[]` with dosage,
frequency and dates), `PATCH|DELETE /api/medications/uses/{id}`;
`POST /api/symptoms` (JSON: `title` + `dates[]` occurrences),
`PATCH|DELETE /api/symptoms/occurrences/{id}`; `GET /api/calendar`;
`POST /api/shares` accepts `symptom_occurrence_ids` alongside
`exam_ids`/`medication_use_ids`, and guests get symptoms and medication uses
nested under their title;
`GET /api/analytics/time-series?specs=Glucose&specs=Hemoglobin&start_date=&end_date=`.
Sharing: `POST|GET /api/shares`, `PATCH /api/shares/groups` (name or rename a
share group; an empty title clears it), `DELETE /api/shares/{id}` (revoke).
Guest reads: `GET /api/guest/data`, `GET /api/guest/exams/{id}/pdf`,
`GET /api/guest/analytics/time-series?specs=` (scoped to the shared exams only).
Routes keep the `/api/` prefix so the Vite proxy and the Render-hosted SPA work.

Sharing rules: a share is one selection of owned exams/medications. Only the
SHA-256 hash of its code is stored; the plaintext is returned once by
`POST /api/shares`. A code redeems once (`POST /api/shares/redeem`) and yields a
JWT with `scope="guest"`; `get_current_user` rejects that scope, so guest access
is read-only by construction. `GET /api/shares` groups codes by their exact
selection (`group_key`) and reports `times_shared`, which is what "share again"
reuses. Identical selections are one group; changing the selection makes a new one.

## Verification

Before calling work done:

1. `cd backend && .venv/bin/python -c "import main, parser, auth, database, models; from sqlmodel import SQLModel; print(sorted(SQLModel.metadata.tables))"` — must list `exam, exambiomarker, medication, medicationuse, shareexam, sharegrant, sharegrouptitle, sharemedication, sharesymptom, symptom, symptomoccurrence, user, userprovidercredential`.
2. `npm --prefix frontend run typecheck` (and `build` when touching UI).
3. Smoke the changed endpoints against a running backend. Use a throwaway DB
   (e.g. `DATABASE_URL=sqlite:////tmp/smoke.db`) so you never pollute `backend/health.db`.
   Unauthenticated protected routes must still return 401.
4. Keep the Render Blueprint's build command, ASGI entrypoint, and required
  runtime environment variables in sync when changing `api/`, requirements,
  or the frontend build setup.

## Known constraints

- Hosting caps request bodies around a few MB, below the app's 25 MB upload
  guard; large PDFs will fail in production even though they pass locally.
- Parsing is LLM-based and non-deterministic; provider models may change and
  failover can send report text to multiple configured providers. Do not assert
  exact extracted values in tests.
- All dates are plain `date` columns (`Exam.date_performed`, `MedicationUse.start_date`/
  `end_date`) serialized as ISO `YYYY-MM-DD`. Keep new date logic consistent with
  `CalendarExam` and `frontend/src/date-utils.ts`; avoid inventing timestamps.
