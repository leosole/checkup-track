"""Database models (SQLModel tables) and API/LLM schemas (Pydantic)."""

from datetime import date
from enum import Enum
from typing import List, Optional

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
