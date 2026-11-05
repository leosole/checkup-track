"""FastAPI application: Google auth, exam ingestion, medications, calendar,
global search, and analytics time-series endpoints.

Every response is JSON. All routes except ``/health`` and the Google
sign-in/config routes require ``Authorization: Bearer <TOKEN>``.
"""

import logging
import os
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import FileResponse
from starlette.types import Scope
from sqlmodel import Session, select

import object_storage

from auth import (
    AuthConfigError,
    create_access_token,
    get_current_user,
    get_google_client_id,
    upsert_user,
    verify_google_id_token,
)
from credentials import encrypt_api_key
from database import MARKDOWN_DIR, get_session, init_db
from job_worker import notify_worker, start_worker, stop_worker
from models import (
    AuthResponse,
    BiomarkerResponse,
    CalendarExam,
    CalendarMedication,
    CalendarResponse,
    Exam,
    ExamBiomarker,
    ExamProcessingJob,
    ExamRename,
    ExamResponse,
    GoogleAuthRequest,
    GoogleConfigResponse,
    HealthResponse,
    LLMProvider,
    ManualExamInput,
    Medication,
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
    ProviderCredentialInput,
    ProviderCredentialStatus,
    ProviderOrderUpdate,
    TimeSeries,
    TimeSeriesPoint,
    TimeSeriesResponse,
    User,
    UserProviderCredential,
    UserResponse,
)
from parser import enqueue_exam, search_exams

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
DEFAULT_PROVIDER_ORDER = tuple(provider.value for provider in LLMProvider)


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            accepts_html = "text/html" in Headers(scope=scope).get("accept", "")
            is_api_path = path == "api" or path.startswith("api/")
            if (
                exc.status_code != 404
                or is_api_path
                or Path(path).suffix
                or not accepts_html
            ):
                raise
            return FileResponse(Path(self.all_directories[0]) / "index.html")


app = FastAPI(
    title="Health Dashboard API",
    description="Stateless JSON API for the health dashboard (web + future Android clients).",
    version="1.0.0",
    lifespan=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    start_worker()


@app.on_event("shutdown")
def on_shutdown() -> None:
    stop_worker()


# ---------------------------------------------------------------------------
# Public routes
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse, tags=["public"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="health-dashboard-api")


@app.get("/api/auth/config", response_model=GoogleConfigResponse, tags=["auth"])
def auth_config() -> GoogleConfigResponse:
    """Let the frontend learn the Google OAuth client ID."""
    return GoogleConfigResponse(google_client_id=get_google_client_id())


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


@app.post("/api/auth/google", response_model=AuthResponse, tags=["auth"])
def google_sign_in(
    payload: GoogleAuthRequest,
    session: Session = Depends(get_session),
) -> AuthResponse:
    """Verify a Google ID token and issue a local stateless JWT."""
    try:
        claims = verify_google_id_token(payload.token)
    except AuthConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Google ID token: {exc}",
        ) from exc
    user = upsert_user(session, claims)
    token = create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name),
    )


@app.get("/api/auth/me", response_model=UserResponse, tags=["auth"])
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, name=user.name)


def _provider_statuses(
    session: Session,
    user_id: str,
) -> List[ProviderCredentialStatus]:
    rows = session.exec(
        select(UserProviderCredential).where(UserProviderCredential.user_id == user_id)
    ).all()
    credentials = {row.provider: row for row in rows}
    default_positions = {
        provider: index for index, provider in enumerate(DEFAULT_PROVIDER_ORDER)
    }
    ordered_providers = sorted(
        DEFAULT_PROVIDER_ORDER,
        key=lambda provider: (
            credentials[provider].order_index
            if provider in credentials
            else default_positions[provider],
            default_positions[provider],
        ),
    )
    return [
        ProviderCredentialStatus(
            provider=provider,
            configured=bool(credentials.get(provider) and credentials[provider].encrypted_api_key),
            order=index,
        )
        for index, provider in enumerate(ordered_providers)
    ]


