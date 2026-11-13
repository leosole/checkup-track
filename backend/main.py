"""FastAPI application: Google auth, exam ingestion, medications, calendar,
global search, and analytics time-series endpoints.

Every response is JSON. All routes except ``/health`` and the Google
sign-in/config routes require ``Authorization: Bearer <TOKEN>``.
"""

import hashlib
import logging
import os
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

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
from sqlalchemy import func, update
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import FileResponse
from starlette.types import Scope
from sqlmodel import Session, delete, select

import object_storage

from auth import (
    AuthConfigError,
    as_utc,
    create_access_token,
    create_guest_token,
    get_current_user,
    get_google_client_id,
    get_guest_share,
    require_capability,
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
    CalendarSymptom,
    Exam,
    ExamBiomarker,
    ExamProcessingJob,
    ExamUpdate,
    ExamResponse,
    GoogleAuthRequest,
    GoogleConfigResponse,
    GuestAuthResponse,
    GuestCodeRequest,
    GuestExamResponse,
    GuestShareData,
    GuestShareInfo,
    GuestSymptomOccurrenceResponse,
    GuestSymptomResponse,
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
    ShareCodeResponse,
    ShareCreatedResponse,
    ShareCreate,
    ShareExam,
    ShareGrant,
    ShareGroupResponse,
    ShareMedication,
    ShareSymptom,
    SharedExamSummary,
    SharedMedicationSummary,
    SharedSymptomOccurrenceSummary,
    SharedSymptomSummary,
    Symptom,
    SymptomCreate,
    SymptomOccurrence,
    SymptomOccurrenceResponse,
    SymptomOccurrenceUpdate,
    TimeSeries,
    TimeSeriesPoint,
    TimeSeriesResponse,
    User,
    UserProviderCredential,
    UserResponse,
)
from parser import enqueue_exam, save_exam_without_extraction, search_exams
from test_user import (
    ensure_test_user,
    prepare_test_share,
    sample_pdf,
    test_user_enabled,
    user_response,
)

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
    return GoogleConfigResponse(
        google_client_id=get_google_client_id(),
        test_user_enabled=test_user_enabled(),
    )


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
        user=user_response(user),
    )


@app.post("/api/auth/test", response_model=AuthResponse, tags=["auth"])
def test_sign_in(session: Session = Depends(get_session)) -> AuthResponse:
    if not test_user_enabled():
        raise HTTPException(status_code=404, detail="Test-user login is not enabled.")
    user = ensure_test_user(session)
    return AuthResponse(access_token=create_access_token(user.id), user=user_response(user))


@app.get("/api/auth/me", response_model=UserResponse, tags=["auth"])
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return user_response(user)


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
    user: User = Depends(require_capability("manage_providers")),
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
    user: User = Depends(require_capability("manage_providers")),
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
    user: User = Depends(require_capability("manage_providers")),
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
        laboratory=exam.laboratory,
        color=exam.color,
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
    date_performed: Optional[date] = Form(default=None),
    image_only: bool = Form(default=False),
    user: User = Depends(require_capability("create_records")),
) -> ExamResponse:
    """Persist an exam file, queueing extraction unless it is image-only.

    ``title`` lets the user name the exam; blank means "use the report's own
    title, then the PDF file name".
    """
    filename = file.filename or "exam.pdf"
    if not image_only and not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB upload limit.")
    try:
        if image_only:
            exam = save_exam_without_extraction(
                file_bytes, filename, user.id, title, date_performed
            )
        else:
            exam = enqueue_exam(file_bytes, filename, user.id, title, date_performed)
            notify_worker()
        return exam
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface parse failures as HTTP errors
        logger.exception("Exam processing failed")
        raise HTTPException(
            status_code=500,
            detail="Failed to save the uploaded exam.",
        ) from exc


