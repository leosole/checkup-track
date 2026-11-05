"""PDF ingestion pipeline: MarkItDown conversion + LLM structured extraction.

Flow:
1. Save the raw PDF (Backblaze B2 when configured, else ``storage/pdfs/``).
2. Run MarkItDown on the PDF bytes and write the markdown to ``storage/markdowns/``.
3. Feed the markdown to Gemini (OpenAI-compatible endpoint) or Groq (JSON mode)
   with a strict Pydantic schema and validate the response into
   ``LLMExamsExtractionSchema``.
4. Insert the structured rows (Exam + ExamBiomarker) into SQLite.
"""

import json
import logging
import re
import tempfile
import uuid
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import List, Optional, Tuple

from anthropic import Anthropic
from cryptography.fernet import InvalidToken
from groq import Groq
from markitdown import MarkItDown
from openai import OpenAI
from sqlmodel import Session, select

import object_storage
from credentials import decrypt_api_key
from database import MARKDOWN_DIR, PDF_DIR, engine
from models import (
    BiomarkerResponse,
    Exam,
    ExamBiomarker,
    ExamProcessingJob,
    ExamProcessingResponse,
    ExamResponse,
    LLMExamsExtractionSchema,
    LLMProvider,
    UserProviderCredential,
)

logger = logging.getLogger("parser")

# Provider defaults. Users control the provider order and supply their own keys.
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
# Gemini's context window swallows a full report; keep a ceiling anyway so a
# runaway conversion cannot blow up the request.
GEMINI_MAX_CHARS = 400_000

# Groq fallback chain: these are the JSON-capable chat models available on this
# Groq API key; first success wins.
PRIMARY_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODELS = (
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
)
# Groq's free tier rejects prompts above its per-minute token budget.
GROQ_MAX_CHARS = 60_000
DEFAULT_PROVIDER_MAX_CHARS = 200_000

OPENAI_COMPATIBLE_PROVIDERS = {
    LLMProvider.GEMINI: (
        GEMINI_BASE_URL,
        DEFAULT_GEMINI_MODEL,
        GEMINI_MAX_CHARS,
    ),
    LLMProvider.OPENAI: (None, "gpt-4o-mini", DEFAULT_PROVIDER_MAX_CHARS),
    LLMProvider.DEEPSEEK: (
        "https://api.deepseek.com",
        "deepseek-flash",
        DEFAULT_PROVIDER_MAX_CHARS,
    ),
    LLMProvider.MISTRAL: (
        "https://api.mistral.ai/v1",
        "mistral-small-latest",
        DEFAULT_PROVIDER_MAX_CHARS,
    ),
    LLMProvider.OPENROUTER: (
        "https://openrouter.ai/api/v1",
        "openai/gpt-4o-mini",
        DEFAULT_PROVIDER_MAX_CHARS,
    ),
}
ANTHROPIC_MODEL = "claude-haiku-5-5"

JSON_FENCE_RE = re.compile(r"^```(?:json)?|```$", re.IGNORECASE | re.MULTILINE)

ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
DEFAULT_CHUNK_CHARS = 20_000

SYSTEM_PROMPT = """You are a clinical laboratory report data-extraction engine.
You will receive the full markdown text of a lab report PDF.

Return ONLY a valid JSON object (no prose, no markdown fences) that validates
against this JSON schema:

{schema}

Rules:
- "title": the human-readable name of the exam panel or report (e.g. "Complete Blood Count").
- "date_performed": the date the exam/sample was performed as YYYY-MM-DD, or null when truly absent.
- "biomarkers": every measurable result found in the document, as objects with:
    - "biomarker_name": canonical analyte name (e.g. "Glucose", "Hemoglobin", "LDL Cholesterol")
    - "value": numeric result value only (no units, no comparison signs)
    - "unit": measurement unit (e.g. "mg/dL", "g/L"); use "" when none is given
    - "reference_range": the reference interval verbatim as a string (e.g. "70-99"); null when absent
    - "is_abnormal": true when the value is outside the reference range or flagged high/low/critical
    - "exam_id": always 0 (assigned server-side later)
- Never invent biomarkers that are not present in the document.
- Parse dates conservatively; if the document shows a collection or report date, prefer it.
"""