@app.get(
    "/api/profile/providers",
    response_model=List[ProviderCredentialStatus],
    tags=["profile"],
)
def list_provider_credentials(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ProviderCredentialStatus]:
    return _provider_statuses(session, user.id)


@app.put(
    "/api/profile/providers/order",
    response_model=List[ProviderCredentialStatus],
    tags=["profile"],
)
def update_provider_order(
    payload: ProviderOrderUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ProviderCredentialStatus]:
    providers = [provider.value for provider in payload.providers]
    if len(providers) != len(DEFAULT_PROVIDER_ORDER) or set(providers) != set(
        DEFAULT_PROVIDER_ORDER
    ):
        raise HTTPException(
            status_code=422,
            detail="Order must include each supported provider exactly once.",
        )

    existing_rows = {
        row.provider: row
        for row in session.exec(
            select(UserProviderCredential).where(
                UserProviderCredential.user_id == user.id
            )
        ).all()
    }
    for index, provider in enumerate(providers):
        row = existing_rows.get(provider) or UserProviderCredential(
            user_id=user.id,
            provider=provider,
        )
        row.order_index = index
        session.add(row)
    session.commit()
    return _provider_statuses(session, user.id)


@app.put(
    "/api/profile/providers/{provider}",
    response_model=List[ProviderCredentialStatus],
    tags=["profile"],
)
def save_provider_credential(
    provider: LLMProvider,
    payload: ProviderCredentialInput,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ProviderCredentialStatus]:
    try:
        encrypted_api_key = encrypt_api_key(payload.api_key)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    provider_name = provider.value
    row = session.exec(
        select(UserProviderCredential).where(
            UserProviderCredential.user_id == user.id,
            UserProviderCredential.provider == provider_name,
        )
    ).first()
    if row is None:
        row = UserProviderCredential(
            user_id=user.id,
            provider=provider_name,
            order_index=DEFAULT_PROVIDER_ORDER.index(provider_name),
        )
    row.encrypted_api_key = encrypted_api_key
    session.add(row)
    session.commit()
    return _provider_statuses(session, user.id)


@app.delete("/api/profile/providers/{provider}", status_code=204, tags=["profile"])
def delete_provider_credential(
    provider: LLMProvider,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    row = session.exec(
        select(UserProviderCredential).where(
            UserProviderCredential.user_id == user.id,
            UserProviderCredential.provider == provider.value,
        )
    ).first()
    if row is not None:
        row.encrypted_api_key = None
        session.add(row)
        session.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Exams
# ---------------------------------------------------------------------------


def _exam_to_response(
    session: Session,
    exam: Exam,
    biomarkers: Optional[List[ExamBiomarker]] = None,
) -> ExamResponse:
    if biomarkers is None:
        biomarkers = session.exec(
            select(ExamBiomarker).where(ExamBiomarker.exam_id == exam.id)
        ).all()
    job = session.get(ExamProcessingJob, exam.id)
    return ExamResponse(
        id=exam.id,
        title=exam.title,
        date_performed=exam.date_performed,
        pdf_path=exam.pdf_path,
        markdown_path=exam.markdown_path,
        biomarkers=[
            BiomarkerResponse(
                id=b.id,
                biomarker_name=b.biomarker_name,
                value=b.value,
                unit=b.unit,
                reference_range=b.reference_range,
                is_abnormal=b.is_abnormal,
            )
            for b in biomarkers
        ],
        extraction_error=job.error if job else None,
        processing=(
            {
                "status": job.status,
                "stage": job.stage,
                "completed_chunks": job.completed_chunks,
                "total_chunks": job.total_chunks,
                "retry_allowed": job.status == "failed",
                "updated_at": job.updated_at,
            }
            if job
            else None
        ),
    )


@app.post(
    "/api/exams/upload",
    response_model=ExamResponse,
    status_code=202,
    tags=["exams"],
)
async def upload_exam(
    file: UploadFile = File(...),
    title: Optional[str] = Form(default=None),
    user: User = Depends(get_current_user),
) -> ExamResponse:
    """Accept and persist a PDF, then enqueue background extraction.

    ``title`` lets the user name the exam; blank means "use the report's own
    title, then the PDF file name".
    """
    filename = file.filename or "exam.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF exceeds the 25 MB upload limit.")
    try:
        exam = enqueue_exam(pdf_bytes, filename, user.id, title)
        notify_worker()
        return exam
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface parse failures as HTTP errors
        logger.exception("Exam processing failed")
        raise HTTPException(
            status_code=500,
            detail="Failed to queue the PDF for processing.",
        ) from exc


