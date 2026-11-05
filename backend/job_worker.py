"""Database-backed extraction queue consumed by the API process."""

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, or_, update
from sqlmodel import Session, select

from database import engine
from models import ExamProcessingJob

logger = logging.getLogger("job_worker")
LEASE_DURATION = timedelta(minutes=15)
POLL_INTERVAL_SECONDS = 5


def claim_next_job(now: Optional[datetime] = None) -> Optional[int]:
    now = now or datetime.now(timezone.utc)
    lease_expires_at = now + LEASE_DURATION
    eligible = or_(
        and_(
            ExamProcessingJob.status == "queued",
            ExamProcessingJob.next_attempt_at <= now,
        ),
        and_(
            ExamProcessingJob.status == "processing",
            or_(
                ExamProcessingJob.lease_expires_at.is_(None),
                ExamProcessingJob.lease_expires_at <= now,
            ),
        ),
    )

    with Session(engine) as session:
        candidate = session.exec(
            select(ExamProcessingJob.exam_id)
            .where(eligible)
            .order_by(ExamProcessingJob.updated_at)
            .limit(1)
        ).first()
        if candidate is None:
            return None

        result = session.exec(
            update(ExamProcessingJob)
            .where(ExamProcessingJob.exam_id == candidate, eligible)
            .values(
                status="processing",
                stage="converting",
                attempts=ExamProcessingJob.attempts + 1,
                lease_expires_at=lease_expires_at,
                updated_at=now,
            )
        )
        session.commit()
        return candidate if result.rowcount == 1 else None


def mark_job_failed(exam_id: int, message: str) -> None:
    with Session(engine) as session:
        job = session.get(ExamProcessingJob, exam_id)
        if job is None:
            return
        job.status = "failed"
        job.stage = "failed"
        job.error = message
        job.lease_expires_at = None
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()


class ExtractionWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run,
            name="exam-extraction-worker",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
        self._thread = None

    def notify(self) -> None:
        self._wake.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            exam_id = claim_next_job()
            if exam_id is None:
                self._wake.wait(POLL_INTERVAL_SECONDS)
                self._wake.clear()
                continue
            try:
                from parser import process_exam_job

                process_exam_job(exam_id)
            except Exception:  # noqa: BLE001 - prevent a worker crash from losing the queue
                logger.exception("Unexpected extraction worker failure for exam %s", exam_id)
                mark_job_failed(exam_id, "Processing failed unexpectedly. Please retry.")


_worker = ExtractionWorker()


def start_worker() -> None:
    _worker.start()


def stop_worker() -> None:
    _worker.stop()


def notify_worker() -> None:
    _worker.notify()
