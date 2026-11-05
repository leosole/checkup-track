import unittest
from datetime import date

from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import main
from models import Exam, ManualBiomarkerInput, User


class ManualExamTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.user = User(id="user-1", email="one@example.com", name="One")
        self.other_user = User(id="user-2", email="two@example.com", name="Two")
        self.exam = Exam(
            user_id=self.user.id,
            title="report",
            date_performed=date(2026, 1, 1),
            pdf_path="exams/report.pdf",
            markdown_path="storage/markdowns/report.md",
        )
        self.session.add_all([self.user, self.other_user, self.exam])
        self.session.commit()
        self.session.refresh(self.exam)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)

    def test_saves_manual_exam_details_and_custom_biomarkers(self) -> None:
        payload = main.ManualExamInput(
            title="Annual blood work",
            date_performed=date(2026, 2, 3),
            biomarkers=[
                ManualBiomarkerInput(
                    biomarker_name="Custom marker",
                    value=12.5,
                    unit="mg/L",
                    reference_range="10-15",
                    is_abnormal=True,
                )
            ],
        )

        response = main.save_manual_exam_results(
            self.exam.id, payload, self.user, self.session
        )

        self.assertEqual(response.title, "Annual blood work")
        self.assertEqual(response.date_performed, date(2026, 2, 3))
        self.assertEqual(len(response.biomarkers), 1)
        self.assertEqual(response.biomarkers[0].biomarker_name, "Custom marker")
        self.assertEqual(response.biomarkers[0].value, 12.5)
        self.assertEqual(response.biomarkers[0].reference_range, "10-15")
        self.assertTrue(response.biomarkers[0].is_abnormal)
        self.assertEqual(self.session.get(Exam, self.exam.id).pdf_path, "exams/report.pdf")

    def test_cannot_save_manual_results_for_another_users_exam(self) -> None:
        payload = main.ManualExamInput(
            title="Changed",
            date_performed=date(2026, 2, 3),
            biomarkers=[],
        )

        with self.assertRaises(HTTPException) as raised:
            main.save_manual_exam_results(
                self.exam.id, payload, self.other_user, self.session
            )

        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()