@app.post("/api/exams/{exam_id}/retry", response_model=ExamResponse, tags=["exams"])
def retry_exam_extraction(
    exam_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExamResponse:
    exam = session.get(Exam, exam_id)
    if exam is None or exam.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found.")
    job = session.get(ExamProcessingJob, exam_id)
    if job is None:
        raise HTTPException(status_code=409, detail="This exam has no extraction job.")
    if job.status != "failed":
        raise HTTPException(status_code=409, detail="Only failed extraction jobs can be retried.")

    job.status = "queued"
    job.stage = "queued"
    job.error = None
    job.next_attempt_at = datetime.now(timezone.utc)
    job.lease_expires_at = None
    job.updated_at = datetime.now(timezone.utc)
    session.add(job)
    session.commit()
    session.refresh(exam)
    session.refresh(job)
    notify_worker()
    return _exam_to_response(session, exam)


@app.get("/api/exams", response_model=List[ExamResponse], tags=["exams"])
def list_exams(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ExamResponse]:
    exams = session.exec(
        select(Exam).where(Exam.user_id == user.id).order_by(Exam.date_performed.desc())
    ).all()
    return [_exam_to_response(session, exam) for exam in exams]


@app.patch("/api/exams/{exam_id}", response_model=ExamResponse, tags=["exams"])
def rename_exam(
    exam_id: int,
    payload: ExamRename,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Rename an exam (a blank name is rejected; omit the call instead)."""
    exam = session.get(Exam, exam_id)
    if exam is None or exam.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found.")
    exam.title = payload.title.strip()
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return _exam_to_response(session, exam)


@app.put("/api/exams/{exam_id}/manual", response_model=ExamResponse, tags=["exams"])
def save_manual_exam_results(
    exam_id: int,
    payload: ManualExamInput,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Save manually entered exam details and results for an owned exam."""
    exam = session.get(Exam, exam_id)
    if exam is None or exam.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found.")

    exam.title = payload.title
    exam.date_performed = payload.date_performed
    existing_biomarkers = session.exec(
        select(ExamBiomarker).where(ExamBiomarker.exam_id == exam_id)
    ).all()
    for biomarker in existing_biomarkers:
        session.delete(biomarker)

    for biomarker in payload.biomarkers:
        session.add(
            ExamBiomarker(
                exam_id=exam_id,
                biomarker_name=biomarker.biomarker_name,
                value=biomarker.value,
                unit=biomarker.unit,
                reference_range=biomarker.reference_range or None,
                is_abnormal=biomarker.is_abnormal,
            )
        )

    session.add(exam)
    session.commit()
    session.refresh(exam)
    return _exam_to_response(session, exam)


@app.delete("/api/exams/{exam_id}", tags=["exams"])
def delete_exam(
    exam_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Delete an exam, its biomarkers, and its stored PDF."""
    exam = session.get(Exam, exam_id)
    if exam is None or exam.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found.")

    try:
        object_storage.delete_pdf(exam.pdf_path)
    except Exception as exc:  # noqa: BLE001 - preserve the row if storage fails
        logger.exception("Could not delete stored PDF for exam %s", exam_id)
        raise HTTPException(
            status_code=502,
            detail="Could not delete the stored PDF.",
        ) from exc

    biomarkers = session.exec(
        select(ExamBiomarker).where(ExamBiomarker.exam_id == exam_id)
    ).all()
    job = session.get(ExamProcessingJob, exam_id)
    if job is not None:
        session.delete(job)
    for biomarker in biomarkers:
        session.delete(biomarker)
    session.delete(exam)
    session.commit()

    markdown_path = MARKDOWN_DIR / Path(exam.markdown_path).name
    try:
        markdown_path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete Markdown for exam %s", exam_id, exc_info=True)

    return {"deleted": exam_id}


@app.get("/api/exams/{exam_id}/pdf", tags=["exams"])
def download_exam_pdf(
    exam_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """Stream the stored PDF for one exam (B2 object or local fallback file)."""
    exam = session.get(Exam, exam_id)
    if exam is None or exam.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found.")
    try:
        if exam.pdf_path.startswith("exams/"):
            pdf_bytes = object_storage.download_pdf(exam.pdf_path)
        else:
            local_path = object_storage.local_pdf_path(exam.pdf_path)
            if not local_path.is_file():
                raise HTTPException(
                    status_code=404,
                    detail="The stored PDF is no longer available.",
                )
            pdf_bytes = local_path.read_bytes()
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - storage failure is an upstream error
        logger.exception("Could not read stored PDF %s", exam.pdf_path)
        raise HTTPException(
            status_code=502,
            detail=f"Could not read the stored PDF: {exc}",
        ) from exc

    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", exam.title).strip("._") or f"exam-{exam.id}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{stem}.pdf"'},
    )


@app.get("/api/exams/search", response_model=List[ExamResponse], tags=["exams"])
def search_exam_route(
    q: str = Query(default="", max_length=200),
    user: User = Depends(get_current_user),
) -> List[ExamResponse]:
    """Text lookup across past parsed exam fields, biomarkers, and names."""
    return search_exams(user.id, q)


# ---------------------------------------------------------------------------
# Medications
# ---------------------------------------------------------------------------


@app.post("/api/medications", response_model=MedicationResponse, tags=["medications"])
def create_medication(
    payload: MedicationCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MedicationResponse:
    if payload.end_date is not None and payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=422,
            detail="end_date must be on or after start_date.",
        )
    med = Medication(
        user_id=user.id,
        name=payload.medication_name.strip(),
        dosage=payload.dosage.strip(),
        frequency_per_day=payload.frequency_per_day,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    session.add(med)
    session.commit()
    session.refresh(med)
    return MedicationResponse(
        id=med.id,
        name=med.name,
        dosage=med.dosage,
        frequency_per_day=med.frequency_per_day,
        start_date=med.start_date,
        end_date=med.end_date,
    )


@app.get("/api/medications", response_model=List[MedicationResponse], tags=["medications"])
def list_medications(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[MedicationResponse]:
    meds = session.exec(
        select(Medication)
        .where(Medication.user_id == user.id)
        .order_by(Medication.start_date.desc())
    ).all()
    return [
        MedicationResponse(
            id=m.id,
            name=m.name,
            dosage=m.dosage,
            frequency_per_day=m.frequency_per_day,
            start_date=m.start_date,
            end_date=m.end_date,
        )
        for m in meds
    ]


@app.patch(
    "/api/medications/{medication_id}",
    response_model=MedicationResponse,
    tags=["medications"],
)
def update_medication(
    medication_id: int,
    payload: MedicationUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MedicationResponse:
    """Edit a medication in place; only the supplied fields change."""
    med = session.get(Medication, medication_id)
    if med is None or med.user_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found.")

    provided = payload.model_fields_set
    if "medication_name" in provided and payload.medication_name is not None:
        med.name = payload.medication_name.strip()
    if "dosage" in provided and payload.dosage is not None:
        med.dosage = payload.dosage.strip()
    if "frequency_per_day" in provided and payload.frequency_per_day is not None:
        med.frequency_per_day = payload.frequency_per_day
    if "start_date" in provided and payload.start_date is not None:
        med.start_date = payload.start_date
    if "end_date" in provided:
        med.end_date = payload.end_date
    if med.end_date is not None and med.end_date < med.start_date:
        raise HTTPException(
            status_code=422,
            detail="end_date must be on or after start_date.",
        )

    session.add(med)
    session.commit()
    session.refresh(med)
    return MedicationResponse(
        id=med.id,
        name=med.name,
        dosage=med.dosage,
        frequency_per_day=med.frequency_per_day,
        start_date=med.start_date,
        end_date=med.end_date,
    )


@app.delete("/api/medications/{medication_id}", tags=["medications"])
def delete_medication(
    medication_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    med = session.get(Medication, medication_id)
    if med is None or med.user_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found.")
    session.delete(med)
    session.commit()
    return {"deleted": medication_id}


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------


@app.get("/api/calendar", response_model=CalendarResponse, tags=["calendar"])
def calendar(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CalendarResponse:
    exams = session.exec(
        select(Exam).where(Exam.user_id == user.id).order_by(Exam.date_performed)
    ).all()
    meds = session.exec(
        select(Medication).where(Medication.user_id == user.id).order_by(Medication.start_date)
    ).all()
    return CalendarResponse(
        exams=[
            CalendarExam(id=e.id, title=e.title, date=e.date_performed)
            for e in exams
        ],
        medications=[
            CalendarMedication(
                id=m.id,
                name=m.name,
                start_date=m.start_date,
                end_date=m.end_date,
            )
            for m in meds
        ],
    )


# ---------------------------------------------------------------------------
# Analytics time-series
# ---------------------------------------------------------------------------


@app.get("/api/analytics/time-series", response_model=TimeSeriesResponse, tags=["analytics"])
def time_series(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    specs: List[str] = Query(default=[]),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TimeSeriesResponse:
    """Group biomarker matches chronologically for the requested specs.

    Query example: ``?start_date=2024-01-01&end_date=2025-12-31&specs=Glucose&specs=Hemoglobin``
    """
    specs = [s.strip() for s in specs if s and s.strip()]
    if not specs:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one specs= query parameter.",
        )

    rows = session.exec(
        select(ExamBiomarker, Exam)
        .join(Exam, ExamBiomarker.exam_id == Exam.id)
        .where(Exam.user_id == user.id)
        .order_by(Exam.date_performed)
    ).all()

    series: List[TimeSeries] = []
    for spec in specs:
        spec_lower = spec.lower()
        points: List[TimeSeriesPoint] = []
        unit = ""
        for biomarker, exam in rows:
            if start_date is not None and exam.date_performed < start_date:
                continue
            if end_date is not None and exam.date_performed > end_date:
                continue
            if spec_lower in biomarker.biomarker_name.lower():
                if not unit:
                    unit = biomarker.unit
                points.append(
                    TimeSeriesPoint(
                        date=exam.date_performed,
                        value=biomarker.value,
                        is_abnormal=biomarker.is_abnormal,
                        exam_title=exam.title,
                    )
                )
        points.sort(key=lambda p: p.date)
        series.append(TimeSeries(spec=spec, unit=unit, points=points))

    return TimeSeriesResponse(series=series)


# ---------------------------------------------------------------------------
# Built SPA (single-service hosts such as Render)
# ---------------------------------------------------------------------------

# Hosts that serve only this ASGI app need the SPA from the same origin, which
# keeps every frontend call on relative /api paths. It stays opt-in for local
# development, where Vite serves the frontend separately.
if os.environ.get("SERVE_STATIC", "").strip() == "1":
    FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if FRONTEND_DIST.is_dir():
        # Mounted last so /health, /api/* and /openapi.json keep precedence.
        app.mount(
            "/",
            SPAStaticFiles(directory=str(FRONTEND_DIST), html=True),
            name="spa",
        )
        logger.info("Serving the built SPA from %s", FRONTEND_DIST)
    else:
        logger.warning(
            "SERVE_STATIC=1 but %s is missing (run `npm --prefix frontend run build`)",
            FRONTEND_DIST,
        )