def _system_prompt() -> str:
    schema = json.dumps(LLMExamsExtractionSchema.model_json_schema(), indent=2)
    return SYSTEM_PROMPT.format(schema=schema)


def _split_markdown(markdown: str, max_chars: int = DEFAULT_CHUNK_CHARS) -> List[str]:
    if max_chars < 1:
        raise ValueError("Chunk size must be positive.")

    blocks = [block.strip() for block in re.split(r"\n\s*\n", markdown) if block.strip()]
    chunks: List[str] = []
    current = ""

    for block in blocks:
        pieces = _split_oversized_block(block, max_chars)

        for piece in pieces:
            candidate = f"{current}\n\n{piece}" if current else piece
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                current = piece

    if current:
        chunks.append(current)
    return chunks


def _split_oversized_block(block: str, max_chars: int) -> List[str]:
    lines = block.splitlines() or [block]
    pieces: List[str] = []
    current = ""

    for line in lines:
        fragments: List[str] = []
        remainder = line
        while len(remainder) > max_chars:
            split_at = remainder.rfind(" ", 0, max_chars + 1)
            if split_at <= 0:
                split_at = max_chars
            fragments.append(remainder[:split_at].strip())
            remainder = remainder[split_at:].strip()
        fragments.append(remainder)

        for fragment in fragments:
            candidate = f"{current}\n{fragment}" if current else fragment
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    pieces.append(current)
                current = fragment

    if current:
        pieces.append(current)
    return pieces


def _merge_extractions(
    extractions: List[LLMExamsExtractionSchema],
) -> LLMExamsExtractionSchema:
    title = next((item.title.strip() for item in extractions if item.title.strip()), "")
    performed = next(
        (item.date_performed for item in extractions if item.date_performed),
        None,
    )
    biomarkers: List[ExamBiomarker] = []
    seen = set()

    for extraction in extractions:
        for biomarker in extraction.biomarkers:
            key = (
                biomarker.biomarker_name.strip().casefold(),
                biomarker.value,
                (biomarker.unit or "").strip().casefold(),
                (biomarker.reference_range or "").strip().casefold(),
            )
            if key not in seen:
                seen.add(key)
                biomarkers.append(biomarker)

    return LLMExamsExtractionSchema(
        title=title,
        date_performed=performed,
        biomarkers=biomarkers,
    )


def _save_raw_pdf(pdf_bytes: bytes, original_name: str) -> str:
    """Step 1: persist the PDF (B2 when configured, else storage/pdfs/).

    Returns the storage reference: "exams/<name>.pdf" for remote objects or
    "storage/pdfs/<name>.pdf" for the local fallback.
    """
    stem = Path(original_name or "exam").stem
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._") or "exam"
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique = f"{stem}_{stamp}_{uuid.uuid4().hex[:8]}.pdf"
    if object_storage.is_remote_enabled():
        key = f"exams/{unique}"
        object_storage.upload_pdf(pdf_bytes, key)
        return key
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    (PDF_DIR / unique).write_bytes(pdf_bytes)
    return f"storage/pdfs/{unique}"


def _load_pdf_bytes(ref: str) -> bytes:
    """Read a stored PDF back (remote object or local fallback file)."""
    if ref.startswith("exams/"):
        return object_storage.download_pdf(ref)
    return object_storage.local_pdf_path(ref).read_bytes()


def _discard_pdf(ref: str) -> None:
    """Best-effort removal when a later pipeline step fails."""
    try:
        if ref.startswith("exams/"):
            object_storage.delete_pdf(ref)
        else:
            object_storage.local_pdf_path(ref).unlink(missing_ok=True)
    except Exception:  # noqa: BLE001 - cleanup must never mask the real error
        logger.warning("could not discard %s", ref)