@app.post("/api/exams/{exam_id}/retry", response_model=ExamResponse, tags=["exams"])
def retry_exam_extraction(
    exam_id: int,
    user: User = Depends(require_capability("retry_extraction")),
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
def update_exam(
    exam_id: int,
    payload: ExamUpdate,
    user: User = Depends(require_capability("edit_exam_metadata")),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Update an exam's name, date, laboratory, and/or calendar color.

    Every field is optional; omitted fields keep their current value. Sending
    ``laboratory: null`` or ``color: null`` clears it.
    """
    exam = session.get(Exam, exam_id)
    if exam is None or exam.user_id != user.id:
        raise HTTPException(status_code=404, detail="Exam not found.")
    provided = payload.model_fields_set
    if payload.title is not None:
        exam.title = payload.title
    if payload.date_performed is not None:
        exam.date_performed = payload.date_performed
    if "laboratory" in provided:
        exam.laboratory = payload.laboratory
    if "color" in provided:
        exam.color = payload.color
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return _exam_to_response(session, exam)


@app.put("/api/exams/{exam_id}/manual", response_model=ExamResponse, tags=["exams"])
def save_manual_exam_results(
    exam_id: int,
    payload: ManualExamInput,
    user: User = Depends(require_capability("edit_results")),
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
    user: User = Depends(require_capability("delete_records")),
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

    # The models declare foreign keys but no relationships, so the unit of work
    # has no dependency graph to order deletes with: flush it as explicit
    # statements, children first, so the exam row is never removed while it is
    # still referenced.
    session.exec(delete(ExamBiomarker).where(ExamBiomarker.exam_id == exam_id))
    session.exec(delete(ShareExam).where(ShareExam.exam_id == exam_id))
    session.exec(delete(ExamProcessingJob).where(ExamProcessingJob.exam_id == exam_id))
    session.delete(exam)
    session.commit()

    markdown_path = MARKDOWN_DIR / Path(exam.markdown_path).name
    try:
        markdown_path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete Markdown for exam %s", exam_id, exc_info=True)

    return {"deleted": exam_id}


def _read_exam_pdf(exam: Exam) -> bytes:
    """Return the stored PDF bytes from B2 or the local fallback file."""
    try:
        fixture = sample_pdf(exam)
        if fixture is not None:
            return fixture
        if exam.pdf_path.startswith("exams/"):
            return object_storage.download_pdf(exam.pdf_path)
        local_path = object_storage.local_pdf_path(exam.pdf_path)
        if not local_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="The stored PDF is no longer available.",
            )
        return local_path.read_bytes()
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - storage failure is an upstream error
        logger.exception("Could not read stored PDF %s", exam.pdf_path)
        raise HTTPException(
            status_code=502,
            detail=f"Could not read the stored PDF: {exc}",
        ) from exc


def _pdf_response(exam: Exam, pdf_bytes: bytes) -> Response:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", exam.title).strip("._") or f"exam-{exam.id}"
    suffix = Path(exam.pdf_path).suffix.lower() or ".pdf"
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(suffix, "application/pdf")
    return Response(
        content=pdf_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{stem}{suffix}"'},
    )


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
    return _pdf_response(exam, _read_exam_pdf(exam))


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
    user: User = Depends(require_capability("create_records")),
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
        color=payload.color,
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
        color=med.color,
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
            color=m.color,
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
    user: User = Depends(require_capability("edit_medications")),
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
    if "color" in provided:
        med.color = payload.color
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
        color=med.color,
    )


@app.delete("/api/medications/{medication_id}", tags=["medications"])
def delete_medication(
    medication_id: int,
    user: User = Depends(require_capability("delete_records")),
    session: Session = Depends(get_session),
) -> dict:
    med = session.get(Medication, medication_id)
    if med is None or med.user_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found.")
    # Delete share links first, for the same reason as in delete_exam: without
    # relationships there is no dependency graph to order the flush with.
    session.exec(
        delete(ShareMedication).where(ShareMedication.medication_id == medication_id)
    )
    session.delete(med)
    session.commit()
    return {"deleted": medication_id}


# ---------------------------------------------------------------------------
# Symptoms: a reusable title plus dated occurrences
# ---------------------------------------------------------------------------


def _symptom_occurrence_response(
    occurrence: SymptomOccurrence, symptom: Symptom
) -> SymptomOccurrenceResponse:
    return SymptomOccurrenceResponse(
        id=occurrence.id,
        symptom_id=symptom.id,
        title=symptom.title,
        observation=occurrence.observation,
        start_date=occurrence.start_date,
        end_date=occurrence.end_date,
    )


def _symptom_by_title(
    session: Session, user_id: str, title: str
) -> Optional[Symptom]:
    """Case-insensitive lookup of one of the user's symptom names."""
    return session.exec(
        select(Symptom).where(
            Symptom.user_id == user_id,
            func.lower(Symptom.title) == title.lower(),
        )
    ).first()


def _check_symptom_range(start_date: date, end_date: Optional[date]) -> None:
    if end_date is not None and end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="end_date must be on or after start_date.",
        )


@app.post(
    "/api/symptoms",
    response_model=List[SymptomOccurrenceResponse],
    tags=["symptoms"],
)
def create_symptoms(
    payload: SymptomCreate,
    user: User = Depends(require_capability("create_records")),
    session: Session = Depends(get_session),
) -> List[SymptomOccurrenceResponse]:
    """Log one occurrence per date entry under a reused or new symptom title."""
    for entry in payload.dates:
        _check_symptom_range(entry.start_date, entry.end_date)

    title = payload.title.strip()
    symptom = _symptom_by_title(session, user.id, title)
    if symptom is None:
        symptom = Symptom(user_id=user.id, title=title)
        session.add(symptom)
        session.flush()

    occurrences = [
        SymptomOccurrence(
            symptom_id=symptom.id,
            observation=entry.observation,
            start_date=entry.start_date,
            end_date=entry.end_date,
        )
        for entry in payload.dates
    ]
    session.add_all(occurrences)
    session.commit()
    for occurrence in occurrences:
        session.refresh(occurrence)
    session.refresh(symptom)
    return [
        _symptom_occurrence_response(occurrence, symptom)
        for occurrence in occurrences
    ]


@app.patch(
    "/api/symptoms/occurrences/{occurrence_id}",
    response_model=SymptomOccurrenceResponse,
    tags=["symptoms"],
)
def update_symptom_occurrence(
    occurrence_id: int,
    payload: SymptomOccurrenceUpdate,
    user: User = Depends(require_capability("edit_symptoms")),
    session: Session = Depends(get_session),
) -> SymptomOccurrenceResponse:
    """Edit one occurrence; a new title renames its parent symptom."""
    occurrence = session.get(SymptomOccurrence, occurrence_id)
    symptom = (
        session.get(Symptom, occurrence.symptom_id) if occurrence is not None else None
    )
    if occurrence is None or symptom is None or symptom.user_id != user.id:
        raise HTTPException(status_code=404, detail="Symptom occurrence not found.")

    provided = payload.model_fields_set
    if "title" in provided and payload.title is not None:
        requested = payload.title.strip()
        if requested.lower() != symptom.title.lower():
            existing = _symptom_by_title(session, user.id, requested)
            if existing is not None and existing.id != symptom.id:
                # Merge this occurrence into the symptom that already has the
                # name, then drop the old symptom if it has nothing left.
                previous = symptom
                occurrence.symptom_id = existing.id
                session.add(occurrence)
                session.flush()
                remaining = session.exec(
                    select(SymptomOccurrence).where(
                        SymptomOccurrence.symptom_id == previous.id
                    )
                ).first()
                if remaining is None:
                    session.delete(previous)
                symptom = existing
            else:
                symptom.title = requested
    if "observation" in provided:
        occurrence.observation = payload.observation
    if "start_date" in provided and payload.start_date is not None:
        occurrence.start_date = payload.start_date
    if "end_date" in provided:
        occurrence.end_date = payload.end_date
    _check_symptom_range(occurrence.start_date, occurrence.end_date)

    session.add(occurrence)
    session.commit()
    session.refresh(occurrence)
    session.refresh(symptom)
    return _symptom_occurrence_response(occurrence, symptom)


@app.delete("/api/symptoms/occurrences/{occurrence_id}", tags=["symptoms"])
def delete_symptom_occurrence(
    occurrence_id: int,
    user: User = Depends(require_capability("delete_records")),
    session: Session = Depends(get_session),
) -> dict:
    """Remove one occurrence, and the symptom name once nothing uses it."""
    occurrence = session.get(SymptomOccurrence, occurrence_id)
    symptom = (
        session.get(Symptom, occurrence.symptom_id) if occurrence is not None else None
    )
    if occurrence is None or symptom is None or symptom.user_id != user.id:
        raise HTTPException(status_code=404, detail="Symptom occurrence not found.")

    # Share links point at occurrences, so they go first.
    session.exec(
        delete(ShareSymptom).where(ShareSymptom.occurrence_id == occurrence.id)
    )
    session.delete(occurrence)
    session.flush()
    remaining = session.exec(
        select(SymptomOccurrence).where(SymptomOccurrence.symptom_id == symptom.id)
    ).first()
    if remaining is None:
        session.delete(symptom)
    session.commit()
    return {"deleted": occurrence_id}


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
    symptom_rows = session.exec(
        select(SymptomOccurrence, Symptom)
        .join(Symptom, SymptomOccurrence.symptom_id == Symptom.id)
        .where(Symptom.user_id == user.id)
        .order_by(SymptomOccurrence.start_date, Symptom.title)
    ).all()
    return CalendarResponse(
        exams=[
            CalendarExam(
                id=e.id,
                title=e.title,
                date=e.date_performed,
                color=e.color,
            )
            for e in exams
        ],
        medications=[
            CalendarMedication(
                id=m.id,
                name=m.name,
                start_date=m.start_date,
                end_date=m.end_date,
                color=m.color,
            )
            for m in meds
        ],
        symptoms=[
            CalendarSymptom(
                id=occurrence.id,
                symptom_id=symptom.id,
                title=symptom.title,
                observation=occurrence.observation,
                start_date=occurrence.start_date,
                end_date=occurrence.end_date,
            )
            for occurrence, symptom in symptom_rows
        ],
    )


# ---------------------------------------------------------------------------
# Analytics time-series
# ---------------------------------------------------------------------------


def _clean_specs(specs: List[str]) -> List[str]:
    cleaned = [s.strip() for s in specs if s and s.strip()]
    if not cleaned:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one specs= query parameter.",
        )
    return cleaned


