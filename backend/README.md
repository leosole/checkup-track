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

Set these backend values in `.env.local` or the deployment environment; the app
loads local dotenv files automatically, while variables you export yourself
take precedence:

- `CREDENTIAL_ENCRYPTION_KEY` — stable high-entropy secret used to encrypt user-supplied LLM keys at rest; do not rotate without re-encrypting saved keys
- `GOOGLE_CLIENT_ID` — Google OAuth web client ID for ID-token verification
- `JWT_SECRET` — signing secret for local JWTs (a generated dev secret is persisted to `.jwt_secret` when unset)

Each user adds provider keys and chooses their order in Profile. Supported
providers are Gemini, Groq, OpenAI, Claude, DeepSeek, Mistral, and OpenRouter.
The API decrypts keys at runtime, so the hosting operator remains trusted.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | – | Health check |
| GET | `/api/auth/config` | – | Google client ID for the frontend |
| POST | `/api/auth/google` | – | Verify Google ID token → issue local JWT |
| GET | `/api/auth/me` | JWT | Current user profile |
| GET | `/api/profile/providers` | JWT | Provider setup status and order, never keys |
| PUT | `/api/profile/providers/{provider}` | JWT | Save or replace a provider key |
| DELETE | `/api/profile/providers/{provider}` | JWT | Remove a provider key |
| PUT | `/api/profile/providers/order` | JWT | Set the complete provider order |
| POST | `/api/exams/upload` | JWT | Upload a lab-report PDF (parse → extract → insert) |
| GET | `/api/exams` | JWT | List exams with biomarkers |
| GET | `/api/exams/search?q=` | JWT | Global text search over exams/biomarkers |
| POST | `/api/medications` | JWT | Add a medication with one or more dated uses |
| GET | `/api/medications` | JWT | List medication uses |
| PATCH | `/api/medications/uses/{id}` | JWT | Edit one use |
| DELETE | `/api/medications/uses/{id}` | JWT | Remove one use |
| GET | `/api/calendar` | JWT | Exam dates + medication use ranges |
| GET | `/api/analytics/time-series` | JWT | `?start_date&end_date&specs=A&specs=B` grouped series |

## Storage layout

- Raw PDFs: `storage/pdfs/`
- Parsed markdown: `storage/markdowns/`
- SQLite database: `health.db`
