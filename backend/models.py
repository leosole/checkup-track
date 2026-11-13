"""Database models (SQLModel tables) and API/LLM schemas (Pydantic)."""

import re
from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field as PydanticField, field_validator
from sqlmodel import Field, SQLModel

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _normalize_color(value: Optional[str]) -> Optional[str]:
    """Keep colors as ``#rrggbb`` (or None for "use the default")."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if not HEX_COLOR_RE.match(value):
        raise ValueError("Color must be a hex value like #7c3aed.")
    return value.lower()


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
    # Laboratory that produced the report; usually extracted, user-settable.
    laboratory: Optional[str] = None
    # Calendar color; None means the default exam color.
    color: Optional[str] = None


class ExamProcessingJob(SQLModel, table=True):
    exam_id: int = Field(foreign_key="exam.id", primary_key=True)
    status: str = Field(default="queued", index=True)
    stage: str = Field(default="queued")
    completed_chunks: int = Field(default=0)
    total_chunks: int = Field(default=0)
    partial_results_json: str = Field(default="[]")
    error: Optional[str] = None
    requested_title: Optional[str] = None
    requested_date: Optional[date] = None
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
    # Calendar color; None means the rotating default palette color.
    color: Optional[str] = None


class Symptom(SQLModel, table=True):
    """A reusable symptom name; its dated episodes hang off it."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    title: str


class SymptomOccurrence(SQLModel, table=True):
    """One dated episode of a symptom, with its own observation.

    ``end_date is None`` means the symptom is ongoing; an end date equal to
    the start date is a single day.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    symptom_id: int = Field(foreign_key="symptom.id", index=True)
    observation: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None


class ShareGrant(SQLModel, table=True):
    """A single-use code that grants read-only access to selected records.

    Only a hash of the code is stored, so the plaintext exists just once — in
    the creation response. ``used_at`` marks the code as redeemed, and
    ``revoked_at`` lets the owner end the guest's access early.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: str = Field(foreign_key="user.id", index=True)
    code_hash: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


class ShareExam(SQLModel, table=True):
    share_id: int = Field(foreign_key="sharegrant.id", primary_key=True)
    exam_id: int = Field(foreign_key="exam.id", primary_key=True)


class ShareMedication(SQLModel, table=True):
    share_id: int = Field(foreign_key="sharegrant.id", primary_key=True)
    medication_id: int = Field(foreign_key="medication.id", primary_key=True)


class ShareSymptom(SQLModel, table=True):
    """One shared symptom occurrence (individual occurrences are selectable)."""

    share_id: int = Field(foreign_key="sharegrant.id", primary_key=True)
    occurrence_id: int = Field(foreign_key="symptomoccurrence.id", primary_key=True)