def _build_time_series(
    rows: Sequence[Tuple[ExamBiomarker, Exam]],
    specs: List[str],
    start_date: Optional[date],
    end_date: Optional[date],
) -> TimeSeriesResponse:
    """Group exact normalized biomarker-name matches chronologically."""
    series: List[TimeSeries] = []
    for spec in specs:
        spec_key = spec.strip().casefold()
        points: List[TimeSeriesPoint] = []
        unit = ""
        for biomarker, exam in rows:
            if start_date is not None and exam.date_performed < start_date:
                continue
            if end_date is not None and exam.date_performed > end_date:
                continue
            if spec_key == biomarker.biomarker_name.strip().casefold():
                if not unit:
                    unit = biomarker.unit
                points.append(
                    TimeSeriesPoint(
                        date=exam.date_performed,
                        value=biomarker.value,
                        is_abnormal=biomarker.is_abnormal,
                        exam_title=exam.title,
                        reference_range=biomarker.reference_range,
                    )
                )
        points.sort(key=lambda p: p.date)
        series.append(TimeSeries(spec=spec, unit=unit, points=points))
    return TimeSeriesResponse(series=series)


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
    specs = _clean_specs(specs)

    rows = session.exec(
        select(ExamBiomarker, Exam)
        .join(Exam, ExamBiomarker.exam_id == Exam.id)
        .where(Exam.user_id == user.id)
        .order_by(Exam.date_performed)
    ).all()

    return _build_time_series(rows, specs, start_date, end_date)


