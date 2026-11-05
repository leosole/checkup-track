# Health Dashboard API (backend)

FastAPI + SQLModel + SQLite. Fully decoupled, API-first: every response is
JSON and all protected routes require `Authorization: Bearer <JWT>`.

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Interactive docs: http://localhost:8000/docs
- Health check: `GET /health`

## Environment

Copy `.env.example` to `.env.local` in the repo root and set the values; the app
loads that file (and `.env`) automatically, while variables you export yourself
take precedence:

- `GEMINI_API_KEY` — Gemini key used for LLM extraction (default `gemini-3.8-flash`, override with `GEMINI_MODEL`); tried first because its free tier accepts a whole report in one request. `GROQ_API_KEY` is the fallback (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`).
- `GOOGLE_CLIENT_ID` — Google OAuth web client ID for ID-token verification
- `JWT_SECRET` — signing secret for local JWTs (a generated dev secret is persisted to `.jwt_secret` when unset)

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | – | Health check |
| GET | `/api/auth/config` | – | Google client ID for the frontend |
| POST | `/api/auth/google` | – | Verify Google ID token → issue local JWT |
| GET | `/api/auth/me` | JWT | Current user profile |
| POST | `/api/exams/upload` | JWT | Upload a lab-report PDF (parse → extract → insert) |
| GET | `/api/exams` | JWT | List exams with biomarkers |
| GET | `/api/exams/search?q=` | JWT | Global text search over exams/biomarkers |
| POST | `/api/medications` | JWT | Add a medication |
| GET | `/api/medications` | JWT | List medications |
| DELETE | `/api/medications/{id}` | JWT | Remove a medication |
| GET | `/api/calendar` | JWT | Exam dates + medication ranges |
| GET | `/api/analytics/time-series` | JWT | `?start_date&end_date&specs=A&specs=B` grouped series |

## Storage layout

- Raw PDFs: `storage/pdfs/`
- Parsed markdown: `storage/markdowns/`
- SQLite database: `health.db`