class ShareGroupTitle(SQLModel, table=True):
    """A user-chosen name for one share group (an exact selection of records).

    Groups are derived from the selected record ids rather than stored, so the
    name lives in its own table keyed by that derived group key.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: str = Field(foreign_key="user.id", index=True)
    group_key: str = Field(index=True)
    title: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# The strict LLM structured format
# ---------------------------------------------------------------------------


class LLMExamsExtractionSchema(BaseModel):
    title: str
    date_performed: Optional[date]
    laboratory: Optional[str] = None
    biomarkers: List[ExamBiomarker]


# ---------------------------------------------------------------------------
# API request/response schemas (all responses are JSON, dates ISO-8601)
# ---------------------------------------------------------------------------


class GoogleAuthRequest(BaseModel):
    token: str


class AccountCapabilities(BaseModel):
    create_records: bool = True
    delete_records: bool = True
    edit_exam_metadata: bool = True
    edit_medications: bool = True
    edit_symptoms: bool = True
    edit_results: bool = True
    manage_providers: bool = True
    create_shares: bool = True
    revoke_shares: bool = True
    retry_extraction: bool = True


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    capabilities: AccountCapabilities = PydanticField(default_factory=AccountCapabilities)


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
    test_user_enabled: bool = False


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
    laboratory: Optional[str] = None
    color: Optional[str] = None
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
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def color_must_be_hex(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_color(value)


class MedicationResponse(BaseModel):
    id: int
    name: str
    dosage: str
    frequency_per_day: int
    start_date: date
    end_date: Optional[date] = None
    color: Optional[str] = None


class MedicationUpdate(BaseModel):
    """Partial medication update: omitted fields keep their current value.

    An explicit ``end_date: null`` clears the end date (ongoing regimen).
    """

    medication_name: Optional[str] = PydanticField(default=None, min_length=1, max_length=200)
    dosage: Optional[str] = PydanticField(default=None, min_length=1, max_length=200)
    frequency_per_day: Optional[int] = PydanticField(default=None, ge=1, le=32)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def color_must_be_hex(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_color(value)


class SymptomDateInput(BaseModel):
    """One dated occurrence inside a symptom's date list."""

    start_date: date
    end_date: Optional[date] = None
    observation: Optional[str] = PydanticField(default=None, max_length=2000)

    @field_validator("observation")
    @classmethod
    def trim_observation(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None


class SymptomCreate(BaseModel):
    title: str = PydanticField(min_length=1, max_length=200)
    dates: List[SymptomDateInput] = PydanticField(min_length=1, max_length=50)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Symptom title must not be blank.")
        return value


class SymptomOccurrenceUpdate(BaseModel):
    """Partial update of one occurrence.

    A ``title`` renames the parent symptom (merging into an existing symptom of
    that name). An explicit ``observation: null`` clears the note and an
    explicit ``end_date: null`` makes the occurrence ongoing.
    """

    title: Optional[str] = PydanticField(default=None, min_length=1, max_length=200)
    observation: Optional[str] = PydanticField(default=None, max_length=2000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Symptom title must not be blank.")
        return value

    @field_validator("observation")
    @classmethod
    def trim_observation(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None


class SymptomOccurrenceResponse(BaseModel):
    id: int
    symptom_id: int
    title: str
    observation: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None


class ExamUpdate(BaseModel):
    """Partial exam update: omitted fields keep their current value."""

    title: Optional[str] = PydanticField(default=None, min_length=1, max_length=200)
    date_performed: Optional[date] = None
    laboratory: Optional[str] = PydanticField(default=None, max_length=200)
    color: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Exam title must not be blank.")
        return value

    @field_validator("laboratory")
    @classmethod
    def trim_laboratory(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("color")
    @classmethod
    def color_must_be_hex(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_color(value)


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
    color: Optional[str] = None


class CalendarMedication(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: Optional[date] = None
    color: Optional[str] = None


class CalendarSymptom(BaseModel):
    id: int
    symptom_id: int
    title: str
    observation: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None


class CalendarResponse(BaseModel):
    exams: List[CalendarExam] = []
    medications: List[CalendarMedication] = []
    symptoms: List[CalendarSymptom] = []


class TimeSeriesPoint(BaseModel):
    date: date
    value: float
    is_abnormal: bool
    exam_title: str
    reference_range: Optional[str] = None


class TimeSeries(BaseModel):
    spec: str
    unit: str
    points: List[TimeSeriesPoint] = []


class TimeSeriesResponse(BaseModel):
    series: List[TimeSeries] = []


# ---------------------------------------------------------------------------
# Sharing schemas
# ---------------------------------------------------------------------------


class ShareCreate(BaseModel):
    """Records a user chose to share, plus how long the code stays usable."""

    exam_ids: List[int] = PydanticField(default_factory=list, max_length=500)
    medication_ids: List[int] = PydanticField(default_factory=list, max_length=500)
    symptom_occurrence_ids: List[int] = PydanticField(
        default_factory=list, max_length=500
    )
    expires_in_days: int = PydanticField(default=7, ge=1, le=30)

    @field_validator("exam_ids", "medication_ids", "symptom_occurrence_ids")
    @classmethod
    def ids_must_be_positive(cls, value: List[int]) -> List[int]:
        if any(item < 1 for item in value):
            raise ValueError("Record ids must be positive integers.")
        return value


class ShareCodeResponse(BaseModel):
    id: int
    # Only present in the creation response; the code is stored hashed.
    code: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    status: Literal["active", "used", "expired", "revoked"]


class SharedExamSummary(BaseModel):
    id: int
    title: str
    date_performed: date


class SharedMedicationSummary(BaseModel):
    id: int
    name: str
    dosage: str


class SharedSymptomOccurrenceSummary(BaseModel):
    id: int
    start_date: date
    end_date: Optional[date] = None


class SharedSymptomSummary(BaseModel):
    """A shared symptom name with only the occurrences that were selected."""

    id: int
    title: str
    occurrences: List[SharedSymptomOccurrenceSummary] = []


class ShareGroupTitleUpdate(BaseModel):
    """Rename one share group; ``title=None`` clears the name."""

    group_key: str = PydanticField(min_length=1, max_length=2000)
    title: Optional[str] = PydanticField(default=None, max_length=120)

    @field_validator("title")
    @classmethod
    def blank_title_clears(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class ShareGroupResponse(BaseModel):
    """Every code ever issued for one exact selection of records."""

    group_key: str
    title: Optional[str] = None
    exam_ids: List[int] = []
    medication_ids: List[int] = []
    symptom_occurrence_ids: List[int] = []
    exams: List[SharedExamSummary] = []
    medications: List[SharedMedicationSummary] = []
    symptoms: List[SharedSymptomSummary] = []
    times_shared: int
    last_shared_at: datetime
    active_codes: int
    codes: List[ShareCodeResponse] = []


class ShareCreatedResponse(BaseModel):
    group_key: str
    share: ShareCodeResponse


class GuestShareInfo(BaseModel):
    owner_name: str
    expires_at: datetime
    exam_count: int
    medication_count: int
    symptom_count: int = 0


class GuestExamResponse(BaseModel):
    """Guest-facing exam view; deliberately omits stored file paths."""

    id: int
    title: str
    date_performed: date
    biomarkers: List[BiomarkerResponse] = []


class GuestSymptomOccurrenceResponse(BaseModel):
    id: int
    observation: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None


class GuestSymptomResponse(BaseModel):
    """Guest-facing symptom: the title with its shared occurrences nested."""

    id: int
    title: str
    occurrences: List[GuestSymptomOccurrenceResponse] = []


class GuestShareData(BaseModel):
    share: GuestShareInfo
    exams: List[GuestExamResponse] = []
    medications: List[MedicationResponse] = []
    symptoms: List[GuestSymptomResponse] = []


class GuestCodeRequest(BaseModel):
    code: str = PydanticField(min_length=1, max_length=64)

    @field_validator("code")
    @classmethod
    def code_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter the share code you received.")
        return value


class GuestAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    share: GuestShareInfo