# ---------------------------------------------------------------------------
# Sharing: single-use guest codes for selected records
# ---------------------------------------------------------------------------

SHARE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
SHARE_CODE_LENGTH = 12
SHARE_CODE_GROUP = 4


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_share_code(code: str) -> str:
    """Accept codes typed with or without dashes and in any case."""
    return re.sub(r"[^A-Z0-9]", "", code.upper())


def _hash_share_code(code: str) -> str:
    return hashlib.sha256(_normalize_share_code(code).encode("utf-8")).hexdigest()


def _generate_share_code() -> str:
    raw = "".join(
        secrets.choice(SHARE_CODE_ALPHABET) for _ in range(SHARE_CODE_LENGTH)
    )
    return "-".join(
        raw[index : index + SHARE_CODE_GROUP]
        for index in range(0, SHARE_CODE_LENGTH, SHARE_CODE_GROUP)
    )


def _share_status(share: ShareGrant) -> str:
    if share.revoked_at is not None:
        return "revoked"
    if share.used_at is not None:
        return "used"
    if as_utc(share.expires_at) <= _utcnow():
        return "expired"
    return "active"


def _share_code_response(
    share: ShareGrant,
    code: Optional[str] = None,
) -> ShareCodeResponse:
    return ShareCodeResponse(
        id=share.id,
        code=code,
        created_at=as_utc(share.created_at),
        expires_at=as_utc(share.expires_at),
        used_at=as_utc(share.used_at) if share.used_at else None,
        revoked_at=as_utc(share.revoked_at) if share.revoked_at else None,
        status=_share_status(share),
    )


