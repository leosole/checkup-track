import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import parser
import job_worker
import main
from models import (
    Exam,
    ExamBiomarker,
    ExamProcessingJob,
    LLMExamsExtractionSchema,
    ShareExam,
    ShareGrant,
    User,
)
from models import ExamProcessingResponse, ExamResponse
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select
from fastapi import HTTPException


class ProcessingJobModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.session.add(User(id="user-1", email="one@example.com", name="One"))
        self.exam = Exam(
            user_id="user-1",
            title="Report",
            date_performed=datetime(2026, 1, 1).date(),
            pdf_path="storage/pdfs/report.pdf",
            markdown_path="storage/markdowns/report.md",
        )
        self.session.add(self.exam)
        self.session.commit()
        self.session.refresh(self.exam)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)

    def test_new_job_starts_queued_with_empty_chunk_progress(self) -> None:
        job = ExamProcessingJob(exam_id=1)

        self.assertEqual(job.status, "queued")
        self.assertEqual(job.stage, "queued")
        self.assertEqual(job.completed_chunks, 0)
        self.assertEqual(job.total_chunks, 0)
        self.assertEqual(job.partial_results_json, "[]")
        self.assertIsNone(job.error)

    def test_markdown_chunks_respect_limit_without_dropping_text(self) -> None:
        markdown = "alpha beta\n\n" + ("long paragraph " * 5) + "\n\nend"

        chunks = parser._split_markdown(markdown, max_chars=20)

        self.assertTrue(chunks)
        self.assertTrue(all(len(chunk) <= 20 for chunk in chunks))
        self.assertEqual(" ".join(" ".join(chunks).split()), " ".join(markdown.split()))

    def test_markdown_chunks_do_not_split_table_rows(self) -> None:
        rows = ["| Glucose | 92 mg/dL |", "| Sodium | 140 mmol/L |"]
        markdown = "| Biomarker | Result |\n|---|---|\n" + "\n".join(rows)

        chunks = parser._split_markdown(markdown, max_chars=40)

        for row in rows:
            self.assertTrue(any(row in chunk for chunk in chunks))

    def test_claim_is_exclusive_and_expired_lease_can_be_reclaimed(self) -> None:
        self.session.add(ExamProcessingJob(exam_id=self.exam.id))
        self.session.commit()
        now = datetime.now(timezone.utc) + timedelta(seconds=1)

        with patch("job_worker.engine", self.engine):
            first_claim = job_worker.claim_next_job(now)
            second_claim = job_worker.claim_next_job(now)
            reclaimed = job_worker.claim_next_job(now + timedelta(minutes=20))

        self.assertEqual(first_claim, self.exam.id)
        self.assertIsNone(second_claim)
        self.assertEqual(reclaimed, self.exam.id)

    def test_enqueue_persists_exam_and_queued_job_without_extraction(self) -> None:
        requested_date = date(2026, 1, 2)
        with (
            patch("parser.engine", self.engine),
            patch("parser._save_raw_pdf", return_value="storage/pdfs/new.pdf"),
            patch("parser._extract_structured") as extract,
        ):
            response = parser.enqueue_exam(
                b"%PDF-1.4\n", "new.pdf", "user-1", requested_date=requested_date
            )

        self.assertEqual(response.processing.status, "queued")
        self.assertEqual(response.processing.completed_chunks, 0)
        self.assertEqual(response.title, "new")
        self.assertEqual(response.date_performed, requested_date)
        self.assertEqual(
            self.session.get(ExamProcessingJob, response.id).requested_date,
            requested_date,
        )
        extract.assert_not_called()

    def test_save_only_image_creates_no_processing_job(self) -> None:
        requested_date = date(2026, 2, 3)
        image_bytes = b"\x89PNG\r\n\x1a\nimage-data"
        with (
            patch("parser.engine", self.engine),
            patch("parser._save_exam_file", return_value="storage/pdfs/scan.png"),
            patch("parser._extract_structured") as extract,
        ):
            response = parser.save_exam_without_extraction(
                image_bytes,
                "scan.png",
                "user-1",
                "Scan",
                requested_date,
            )

        self.assertIsNone(response.processing)
        self.assertEqual(response.title, "Scan")
        self.assertEqual(response.date_performed, requested_date)
        self.assertIsNone(self.session.get(ExamProcessingJob, response.id))
        extract.assert_not_called()

    def test_exam_response_includes_persisted_processing_status(self) -> None:
        job = ExamProcessingJob(
            exam_id=self.exam.id,
            status="processing",
            stage="extracting",
            completed_chunks=2,
            total_chunks=5,
        )
        self.session.add(job)
        self.session.commit()

        response = main._exam_to_response(self.session, self.exam)

        self.assertEqual(response.processing.status, "processing")
        self.assertEqual(response.processing.completed_chunks, 2)
        self.assertEqual(response.processing.total_chunks, 5)

    def test_search_response_includes_persisted_processing_status(self) -> None:
        self.session.add(
            ExamProcessingJob(
                exam_id=self.exam.id,
                status="processing",
                stage="extracting",
                completed_chunks=1,
                total_chunks=3,
            )
        )
        self.session.commit()

        with patch("parser.engine", self.engine):
            results = parser.search_exams("user-1", "report")

        self.assertEqual(results[0].processing.completed_chunks, 1)
        self.assertEqual(results[0].processing.total_chunks, 3)

    def test_retry_rejects_an_exam_owned_by_another_user(self) -> None:
        self.session.add(ExamProcessingJob(exam_id=self.exam.id, status="failed"))
        self.session.commit()

        with self.assertRaises(HTTPException) as raised:
            main.retry_exam_extraction(self.exam.id, self._other_user(), self.session)

        self.assertEqual(raised.exception.status_code, 404)

    def test_retry_requeues_failed_job_and_keeps_completed_chunks(self) -> None:
        job = ExamProcessingJob(
            exam_id=self.exam.id,
            status="failed",
            stage="failed",
            completed_chunks=2,
            total_chunks=4,
            error="Rate limited",
            partial_results_json="[]",
        )
        self.session.add(job)
        self.session.commit()

        with patch("main.notify_worker") as notify:
            response = main.retry_exam_extraction(self.exam.id, self._owner(), self.session)

        self.assertEqual(response.processing.status, "queued")
        self.assertEqual(response.processing.completed_chunks, 2)
        self.assertIsNone(response.extraction_error)
        notify.assert_called_once()

    def test_deleting_exam_removes_its_processing_job(self) -> None:
        self.session.add(ExamProcessingJob(exam_id=self.exam.id, status="failed"))
        self.session.commit()

        with patch("main.object_storage.delete_pdf"):
            main.delete_exam(self.exam.id, self._owner(), self.session)

        self.assertIsNone(self.session.get(ExamProcessingJob, self.exam.id))
        self.assertIsNone(self.session.get(Exam, self.exam.id))

    def test_deleting_exam_removes_its_share_references(self) -> None:
        share = ShareGrant(
            owner_id="user-1",
            code_hash="hashed-code",
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
        self.session.add(share)
        self.session.commit()
        self.session.add(ShareExam(share_id=share.id, exam_id=self.exam.id))
        self.session.commit()

        with patch("main.object_storage.delete_pdf"):
            main.delete_exam(self.exam.id, self._owner(), self.session)

        self.assertIsNone(
            self.session.get(ShareExam, (share.id, self.exam.id))
        )

    def _other_user(self) -> User:
        return User(id="user-2", email="two@example.com", name="Two")

    def _owner(self) -> User:
        return User(id="user-1", email="one@example.com", name="One")

    def test_worker_persists_chunk_progress_and_merged_results(self) -> None:
        with (
            patch("parser.engine", self.engine),
            patch("parser._save_raw_pdf", return_value="storage/pdfs/new.pdf"),
        ):
            requested_date = date(2026, 3, 4)
            queued = parser.enqueue_exam(
                b"%PDF-1.4\n", "new.pdf", "user-1", requested_date=requested_date
            )

        chunk_results = [
            LLMExamsExtractionSchema(
                title="New report",
                date_performed=None,
                biomarkers=[
                    ExamBiomarker(
                        exam_id=0,
                        biomarker_name=name,
                        value=value,
                        unit="mg/dL",
                        is_abnormal=False,
                    )
                ],
            )
            for name, value in (("Glucose", 90), ("Sodium", 140))
        ]
        with TemporaryDirectory() as directory:
            markdown_path = Path(directory) / "new.md"
            markdown_path.write_text("first section\n\nsecond section", encoding="utf-8")
            with (
                patch("parser.engine", self.engine),
                patch("parser._load_pdf_bytes", return_value=b"%PDF-1.4\n"),
                patch("parser._convert_to_markdown", return_value=markdown_path),
                patch("parser._configured_provider_credentials", return_value=([(None, "key")], None)),
                patch("parser._split_markdown", return_value=["first section", "second section"]),
                patch("parser._extract_structured", side_effect=[(chunk_results[0], None), (chunk_results[1], None)]),
            ):
                parser.process_exam_job(queued.id)

        self.session.expire_all()
        job = self.session.get(ExamProcessingJob, queued.id)
        exam = self.session.get(Exam, queued.id)
        biomarkers = self.session.exec(
            select(ExamBiomarker).where(ExamBiomarker.exam_id == queued.id)
        ).all()
        self.assertEqual(job.status, "completed")
        self.assertEqual((job.completed_chunks, job.total_chunks), (2, 2))
        self.assertEqual(exam.title, "New report")
        self.assertEqual(exam.date_performed, requested_date)
        self.assertEqual({item.biomarker_name for item in biomarkers}, {"Glucose", "Sodium"})

    def test_worker_reschedules_rate_limited_job_without_marking_it_failed(self) -> None:
        with (
            patch("parser.engine", self.engine),
            patch("parser._save_raw_pdf", return_value="storage/pdfs/new.pdf"),
        ):
            queued = parser.enqueue_exam(b"%PDF-1.4\n", "new.pdf", "user-1")

        with TemporaryDirectory() as directory:
            markdown_path = Path(directory) / "new.md"
            markdown_path.write_text("result section", encoding="utf-8")
            with (
                patch("parser.engine", self.engine),
                patch("parser._load_pdf_bytes", return_value=b"%PDF-1.4\n"),
                patch("parser._convert_to_markdown", return_value=markdown_path),
                patch("parser._configured_provider_credentials", return_value=([(None, "key")], None)),
                patch("parser._extract_structured", side_effect=parser.ProviderRateLimitError(37)),
            ):
                parser.process_exam_job(queued.id)

        self.session.expire_all()
        job = self.session.get(ExamProcessingJob, queued.id)
        self.assertEqual(job.status, "queued")
        self.assertEqual(job.stage, "waiting_for_provider")
        self.assertIsNone(job.error)
        self.assertGreater(job.next_attempt_at, datetime.now(timezone.utc))


class ExtractionMergeTests(unittest.TestCase):
    def test_merge_keeps_distinct_results_and_removes_duplicate_markers(self) -> None:
        first = LLMExamsExtractionSchema(
            title="Annual panel",
            date_performed=None,
            biomarkers=[
                ExamBiomarker(
                    exam_id=0,
                    biomarker_name="Glucose",
                    value=92,
                    unit="mg/dL",
                    reference_range="70-99",
                    is_abnormal=False,
                )
            ],
        )
        second = LLMExamsExtractionSchema(
            title="",
            date_performed=None,
            biomarkers=[
                ExamBiomarker(
                    exam_id=0,
                    biomarker_name=" glucose ",
                    value=92,
                    unit="mg/dL",
                    reference_range="70-99",
                    is_abnormal=False,
                ),
                ExamBiomarker(
                    exam_id=0,
                    biomarker_name="Glucose",
                    value=105,
                    unit="mg/dL",
                    reference_range="70-99",
                    is_abnormal=True,
                ),
            ],
        )

        merged = parser._merge_extractions([first, second])

        self.assertEqual(merged.title, "Annual panel")
        self.assertEqual(len(merged.biomarkers), 2)


class UploadQueueRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_upload_returns_queued_exam_and_notifies_worker(self) -> None:
        user = User(id="user-1", email="one@example.com", name="One")
        response = ExamResponse(
            id=5,
            title="New report",
            date_performed="2026-01-01",
            pdf_path="storage/pdfs/new.pdf",
            markdown_path="",
            processing=ExamProcessingResponse(
                status="queued",
                stage="queued",
                completed_chunks=0,
                total_chunks=0,
                retry_allowed=False,
                updated_at=datetime.now(timezone.utc),
            ),
        )

        class FakeUpload:
            filename = "new.pdf"

            async def read(self) -> bytes:
                return b"%PDF-1.4\n"

        with (
            patch("main.enqueue_exam", return_value=response) as enqueue,
            patch("main.notify_worker") as notify,
        ):
            result = await main.upload_exam(
                FakeUpload(),
                title=None,
                date_performed=None,
                image_only=False,
                user=user,
            )

        self.assertEqual(result.processing.status, "queued")
        enqueue.assert_called_once_with(
            b"%PDF-1.4\n", "new.pdf", "user-1", None, None
        )
        notify.assert_called_once()
        upload_route = next(
            route for route in main.app.routes
            if getattr(route, "path", None) == "/api/exams/upload"
        )
        self.assertEqual(upload_route.status_code, 202)

    async def test_image_only_upload_is_saved_without_notifying_worker(self) -> None:
        user = User(id="user-1", email="one@example.com", name="One")
        response = ExamResponse(
            id=6,
            title="Chest X-ray",
            date_performed="2026-11-09",
            pdf_path="storage/pdfs/chest-xray.png",
            markdown_path="",
            processing=None,
        )

        class FakeUpload:
            filename = "chest-xray.png"

            async def read(self) -> bytes:
                return b"image-bytes"

        with (
            patch("main.save_exam_without_extraction", return_value=response) as save_exam,
            patch("main.enqueue_exam") as enqueue,
            patch("main.notify_worker") as notify,
        ):
            result = await main.upload_exam(
                FakeUpload(),
                title="Chest X-ray",
                date_performed=None,
                image_only=True,
                user=user,
            )

        self.assertEqual(result.title, "Chest X-ray")
        save_exam.assert_called_once_with(
            b"image-bytes", "chest-xray.png", "user-1", "Chest X-ray", None
        )
        enqueue.assert_not_called()
        notify.assert_not_called()


if __name__ == "__main__":
    unittest.main()