"""PDF ingestion pipeline: MarkItDown conversion + Groq structured extraction.

Flow:
1. Save the raw PDF into ``storage/pdfs/``.
2. Run MarkItDown on the saved file and write the markdown to ``storage/markdowns/``.
3. Feed the markdown to Groq (JSON mode) with a strict Pydantic schema and
   validate the response into ``LLMExamsExtractionSchema``.
4. Insert the structured rows (Exam + ExamBiomarker) into SQLite.
"""

import json
import logging
import os
import re
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Tuple

from groq import Groq
from markitdown import MarkItDown
from sqlmodel import Session, select

from database import MARKDOWN_DIR, PDF_DIR, engine
from models import (
    BiomarkerResponse,
    Exam,
    ExamBiomarker,
    ExamResponse,
    LLMExamsExtractionSchema,
)

logger = logging.getLogger("parser")

# Model chain for structured extraction. These are the JSON-capable chat
# models available on this Groq API key; first success wins.
PRIMARY_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODELS = (
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
)

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


def _save_raw_pdf(pdf_bytes: bytes, original_name: str) -> Path:
    """Step 1: save the incoming PDF into storage/pdfs/ with a safe unique name."""
    stem = Path(original_name or "exam").stem
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._") or "exam"
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    pdf_path = PDF_DIR / f"{stem}_{stamp}_{uuid.uuid4().hex[:8]}.pdf"
    pdf_path.write_bytes(pdf_bytes)
    return pdf_path


def _convert_to_markdown(pdf_path: Path) -> Path:
    """Step 2: run MarkItDown on the saved PDF and write the .md counterpart."""
    md = MarkItDown(enable_plugins=False)
    result = md.convert(str(pdf_path))
    text = result.text_content if result is not None else ""
    if not text or not text.strip():
        raise ValueError(
            "MarkItDown produced no text from the PDF. "
            "Only text-selectable (non-scanned) PDFs are supported."
        )
    md_path = MARKDOWN_DIR / (pdf_path.stem + ".md")
    md_path.write_text(text, encoding="utf-8")
    return md_path


def _fallback_date(markdown: str, pdf_path: Path) -> date:
    """Best-effort exam date: first ISO date in the markdown, else file mtime."""
    match = ISO_DATE_RE.search(markdown[:4000])
    if match:
        try:
            return date.fromisoformat(match.group(1))
        except ValueError:
            pass
    return datetime.fromtimestamp(pdf_path.stat().st_mtime).date()


def _call_groq(client: Groq, model: str, markdown: str) -> LLMExamsExtractionSchema:
    """One JSON-mode extraction attempt; raises on API or validation failure."""
    truncated = markdown if len(markdown) <= 60_000 else markdown[:60_000]
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": truncated},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=8192,
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("Groq returned an empty completion.")
    return LLMExamsExtractionSchema.model_validate_json(content)


def _extract_structured(
    markdown: str,
) -> Tuple[Optional[LLMExamsExtractionSchema], Optional[str]]:
    """Step 3: Groq extraction with JSON mode; falls back to a faster model once.

    Returns (extraction, error_message). Exactly one of them is None.
    """
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None, "GROQ_API_KEY is not configured on this server."
    client = Groq(api_key=api_key)
    last_error: Optional[str] = None
    for model in (PRIMARY_MODEL, *FALLBACK_MODELS):
        try:
            extraction = _call_groq(client, model, markdown)
            return extraction, None
        except Exception as exc:  # noqa: BLE001 - report and fall back
            last_error = f"{model}: {exc}"
            logger.warning("Groq extraction failed via %s: %s", model, exc)
    return None, f"Structured extraction failed ({last_error})"


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
) -> ExamResponse:
    """Full ingestion pipeline; returns the created exam with its biomarkers."""
    if not pdf_bytes:
        raise ValueError("The uploaded file is empty.")
    if not pdf_bytes.lstrip()[:5].startswith(b"%PDF"):
        raise ValueError("The uploaded file is not a valid PDF.")

    # Step 1: persist the raw PDF.
    pdf_path = _save_raw_pdf(pdf_bytes, filename)
    pdf_rel = f"storage/pdfs/{pdf_path.name}"

    # Step 2: convert to markdown and persist it.
    try:
        md_path = _convert_to_markdown(pdf_path)
    except Exception:
        pdf_path.unlink(missing_ok=True)
        raise
    md_rel = f"storage/markdowns/{md_path.name}"
    markdown = md_path.read_text(encoding="utf-8")

    # Step 3: structured extraction via Groq.
    extraction, extraction_error = _extract_structured(markdown)

    if extraction is None:
        title = Path(filename).stem or "Untitled exam"
        performed = _fallback_date(markdown, pdf_path)
    else:
        title = (extraction.title or "").strip() or (Path(filename).stem or "Untitled exam")
        performed = extraction.date_performed or _fallback_date(markdown, pdf_path)

    # Step 4: insert rows scoped to the user.
    with Session(engine) as session:
        exam = Exam(
            user_id=user_id,
            title=title,
            date_performed=performed,
            pdf_path=pdf_rel,
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