def _share_group_key(
    exam_ids: List[int],
    medication_ids: List[int],
    symptom_occurrence_ids: List[int] = [],
) -> str:
    """Stable identity of a selection, so identical re-shares group together."""
    exams = ",".join(str(item) for item in sorted(exam_ids))
    medications = ",".join(str(item) for item in sorted(medication_ids))
    key = f"exams={exams};medications={medications}"
    if symptom_occurrence_ids:
        symptoms = ",".join(str(item) for item in sorted(symptom_occurrence_ids))
        key += f";symptoms={symptoms}"
    return key


def _share_selection(
    session: Session,
    shares: List[ShareGrant],
) -> Dict[int, Tuple[List[int], List[int], List[int]]]:
    """Map each share id to its exam, medication and symptom occurrence ids."""
    if not shares:
        return {}
    share_ids = [share.id for share in shares]
    exam_rows = session.exec(
        select(ShareExam).where(ShareExam.share_id.in_(share_ids))
    ).all()
    medication_rows = session.exec(
        select(ShareMedication).where(ShareMedication.share_id.in_(share_ids))
    ).all()
    symptom_rows = session.exec(
        select(ShareSymptom).where(ShareSymptom.share_id.in_(share_ids))
    ).all()
    exam_ids: Dict[int, List[int]] = {}
    medication_ids: Dict[int, List[int]] = {}
    occurrence_ids: Dict[int, List[int]] = {}
    for row in exam_rows:
        exam_ids.setdefault(row.share_id, []).append(row.exam_id)
    for row in medication_rows:
        medication_ids.setdefault(row.share_id, []).append(row.medication_id)
    for row in symptom_rows:
        occurrence_ids.setdefault(row.share_id, []).append(row.occurrence_id)
    return {
        share.id: (
            sorted(exam_ids.get(share.id, [])),
            sorted(medication_ids.get(share.id, [])),
            sorted(occurrence_ids.get(share.id, [])),
        )
        for share in shares
    }


def _shared_symptoms(
    occurrence_ids: List[int],
    occurrences_by_id: Dict[int, Tuple[SymptomOccurrence, Symptom]],
) -> List[SharedSymptomSummary]:
    """Group selected occurrences under their symptom titles."""
    grouped: Dict[int, SharedSymptomSummary] = {}
    for occurrence_id in occurrence_ids:
        entry = occurrences_by_id.get(occurrence_id)
        if entry is None:
            continue
        occurrence, symptom = entry
        summary = grouped.get(symptom.id)
        if summary is None:
            summary = SharedSymptomSummary(id=symptom.id, title=symptom.title)
            grouped[symptom.id] = summary
        summary.occurrences.append(
            SharedSymptomOccurrenceSummary(
                id=occurrence.id,
                start_date=occurrence.start_date,
                end_date=occurrence.end_date,
            )
        )
    for summary in grouped.values():
        summary.occurrences.sort(key=lambda item: item.start_date)
    return sorted(grouped.values(), key=lambda item: item.title.lower())


def _guest_share_info(session: Session, share: ShareGrant) -> GuestShareInfo:
    owner = session.get(User, share.owner_id)
    exam_ids, medication_ids, symptom_ids = _share_selection(session, [share]).get(
        share.id, ([], [], [])
    )
    return GuestShareInfo(
        owner_name=owner.name if owner else "the record owner",
        expires_at=as_utc(share.expires_at),
        exam_count=len(exam_ids),
        medication_count=len(medication_ids),
        symptom_count=len(symptom_ids),
    )


