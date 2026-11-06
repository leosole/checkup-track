# CheckUpTrack — Health Dashboard Monorepo

Google-signed-in health dashboard that parses lab-report PDFs into structured
biomarker data (via MarkItDown and user-configured LLM providers) and visualizes
exams, medications, search, and multi-series time charts.

## Product overview

CheckUpTrack is a personal health-record dashboard for lab results. Instead of
hunting through PDFs from different labs and years, you upload each report once
and the app keeps every result in one place: a chronological exam history, a
trend charts for your markers, your medication list, and a calendar that puts exams and
medications on the same timeline.

- **Upload and automatic extraction** — upload a lab-report PDF and the app
  pulls out each biomarker with its value, unit, reference range, and
  out-of-range flag. Extraction runs in the background, reports its progress,
  and can be retried; a report that cannot be parsed can be saved with manually
  entered results or kept as PDF only.
- **Exam history** — recent exams on the dashboard, plus an exams screen with
  search by exam or biomarker, out-of-range filtering, a date range, sorting,
  inline rename, PDF download, and delete.
- **Exam details** — a modal showing the exam date, results, and reference
  ranges, with edit, download, and delete actions.
- **Biomarker trends** — plot any number of markers against each other over
  time. Search the marker picker, or click a marker on an exam card or in the
  exam details to add it to the plot; plotted markers are marked in place and
  remembered for your next visit. Abnormal points stand out, and hovering a
  point shows its value, date, and source exam.
- **Medications** — track name, dosage, doses per day, and start/end dates, with
  an active-medication count on the dashboard.
- **Calendar** — a month view of exams and medication periods; click any entry
  to open its details.
- **Sharing** — pick exams and medications and get a single-use code that
  expires after 1–30 days and can be revoked at any time. The guest gets a
  read-only view of exactly those records — results, medications, and the same
  trends chart, with nothing editable — and re-sharing the same selection is
  grouped instead of piling up duplicates.
- **Account and privacy** — Google sign-in, per-user records, and LLM provider
  keys encrypted at rest; you choose the providers and their failover order in
  Profile.
- Light and dark themes throughout, with a responsive layout that works on
  phone-width screens.

A deployed version can be tested on [checkup-track-bzzs.onrender.com](https://checkup-track-bzzs.onrender.com/), logging in as a test user. You won't be able to login with google (only for me atm)

## Repository layout

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
| `CREDENTIAL_ENCRYPTION_KEY` | Stable, high-entropy secret used to encrypt user LLM keys at rest; do not rotate without re-encrypting saved keys |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 web client ID for ID-token verification |
| `TEST_USER_ENABLED` | Set to `1` to enable public test-user login, disabled when unset or `0` |
| `JWT_SECRET` | Signing secret for local JWTs (a dev secret is auto-generated when unset) |
| `DATABASE_URL` | Postgres URL for production; SQLite (`backend/health.db`) is used when unset |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` | Backblaze B2 bucket for PDFs; local disk is used when unset |

Each signed-in user adds provider API keys and chooses their failover order in
Profile. Supported providers are Gemini, Groq, OpenAI, Claude, DeepSeek,
Mistral, and OpenRouter. Keys are encrypted in the database, but the API
decrypts them to make requests; the hosting operator can access them. A report
may be sent to each provider attempted.

### Test account

Enable `TEST_USER_ENABLED=1` in the backend environment, then choose **Login as
test user** on the sign-in screen. Google configuration, provider keys, and B2
credentials are not required. For a local preview:

```bash
TEST_USER_ENABLED=1 sh scripts/preview.sh
```

- The first login creates three synthetic exams, nine biomarker results, and two
  medications. Sample PDFs are bundled with the API.
- All visitors use one shared account. Exam title/date and medication edits
  persist and are visible to other visitors. Signing in again does not reset data.
- Visitors can view, search, download PDFs, use charts/calendar, edit existing
  metadata/medications, and create single-use shares.
- Uploads, new exams/medications, deletion, biomarker edits, extraction retries,
  provider changes, and share revocation are blocked by the API and hidden in the UI.
- Only synthetic records belong in this public account. Do not enter personal
  information in editable fields. Sharing exposes the selected records and their
  subsequent edits until expiry.
- The account supports at most 20 active codes and 100 unexpired codes including
  redeemed codes. Further sharing returns HTTP 429 until capacity is available.
  Expired test shares are removed when another share is created.
- The Render Blueprint enables this account. For an existing service, set
  `TEST_USER_ENABLED=1` in its Environment settings and redeploy. Set it to `0` and
  restart to hide the login option and invalidate existing test-account sessions.
  Already-redeemed guest sessions retain their original expiry.

### Production (Render Free)

`render.yaml` is a Render Blueprint for one free web service that runs the API
and serves the built SPA from the same origin (`SERVE_STATIC=1`), so the
frontend keeps calling relative `/api` paths and needs no CORS or API base URL.
The build step installs `api/requirements.txt` and builds `frontend/dist`.

The free plan shapes the rest of the setup:

- **Ephemeral disk** — set `B2_KEY_ID`, `B2_APPLICATION_KEY` and
  `B2_BUCKET_NAME`, or an exam's PDF disappears on the next deploy or spin-down.
- **Free Render Postgres expires 30 days after creation** — point `DATABASE_URL`
  at an external Postgres (Neon free tier) instead.
- **Spin-down after 15 minutes idle** — the first request afterwards takes about
  a minute while the service wakes.

Values to enter in the dashboard: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, and the
three `B2_*` keys. `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` are generated by
Render. Add the Render URL to the
OAuth client's authorized JavaScript origins, otherwise Google sign-in fails
before any request reaches the backend. GitHub Actions secrets are only
available to CI workflows; add runtime values in the Render service's
Environment settings (or provide them when syncing the Blueprint).

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
| POST | `/api/auth/test` | Public synthetic account, only when enabled |
| GET | `/api/auth/me` | JWT |
| GET | `/api/profile/providers` | JWT |
| PUT/DELETE | `/api/profile/providers/{provider}` | JWT |
| PUT | `/api/profile/providers/order` | JWT |
| POST | `/api/exams/upload` (multipart `file`, optional `title`) | JWT |
| GET | `/api/exams` | JWT |
| PATCH | `/api/exams/{id}` (rename) | JWT |
| GET | `/api/exams/{id}/pdf` | JWT |
| GET | `/api/exams/search?q=` | JWT |
| POST/GET/PATCH/DELETE | `/api/medications` | JWT |
| GET | `/api/calendar` | JWT |
| GET | `/api/analytics/time-series?start_date&end_date&specs=A&specs=B` | JWT |
| POST/GET | `/api/shares` (create returns the only copy of the code; list is grouped) | JWT |
| DELETE | `/api/shares/{id}` (revoke a code) | JWT |
| POST | `/api/shares/redeem` (single-use code → read-only guest JWT) | – |
| GET | `/api/guest/data` | Guest JWT |
| GET | `/api/guest/exams/{id}/pdf` | Guest JWT |
| GET | `/api/guest/analytics/time-series?start_date&end_date&specs=A` (shared exams only) | Guest JWT |

All responses are JSON; protected routes require
`Authorization: Bearer <TOKEN>`.

Sharing lets a user send one code for a chosen set of exams and medications. The
guest opens `/guest`, redeems the code once, and gets a read-only view; guest
tokens carry `scope="guest"` and are rejected by every owner route.
