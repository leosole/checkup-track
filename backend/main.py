"""FastAPI application: Google auth, exam ingestion, medications, calendar,
global search, and analytics time-series endpoints.

Every response is JSON. All routes except ``/health`` and the Google
sign-in/config routes require ``Authorization: Bearer <TOKEN>``.
"""

import logging
from datetime import date
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from auth import (
    AuthConfigError,
    create_access_token,
    get_current_user,
    get_google_client_id,
    upsert_user,
    verify_google_id_token,
)
from database import get_session, init_db
from models import (
    AuthResponse,
    BiomarkerResponse,
    CalendarExam,
    CalendarMedication,
    CalendarResponse,
    Exam,
    ExamBiomarker,
    ExamResponse,
    GoogleAuthRequest,
    GoogleConfigResponse,
    HealthResponse,
    Medication,
    MedicationCreate,
    MedicationResponse,
    TimeSeries,
    TimeSeriesPoint,
    TimeSeriesResponse,
    User,
    UserResponse,
)
from parser import process_exam, search_exams

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

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
    )


@app.post("/api/exams/upload", response_model=ExamResponse, tags=["exams"])
async def upload_exam(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> ExamResponse:
    """Accept a PDF, parse it, extract structured biomarkers, and persist."""
    filename = file.filename or "exam.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF exceeds the 25 MB upload limit.")
    try:
        return process_exam(pdf_bytes, filename, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface parse failures as HTTP errors
        logger.exception("Exam processing failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process the PDF: {exc}",
        ) from exc


@app.get("/api/exams", response_model=List[ExamResponse], tags=["exams"])
def list_exams(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ExamResponse]:
    exams = session.exec(
        select(Exam).where(Exam.user_id == user.id).order_by(Exam.date_performed.desc())
    ).all()
    return [_exam_to_response(session, exam) for exam in exams]


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