@app.post(
    "/api/shares",
    response_model=ShareCreatedResponse,
    status_code=201,
    tags=["shares"],
)
def create_share(
    payload: ShareCreate,
    user: User = Depends(require_capability("create_shares")),
    session: Session = Depends(get_session),
) -> ShareCreatedResponse:
    """Mint a single-use code for the selected exams and medications.

    The plaintext code is returned exactly once; only its hash is stored.
    """
    exam_ids = sorted(set(payload.exam_ids))
    medication_ids = sorted(set(payload.medication_ids))
    symptom_occurrence_ids = sorted(set(payload.symptom_occurrence_ids))
    if not exam_ids and not medication_ids and not symptom_occurrence_ids:
        raise HTTPException(
            status_code=422,
            detail="Select at least one exam, medication or symptom to share.",
        )

    if exam_ids:
        owned_exams = session.exec(
            select(Exam.id).where(Exam.user_id == user.id, Exam.id.in_(exam_ids))
        ).all()
        if sorted(owned_exams) != exam_ids:
            raise HTTPException(
                status_code=404,
                detail="Some of the selected exams were not found.",
            )
    if medication_ids:
        owned_medications = session.exec(
            select(Medication.id).where(
                Medication.user_id == user.id, Medication.id.in_(medication_ids)
            )
        ).all()
        if sorted(owned_medications) != medication_ids:
            raise HTTPException(
                status_code=404,
                detail="Some of the selected medications were not found.",
            )
    if symptom_occurrence_ids:
        owned_occurrences = session.exec(
            select(SymptomOccurrence.id)
            .join(Symptom, SymptomOccurrence.symptom_id == Symptom.id)
            .where(
                Symptom.user_id == user.id,
                SymptomOccurrence.id.in_(symptom_occurrence_ids),
            )
        ).all()
        if sorted(owned_occurrences) != symptom_occurrence_ids:
            raise HTTPException(
                status_code=404,
                detail="Some of the selected symptoms were not found.",
            )

    now = _utcnow()
    prepare_test_share(session, user, now)
    code = ""
    for _ in range(5):
        candidate = _generate_share_code()
        exists = session.exec(
            select(ShareGrant.id).where(
                ShareGrant.code_hash == _hash_share_code(candidate)
            )
        ).first()
        if exists is None:
            code = candidate
            break
    if not code:
        raise HTTPException(
            status_code=503,
            detail="Could not generate a share code. Try again.",
        )

    share = ShareGrant(
        owner_id=user.id,
        code_hash=_hash_share_code(code),
        created_at=now,
        expires_at=now + timedelta(days=payload.expires_in_days),
    )
    session.add(share)
    session.commit()
    session.refresh(share)
    for exam_id in exam_ids:
        session.add(ShareExam(share_id=share.id, exam_id=exam_id))
    for medication_id in medication_ids:
        session.add(ShareMedication(share_id=share.id, medication_id=medication_id))
    for occurrence_id in symptom_occurrence_ids:
        session.add(ShareSymptom(share_id=share.id, occurrence_id=occurrence_id))
    session.commit()

    logger.info(
        "User %s shared %s exams, %s medications and %s symptom occurrences",
        user.id,
        len(exam_ids),
        len(medication_ids),
        len(symptom_occurrence_ids),
    )
    return ShareCreatedResponse(
        group_key=_share_group_key(
            exam_ids, medication_ids, symptom_occurrence_ids
        ),
        share=_share_code_response(share, code=code),
    )