def _convert_to_markdown(pdf_bytes: bytes, ref: str) -> Path:
    """Step 2: run MarkItDown on the PDF bytes and write the .md counterpart."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = Path(tmp.name)
    try:
        md = MarkItDown(enable_plugins=False)
        result = md.convert(str(tmp_path))
        text = result.text_content if result is not None else ""
    finally:
        tmp_path.unlink(missing_ok=True)
    if not text or not text.strip():
        raise ValueError(
            "MarkItDown produced no text from the PDF. "
            "Only text-selectable (non-scanned) PDFs are supported."
        )
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)
    md_path = MARKDOWN_DIR / (Path(ref).stem + ".md")
    md_path.write_text(text, encoding="utf-8")
    return md_path


def _fallback_date(markdown: str) -> date:
    """Best-effort exam date: first ISO date in the markdown, else today."""
    match = ISO_DATE_RE.search(markdown[:4000])
    if match:
        try:
            return date.fromisoformat(match.group(1))
        except ValueError:
            pass
    return datetime.now(timezone.utc).date()


def _strip_json_fences(content: str) -> str:
    """Gemini sometimes wraps JSON in a ```json fence even in JSON mode."""
    return JSON_FENCE_RE.sub("", content.strip()).strip()


def _invoke_model(
    client,
    model: str,
    markdown: str,
    max_chars: int,
    json_mode: bool,
) -> LLMExamsExtractionSchema:
    """One extraction request. ``client`` is a Groq or OpenAI SDK client."""
    kwargs = {
        "model": model,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": markdown[:max_chars]},
        ],
        "temperature": 0,
        "max_tokens": 8192,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise ValueError(f"{model} returned an empty completion.")
    return LLMExamsExtractionSchema.model_validate_json(_strip_json_fences(content))


def _call_model(
    client,
    model: str,
    markdown: str,
    max_chars: int,
    retry_without_json_mode: bool = False,
) -> LLMExamsExtractionSchema:
    """One attempt per model, retrying once without JSON mode when asked to.

    Gemini's OpenAI-compatibility layer does not accept every OpenAI field, so
    a rejected ``response_format`` must not lose the provider.
    """
    try:
        return _invoke_model(client, model, markdown, max_chars, True)
    except Exception as exc:  # noqa: BLE001 - the retry decision belongs here
        if not retry_without_json_mode:
            raise
        logger.warning("%s rejected JSON mode (%s); retrying without it", model, exc)
        return _invoke_model(client, model, markdown, max_chars, False)


def _extract_anthropic(
    api_key: str,
    markdown: str,
) -> LLMExamsExtractionSchema:
    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8192,
        system=_system_prompt(),
        messages=[{"role": "user", "content": markdown[:DEFAULT_PROVIDER_MAX_CHARS]}],
        temperature=0,
    )
    content = "\n".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )
    if not content.strip():
        raise ValueError("Anthropic returned an empty completion.")
    return LLMExamsExtractionSchema.model_validate_json(_strip_json_fences(content))


def _extract_provider(
    provider: LLMProvider,
    api_key: str,
    markdown: str,
) -> LLMExamsExtractionSchema:
    if provider == LLMProvider.ANTHROPIC:
        return _extract_anthropic(api_key, markdown)

    if provider == LLMProvider.GROQ:
        client = Groq(api_key=api_key)
        for model in (PRIMARY_MODEL, *FALLBACK_MODELS):
            try:
                return _call_model(client, model, markdown, GROQ_MAX_CHARS)
            except Exception:
                if model == FALLBACK_MODELS[-1]:
                    raise
        raise RuntimeError("No Groq model succeeded.")

    base_url, model, max_chars = OPENAI_COMPATIBLE_PROVIDERS[provider]
    client_options = {"base_url": base_url} if base_url else {}
    client = OpenAI(api_key=api_key, **client_options)
    return _call_model(
        client,
        model,
        markdown,
        max_chars,
        retry_without_json_mode=provider == LLMProvider.GEMINI,
    )


def _configured_provider_credentials(
    user_id: str,
) -> Tuple[List[Tuple[LLMProvider, str]], Optional[str]]:
    with Session(engine) as session:
        rows = session.exec(
            select(UserProviderCredential)
            .where(UserProviderCredential.user_id == user_id)
            .where(UserProviderCredential.encrypted_api_key.is_not(None))
            .order_by(UserProviderCredential.order_index)
        ).all()

    try:
        providers = [
            (LLMProvider(row.provider), decrypt_api_key(row.encrypted_api_key))
            for row in rows
            if row.encrypted_api_key
        ]
    except (InvalidToken, RuntimeError, UnicodeDecodeError, ValueError):
        logger.error("Could not decrypt saved provider credentials for user %s", user_id)
        return [], "Saved LLM credentials could not be loaded. Check server encryption configuration."
    return providers, None


class ProviderRateLimitError(Exception):
    def __init__(self, retry_after_seconds: Optional[int]) -> None:
        super().__init__("Configured providers are rate limited.")
        self.retry_after_seconds = retry_after_seconds


def _rate_limit_retry_after(exc: Exception) -> Optional[int]:
    if getattr(exc, "status_code", None) != 429:
        return None
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", {}) or getattr(exc, "headers", {})
    retry_ms = headers.get("retry-after-ms") or headers.get("Retry-After-Ms")
    try:
        if retry_ms is not None:
            return max(1, min(3600, int(float(retry_ms) / 1000)))
        value = headers.get("retry-after") or headers.get("Retry-After")
        if value is None:
            return None
        try:
            seconds = float(value)
        except (TypeError, ValueError):
            retry_at = parsedate_to_datetime(str(value))
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            seconds = (retry_at - datetime.now(timezone.utc)).total_seconds()
        return max(1, min(3600, int(seconds)))
    except (TypeError, ValueError, OverflowError):
        return None


def _extract_structured(
    markdown: str,
    providers: List[Tuple[LLMProvider, str]],
) -> Tuple[Optional[LLMExamsExtractionSchema], Optional[str]]:
    """Try the user's providers in order, preserving strict schema validation."""
    if not providers:
        return None, "No LLM provider is configured. Add an API key in Profile."

    failed_providers: List[str] = []
    retry_delays: List[int] = []
    for provider, api_key in providers:
        try:
            return _extract_provider(provider, api_key, markdown), None
        except Exception as exc:  # noqa: BLE001 - try the next configured provider
            retry_after = _rate_limit_retry_after(exc)
            if getattr(exc, "status_code", None) == 429:
                retry_delays.append(retry_after or 0)
            logger.warning(
                "%s extraction failed (%s)",
                provider.value,
                type(exc).__name__,
            )
            failed_providers.append(provider.value)

    if retry_delays:
        retry_after = min((delay for delay in retry_delays if delay > 0), default=None)
        raise ProviderRateLimitError(retry_after)

    return None, (
        "Structured extraction failed for configured providers: "
        + ", ".join(failed_providers)
    )


def _to_response(
    exam: Exam,
    biomarkers: List[ExamBiomarker],
    job: Optional[ExamProcessingJob] = None,
) -> ExamResponse:
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
            ExamProcessingResponse(
                status=job.status,
                stage=job.stage,
                completed_chunks=job.completed_chunks,
                total_chunks=job.total_chunks,
                retry_allowed=job.status == "failed",
                updated_at=job.updated_at,
            )
            if job
            else None
        ),
    )


def enqueue_exam(
    pdf_bytes: bytes,
    filename: str,
    user_id: str,
    title: Optional[str] = None,
) -> ExamResponse:
    """Store a valid PDF and create its durable extraction job without parsing it."""
    if not pdf_bytes:
        raise ValueError("The uploaded file is empty.")
    if not pdf_bytes.lstrip()[:5].startswith(b"%PDF"):
        raise ValueError("The uploaded file is not a valid PDF.")

    pdf_ref = _save_raw_pdf(pdf_bytes, filename)
    requested_title = (title or "").strip() or None
    fallback_title = Path(filename).stem or "Untitled exam"
    exam = Exam(
        user_id=user_id,
        title=requested_title or fallback_title,
        date_performed=datetime.now(timezone.utc).date(),
        pdf_path=pdf_ref,
        markdown_path="",
    )
    job = ExamProcessingJob(requested_title=requested_title)

    try:
        with Session(engine) as session:
            session.add(exam)
            session.flush()
            job.exam_id = exam.id
            session.add(job)
            session.commit()
            session.refresh(exam)
            session.refresh(job)
            return _to_response(exam, [], job)
    except Exception:
        _discard_pdf(pdf_ref)
        raise


def _update_processing_job(exam_id: int, **values) -> None:
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        job = session.get(ExamProcessingJob, exam_id)
        if job is None:
            return
        for field, value in values.items():
            setattr(job, field, value)
        job.updated_at = now
        job.lease_expires_at = (
            now + timedelta(minutes=15) if job.status == "processing" else None
        )
        session.add(job)
        session.commit()


def process_exam_job(exam_id: int) -> None:
    """Convert, extract, and persist one claimed exam job, checkpointing each chunk."""
    stage = "converting"
    try:
        with Session(engine) as session:
            exam = session.get(Exam, exam_id)
            job = session.get(ExamProcessingJob, exam_id)
            if exam is None or job is None:
                return
            pdf_ref = exam.pdf_path
            user_id = exam.user_id

        _update_processing_job(exam_id, status="processing", stage=stage, error=None)
        pdf_bytes = _load_pdf_bytes(pdf_ref)
        markdown_path = _convert_to_markdown(pdf_bytes, pdf_ref)
        markdown = markdown_path.read_text(encoding="utf-8")
        chunks = _split_markdown(markdown)
        if not chunks:
            raise ExamProcessingError("No readable text was found in the PDF. Please retry.")

        markdown_ref = f"storage/markdowns/{markdown_path.name}"
        with Session(engine) as session:
            exam = session.get(Exam, exam_id)
            job = session.get(ExamProcessingJob, exam_id)
            if exam is None or job is None:
                return
            exam.markdown_path = markdown_ref
            job.stage = "extracting"
            job.total_chunks = len(chunks)
            job.updated_at = datetime.now(timezone.utc)
            job.lease_expires_at = job.updated_at + timedelta(minutes=15)
            session.add_all([exam, job])
            session.commit()
            partial_json = job.partial_results_json
            requested_title = job.requested_title

        partial = json.loads(partial_json or "[]")
        if not isinstance(partial, list):
            partial = []
        if len(partial) > len(chunks):
            partial = []
            _update_processing_job(
                exam_id,
                completed_chunks=0,
                partial_results_json="[]",
            )

        providers, credential_error = _configured_provider_credentials(user_id)
        if credential_error:
            raise ExamProcessingError(credential_error)

        for index in range(len(partial), len(chunks)):
            stage = "extracting"
            extraction, extraction_error = _extract_structured(chunks[index], providers)
            if extraction is None:
                raise ExamProcessingError(
                    extraction_error or "Extraction failed. Check provider keys or token limits, then retry."
                )
            partial.append(extraction.model_dump(mode="json"))
            _update_processing_job(
                exam_id,
                stage=stage,
                completed_chunks=len(partial),
                total_chunks=len(chunks),
                partial_results_json=json.dumps(partial),
            )

        merged = _merge_extractions(
            [LLMExamsExtractionSchema.model_validate(item) for item in partial]
        )
        with Session(engine) as session:
            exam = session.get(Exam, exam_id)
            job = session.get(ExamProcessingJob, exam_id)
            if exam is None or job is None:
                return
            if not requested_title and merged.title:
                exam.title = merged.title
            exam.date_performed = merged.date_performed or _fallback_date(markdown)
            existing = session.exec(
                select(ExamBiomarker).where(ExamBiomarker.exam_id == exam_id)
            ).all()
            for biomarker in existing:
                session.delete(biomarker)
            for biomarker in merged.biomarkers:
                if not (biomarker.biomarker_name or "").strip():
                    continue
                session.add(
                    ExamBiomarker(
                        exam_id=exam_id,
                        biomarker_name=biomarker.biomarker_name.strip(),
                        value=biomarker.value,
                        unit=(biomarker.unit or "").strip(),
                        reference_range=(biomarker.reference_range or "").strip() or None,
                        is_abnormal=bool(biomarker.is_abnormal),
                    )
                )
            job.status = "completed"
            job.stage = "completed"
            job.error = None
            job.completed_chunks = len(chunks)
            job.total_chunks = len(chunks)
            job.lease_expires_at = None
            job.updated_at = datetime.now(timezone.utc)
            session.add_all([exam, job])
            session.commit()
    except ProviderRateLimitError as exc:
        with Session(engine) as session:
            job = session.get(ExamProcessingJob, exam_id)
            attempts = job.attempts if job is not None else 1
        delay = exc.retry_after_seconds or min(60 * (2 ** max(attempts - 1, 0)), 3600)
        _update_processing_job(
            exam_id,
            status="queued",
            stage="waiting_for_provider",
            error=None,
            next_attempt_at=datetime.now(timezone.utc) + timedelta(seconds=delay),
        )
    except ExamProcessingError as exc:
        _update_processing_job(
            exam_id,
            status="failed",
            stage="failed",
            error=str(exc),
        )
    except Exception as exc:  # noqa: BLE001 - never expose provider internals or report data
        logger.warning("Exam %s %s stage failed (%s)", exam_id, stage, type(exc).__name__)
        message = (
            "Could not read the PDF. Check that it contains selectable text, then retry."
            if stage == "converting"
            else "Extraction failed unexpectedly. Check provider settings or token limits, then retry."
        )
        _update_processing_job(
            exam_id,
            status="failed",
            stage="failed",
            error=message,
        )


class ExamProcessingError(Exception):
    pass


def process_exam(
    pdf_bytes: bytes,
    filename: str,
    user_id: str,
    title: Optional[str] = None,
) -> ExamResponse:
    """Full ingestion pipeline; returns the created exam with its biomarkers.

    ``title`` is the name the user typed; when blank the extracted report
    title is used, falling back to the PDF's file name.
    """
    if not pdf_bytes:
        raise ValueError("The uploaded file is empty.")
    if not pdf_bytes.lstrip()[:5].startswith(b"%PDF"):
        raise ValueError("The uploaded file is not a valid PDF.")

    # Step 1: persist the raw PDF.
    pdf_ref = _save_raw_pdf(pdf_bytes, filename)

    # Step 2: convert to markdown and persist it.
    try:
        md_path = _convert_to_markdown(pdf_bytes, pdf_ref)
    except Exception:
        _discard_pdf(pdf_ref)
        raise
    md_rel = f"storage/markdowns/{md_path.name}"
    markdown = md_path.read_text(encoding="utf-8")

    # Step 3: structured extraction with this user's configured providers.
    providers, credential_error = _configured_provider_credentials(user_id)
    if credential_error:
        extraction, extraction_error = None, credential_error
    else:
        extraction, extraction_error = _extract_structured(markdown, providers)

    requested_title = (title or "").strip()
    extracted_title = (extraction.title or "").strip() if extraction is not None else ""
    if requested_title:
        exam_title = requested_title
    elif extracted_title:
        exam_title = extracted_title
    else:
        exam_title = Path(filename).stem or "Untitled exam"
    performed = (
        extraction.date_performed
        if extraction is not None and extraction.date_performed
        else _fallback_date(markdown)
    )

    # Step 4: insert rows scoped to the user.
    with Session(engine) as session:
        exam = Exam(
            user_id=user_id,
            title=exam_title,
            date_performed=performed,
            pdf_path=pdf_ref,
            markdown_path=md_rel,
        )
        session.add(exam)
        session.commit()
        session.refresh(exam)

        biomarkers: List[ExamBiomarker] = []
        if extraction is not None:
            for bm in extraction.biomarkers:
                if not (bm.biomarker_name or "").strip():
                    continue
                row = ExamBiomarker(
                    exam_id=exam.id,
                    biomarker_name=bm.biomarker_name.strip(),
                    value=bm.value,
                    unit=(bm.unit or "").strip(),
                    reference_range=(
                        bm.reference_range.strip()
                        if isinstance(bm.reference_range, str) and bm.reference_range.strip()
                        else None
                    ),
                    is_abnormal=bool(bm.is_abnormal),
                )
                session.add(row)
                biomarkers.append(row)
            session.commit()
            for row in biomarkers:
                session.refresh(row)

        response = _to_response(exam, biomarkers)
        response.extraction_error = extraction_error
        return response


def search_exams(user_id: str, query: str) -> List[ExamResponse]:
    """Case-insensitive lookup across exam fields, biomarker names, and ranges."""
    q = (query or "").strip().lower()
    if not q:
        return []
    with Session(engine) as session:
        exams = session.exec(
            select(Exam).where(Exam.user_id == user_id).order_by(Exam.date_performed.desc())
        ).all()
        results: List[ExamResponse] = []
        for exam in exams:
            all_biomarkers = session.exec(
                select(ExamBiomarker).where(ExamBiomarker.exam_id == exam.id)
            ).all()
            job = session.get(ExamProcessingJob, exam.id)
            title_hit = q in exam.title.lower() or q in exam.date_performed.isoformat().lower()
            matching = [
                b
                for b in all_biomarkers
                if q in b.biomarker_name.lower()
                or q in b.unit.lower()
                or (b.reference_range and q in b.reference_range.lower())
                or q in str(b.value).lower()
            ]
            if title_hit:
                results.append(_to_response(exam, all_biomarkers, job))
            elif matching:
                results.append(_to_response(exam, matching, job))
        return results
