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
import os
import re
import tempfile
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Tuple

from groq import Groq
from markitdown import MarkItDown
from openai import OpenAI
from sqlmodel import Session, select

import object_storage
from database import MARKDOWN_DIR, PDF_DIR, engine
from models import (
    BiomarkerResponse,
    Exam,
    ExamBiomarker,
    ExamResponse,
    LLMExamsExtractionSchema,
)

logger = logging.getLogger("parser")

# Extraction providers. Gemini is tried first when GEMINI_API_KEY is set: its
# free tier accepts a whole report in one request, while Groq's free plan caps a
# model at 8000 tokens per minute (which is why the Groq path truncates).
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

JSON_FENCE_RE = re.compile(r"^```(?:json)?|```$", re.IGNORECASE | re.MULTILINE)

ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")

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
    return datetime.utcnow().date()


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


def _extract_structured(
    markdown: str,
) -> Tuple[Optional[LLMExamsExtractionSchema], Optional[str]]:
    """Step 3: Gemini first when configured, then the Groq fallback chain.

    Returns (extraction, error_message). Exactly one of them is None.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not gemini_key and not groq_key:
        return None, (
            "No extraction provider is configured: set GEMINI_API_KEY "
            "(or GROQ_API_KEY) on this server."
        )

    problems: List[str] = []

    if gemini_key:
        model = os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL
        client = OpenAI(api_key=gemini_key, base_url=GEMINI_BASE_URL)
        try:
            extraction = _call_model(
                client,
                model,
                markdown,
                GEMINI_MAX_CHARS,
                retry_without_json_mode=True,
            )
            return extraction, None
        except Exception as exc:  # noqa: BLE001 - report and fall back
            problems.append(f"{model}: {exc}")
            logger.warning("Gemini extraction failed via %s: %s", model, exc)

    if groq_key:
        client = Groq(api_key=groq_key)
        for model in (PRIMARY_MODEL, *FALLBACK_MODELS):
            try:
                extraction = _call_model(client, model, markdown, GROQ_MAX_CHARS)
                return extraction, None
            except Exception as exc:  # noqa: BLE001 - report and fall back
                problems.append(f"{model}: {exc}")
                logger.warning("Groq extraction failed via %s: %s", model, exc)

    return None, f"Structured extraction failed ({'; '.join(problems)})"


def _to_response(exam: Exam, biomarkers: List[ExamBiomarker]) -> ExamResponse:
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

    # Step 3: structured extraction via Groq.
    extraction, extraction_error = _extract_structured(markdown)

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
                results.append(_to_response(exam, all_biomarkers))
            elif matching:
                results.append(_to_response(exam, matching))
        return results