@app.get("/api/shares", response_model=List[ShareGroupResponse], tags=["shares"])
def list_share_groups(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ShareGroupResponse]:
    """List every selection the user has shared, grouped, with a share count."""
    shares = session.exec(
        select(ShareGrant)
        .where(ShareGrant.owner_id == user.id)
        .order_by(ShareGrant.created_at.desc())
    ).all()
    if not shares:
        return []

    selection = _share_selection(session, shares)
    exams_by_id = {
        exam.id: exam
        for exam in session.exec(select(Exam).where(Exam.user_id == user.id)).all()
    }
    medications_by_id = {
        medication.id: medication
        for medication in session.exec(
            select(Medication).where(Medication.user_id == user.id)
        ).all()
    }
    occurrences_by_id = {
        occurrence.id: (occurrence, symptom)
        for occurrence, symptom in session.exec(
            select(SymptomOccurrence, Symptom)
            .join(Symptom, SymptomOccurrence.symptom_id == Symptom.id)
            .where(Symptom.user_id == user.id)
        ).all()
    }

    groups: Dict[str, Dict[str, object]] = {}
    for share in shares:
        exam_ids, medication_ids, symptom_ids = selection.get(
            share.id, ([], [], [])
        )
        # Records deleted since sharing simply drop out of the group.
        remaining_exams = [item for item in exam_ids if item in exams_by_id]
        remaining_medications = [
            item for item in medication_ids if item in medications_by_id
        ]
        remaining_symptoms = [
            item for item in symptom_ids if item in occurrences_by_id
        ]
        if not remaining_exams and not remaining_medications and not remaining_symptoms:
            continue
        key = _share_group_key(
            remaining_exams, remaining_medications, remaining_symptoms
        )
        group = groups.setdefault(
            key,
            {
                "exam_ids": remaining_exams,
                "medication_ids": remaining_medications,
                "symptom_occurrence_ids": remaining_symptoms,
                "shares": [],
            },
        )
        group["shares"].append(share)  # type: ignore[union-attr]

    result: List[ShareGroupResponse] = []
    for key, group in groups.items():
        exam_ids = group["exam_ids"]
        medication_ids = group["medication_ids"]
        symptom_ids = group["symptom_occurrence_ids"]
        group_shares: List[ShareGrant] = group["shares"]  # type: ignore[assignment]
        group_shares.sort(key=lambda item: as_utc(item.created_at), reverse=True)
        result.append(
            ShareGroupResponse(
                group_key=key,
                exam_ids=exam_ids,  # type: ignore[arg-type]
                medication_ids=medication_ids,  # type: ignore[arg-type]
                symptom_occurrence_ids=symptom_ids,  # type: ignore[arg-type]
                exams=[
                    SharedExamSummary(
                        id=item,
                        title=exams_by_id[item].title,
                        date_performed=exams_by_id[item].date_performed,
                    )
                    for item in exam_ids  # type: ignore[union-attr]
                ],
                medications=[
                    SharedMedicationSummary(
                        id=item,
                        name=medications_by_id[item].name,
                        dosage=medications_by_id[item].dosage,
                    )
                    for item in medication_ids  # type: ignore[union-attr]
                ],
                symptoms=_shared_symptoms(
                    symptom_ids,  # type: ignore[arg-type]
                    occurrences_by_id,
                ),
                times_shared=len(group_shares),
                last_shared_at=as_utc(group_shares[0].created_at),
                active_codes=sum(
                    1 for item in group_shares if _share_status(item) == "active"
                ),
                codes=[_share_code_response(item) for item in group_shares],
            )
        )

    result.sort(key=lambda item: item.last_shared_at, reverse=True)
    return result


@app.delete("/api/shares/{share_id}", status_code=204, tags=["shares"])
def revoke_share(
    share_id: int,
    user: User = Depends(require_capability("revoke_shares")),
    session: Session = Depends(get_session),
) -> Response:
    """Revoke one code; an already-redeemed guest session stops working too."""
    share = session.get(ShareGrant, share_id)
    if share is None or share.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Share not found.")
    if share.revoked_at is None:
        share.revoked_at = _utcnow()
        session.add(share)
        session.commit()
    return Response(status_code=204)


@app.post(
    "/api/shares/redeem",
    response_model=GuestAuthResponse,
    tags=["shares"],
)
def redeem_share_code(
    payload: GuestCodeRequest,
    session: Session = Depends(get_session),
) -> GuestAuthResponse:
    """Exchange a single-use code for a read-only guest session."""
    share = session.exec(
        select(ShareGrant).where(
            ShareGrant.code_hash == _hash_share_code(payload.code)
        )
    ).first()
    if share is None:
        raise HTTPException(status_code=401, detail="That share code is not valid.")
    if share.revoked_at is not None:
        raise HTTPException(
            status_code=403, detail="The owner revoked this share code."
        )
    if share.used_at is not None:
        raise HTTPException(
            status_code=403,
            detail="This share code has already been used. Ask for a new one.",
        )
    if as_utc(share.expires_at) <= _utcnow():
        raise HTTPException(
            status_code=403,
            detail="This share code has expired. Ask for a new one.",
        )

    # Atomic claim so two simultaneous redemptions cannot both succeed.
    claimed = session.exec(
        update(ShareGrant)
        .where(ShareGrant.id == share.id, ShareGrant.used_at.is_(None))
        .values(used_at=_utcnow())
    )
    session.commit()
    if claimed.rowcount != 1:
        raise HTTPException(
            status_code=403,
            detail="This share code has already been used. Ask for a new one.",
        )
    session.refresh(share)

    logger.info("Share %s redeemed", share.id)
    return GuestAuthResponse(
        access_token=create_guest_token(share.id, share.expires_at),
        share=_guest_share_info(session, share),
    )


