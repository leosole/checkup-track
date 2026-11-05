"""Database models (SQLModel tables) and API/LLM schemas (Pydantic)."""

from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field as PydanticField, field_validator
from sqlmodel import Field, SQLModel


# ---------------------------------------------------------------------------
# Database models (SQLModel blueprint)
# ---------------------------------------------------------------------------


class User(SQLModel, table=True):
    id: str = Field(primary_key=True)  # Google Sub ID
    email: str
    name: str


class UserProviderCredential(SQLModel, table=True):
    user_id: str = Field(foreign_key="user.id", primary_key=True)
    provider: str = Field(primary_key=True)
    encrypted_api_key: Optional[str] = None
    order_index: int = Field(default=0)


class Exam(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    title: str
    date_performed: date
    pdf_path: str
    markdown_path: str


class ExamProcessingJob(SQLModel, table=True):
    exam_id: int = Field(foreign_key="exam.id", primary_key=True)
    status: str = Field(default="queued", index=True)
    stage: str = Field(default="queued")
    completed_chunks: int = Field(default=0)
    total_chunks: int = Field(default=0)
    partial_results_json: str = Field(default="[]")
    error: Optional[str] = None
    requested_title: Optional[str] = None
    attempts: int = Field(default=0)
    next_attempt_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lease_expires_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExamBiomarker(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    exam_id: int = Field(foreign_key="exam.id", index=True)
    biomarker_name: str  # e.g., Glucose, Cholesterol
    value: float
    unit: str  # e.g., mg/dL, g/L
    reference_range: Optional[str] = None
    is_abnormal: bool


class Medication(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    name: str
    dosage: str
    frequency_per_day: int
    start_date: date
    end_date: Optional[date] = None


# ---------------------------------------------------------------------------
# The strict LLM structured format
# ---------------------------------------------------------------------------


class LLMExamsExtractionSchema(BaseModel):
    title: str
    date_performed: Optional[date]
    biomarkers: List[ExamBiomarker]


# ---------------------------------------------------------------------------
# API request/response schemas (all responses are JSON, dates ISO-8601)
# ---------------------------------------------------------------------------


class GoogleAuthRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str


class LLMProvider(str, Enum):
    GEMINI = "gemini"
    GROQ = "groq"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    DEEPSEEK = "deepseek"
    MISTRAL = "mistral"
    OPENROUTER = "openrouter"


class ProviderCredentialInput(BaseModel):
    api_key: str = PydanticField(min_length=1, max_length=4096)

    @field_validator("api_key")
    @classmethod
    def api_key_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("API key must not be blank.")
        return value


class ProviderOrderUpdate(BaseModel):
    providers: List[LLMProvider]


class ProviderCredentialStatus(BaseModel):
    provider: LLMProvider
    configured: bool
    order: int


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class GoogleConfigResponse(BaseModel):
    google_client_id: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str


class BiomarkerResponse(BaseModel):
    id: int
    biomarker_name: str
    value: float
    unit: str
    reference_range: Optional[str] = None
    is_abnormal: bool


class ExamResponse(BaseModel):
    id: int
    title: str
    date_performed: date
    pdf_path: str
    markdown_path: str
    biomarkers: List[BiomarkerResponse] = []
    extraction_error: Optional[str] = None
    processing: Optional["ExamProcessingResponse"] = None


class ExamProcessingResponse(BaseModel):
    status: Literal["queued", "processing", "completed", "failed"]
    stage: str
    completed_chunks: int
    total_chunks: int
    retry_allowed: bool
    updated_at: datetime


class MedicationCreate(BaseModel):
    medication_name: str = PydanticField(min_length=1, max_length=200)
    dosage: str = PydanticField(min_length=1, max_length=200)
    frequency_per_day: int = PydanticField(ge=1, le=32)
    start_date: date
    end_date: Optional[date] = None


class MedicationResponse(BaseModel):
    id: int
    name: str
    dosage: str
    frequency_per_day: int
    start_date: date
    end_date: Optional[date] = None


class MedicationUpdate(BaseModel):
    """Partial medication update: omitted fields keep their current value.

    An explicit ``end_date: null`` clears the end date (ongoing regimen).
    """

    medication_name: Optional[str] = PydanticField(default=None, min_length=1, max_length=200)
    dosage: Optional[str] = PydanticField(default=None, min_length=1, max_length=200)
    frequency_per_day: Optional[int] = PydanticField(default=None, ge=1, le=32)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ExamRename(BaseModel):
    title: str = PydanticField(min_length=1, max_length=200)


class ManualBiomarkerInput(BaseModel):
    biomarker_name: str = PydanticField(min_length=1, max_length=200)
    value: float = PydanticField(allow_inf_nan=False)
    unit: str = PydanticField(default="", max_length=100)
    reference_range: Optional[str] = PydanticField(default=None, max_length=200)
    is_abnormal: bool = False

    @field_validator("biomarker_name", "unit", "reference_range")
    @classmethod
    def trim_text(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else None

    @field_validator("biomarker_name")
    @classmethod
    def biomarker_name_must_not_be_blank(cls, value: str) -> str:
        if not value:
            raise ValueError("Biomarker name must not be blank.")
        return value


class ManualExamInput(BaseModel):
    title: str = PydanticField(min_length=1, max_length=200)
    date_performed: date
    biomarkers: List[ManualBiomarkerInput] = PydanticField(max_length=500)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Exam title must not be blank.")
        return value


class CalendarExam(BaseModel):
    id: int
    title: str
    date: date


class CalendarMedication(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: Optional[date] = None


class CalendarResponse(BaseModel):
    exams: List[CalendarExam] = []
    medications: List[CalendarMedication] = []


class TimeSeriesPoint(BaseModel):
    date: date
    value: float
    is_abnormal: bool
    exam_title: str


class TimeSeries(BaseModel):
    spec: str
    unit: str
    points: List[TimeSeriesPoint] = []


class TimeSeriesResponse(BaseModel):
    series: List[TimeSeries] = []