@app.get("/api/guest/data", response_model=GuestShareData, tags=["guest"])
def guest_shared_data(
    share: ShareGrant = Depends(get_guest_share),
    session: Session = Depends(get_session),
) -> GuestShareData:
    """Read-only payload: only the records this code was issued for."""
    exam_ids, medication_ids, symptom_ids = _share_selection(session, [share]).get(
        share.id, ([], [], [])
    )

    exams: List[Exam] = []
    biomarkers_by_exam: Dict[int, List[ExamBiomarker]] = {}
    if exam_ids:
        exams = session.exec(
            select(Exam)
            .where(Exam.id.in_(exam_ids))
            .order_by(Exam.date_performed.desc())
        ).all()
        biomarkers = session.exec(
            select(ExamBiomarker).where(
                ExamBiomarker.exam_id.in_([exam.id for exam in exams])
            )
        ).all()
        for biomarker in biomarkers:
            biomarkers_by_exam.setdefault(biomarker.exam_id, []).append(biomarker)

    medications = (
        session.exec(
            select(Medication)
            .where(Medication.id.in_(medication_ids))
            .order_by(Medication.start_date.desc())
        ).all()
        if medication_ids
        else []
    )

    symptom_rows = (
        session.exec(
            select(SymptomOccurrence, Symptom)
            .join(Symptom, SymptomOccurrence.symptom_id == Symptom.id)
            .where(SymptomOccurrence.id.in_(symptom_ids))
            .order_by(Symptom.title, SymptomOccurrence.start_date.desc())
        ).all()
        if symptom_ids
        else []
    )
    symptoms_by_id: Dict[int, GuestSymptomResponse] = {}
    for occurrence, symptom in symptom_rows:
        guest_symptom = symptoms_by_id.get(symptom.id)
        if guest_symptom is None:
            guest_symptom = GuestSymptomResponse(id=symptom.id, title=symptom.title)
            symptoms_by_id[symptom.id] = guest_symptom
        guest_symptom.occurrences.append(
            GuestSymptomOccurrenceResponse(
                id=occurrence.id,
                observation=occurrence.observation,
                start_date=occurrence.start_date,
                end_date=occurrence.end_date,
            )
        )

    return GuestShareData(
        share=_guest_share_info(session, share),
        exams=[
            GuestExamResponse(
                id=exam.id,
                title=exam.title,
                date_performed=exam.date_performed,
                biomarkers=[
                    BiomarkerResponse(
                        id=biomarker.id,
                        biomarker_name=biomarker.biomarker_name,
                        value=biomarker.value,
                        unit=biomarker.unit,
                        reference_range=biomarker.reference_range,
                        is_abnormal=biomarker.is_abnormal,
                    )
                    for biomarker in biomarkers_by_exam.get(exam.id, [])
                ],
            )
            for exam in exams
        ],
        medications=[
            MedicationResponse(
                id=medication.id,
                name=medication.name,
                dosage=medication.dosage,
                frequency_per_day=medication.frequency_per_day,
                start_date=medication.start_date,
                end_date=medication.end_date,
                color=medication.color,
            )
            for medication in medications
        ],
        symptoms=list(symptoms_by_id.values()),
    )


@app.get(
    "/api/guest/analytics/time-series",
    response_model=TimeSeriesResponse,
    tags=["guest"],
)
def guest_time_series(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    specs: List[str] = Query(default=[]),
    share: ShareGrant = Depends(get_guest_share),
    session: Session = Depends(get_session),
) -> TimeSeriesResponse:
    """Read-only trends for the shared exams only.

    Mirrors ``/api/analytics/time-series`` but is scoped to this code's
    selection, so a guest can never plot records that were not shared.
    """
    specs = _clean_specs(specs)
    exam_ids, _, _ = _share_selection(session, [share]).get(
        share.id, ([], [], [])
    )
    if not exam_ids:
        return _build_time_series([], specs, start_date, end_date)

    rows = session.exec(
        select(ExamBiomarker, Exam)
        .join(Exam, ExamBiomarker.exam_id == Exam.id)
        .where(Exam.id.in_(exam_ids))
        .order_by(Exam.date_performed)
    ).all()
    return _build_time_series(rows, specs, start_date, end_date)


@app.get("/api/guest/exams/{exam_id}/pdf", tags=["guest"])
def guest_exam_pdf(
    exam_id: int,
    share: ShareGrant = Depends(get_guest_share),
    session: Session = Depends(get_session),
) -> Response:
    """Stream a PDF only when it belongs to one of the shared exams."""
    if session.get(ShareExam, (share.id, exam_id)) is None:
        raise HTTPException(status_code=404, detail="Exam not found.")
    exam = session.get(Exam, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return _pdf_response(exam, _read_exam_pdf(exam))


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
