import unittest
from datetime import date

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import main
from models import Exam, ExamBiomarker, User


class AnalyticsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.user = User(id="user-1", email="one@example.com", name="One")
        exam = Exam(
            user_id=self.user.id,
            title="Annual panel",
            date_performed=date(2026, 3, 10),
            pdf_path="exams/panel.pdf",
            markdown_path="storage/markdowns/panel.md",
        )
        self.session.add_all(
            [
                self.user,
                exam,
            ]
        )
        self.session.commit()
        self.session.refresh(exam)
        self.session.add_all(
            [
                ExamBiomarker(
                    exam_id=exam.id,
                    biomarker_name="Vitamin A",
                    value=1.2,
                    unit="mg/L",
                    is_abnormal=False,
                ),
                ExamBiomarker(
                    exam_id=exam.id,
                    biomarker_name="VitA",
                    value=2.3,
                    unit="mg/L",
                    is_abnormal=False,
                ),
                ExamBiomarker(
                    exam_id=exam.id,
                    biomarker_name="Vitamin A, total",
                    value=3.4,
                    unit="mg/L",
                    is_abnormal=False,
                ),
            ]
        )
        self.session.commit()
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)

    def test_requested_marker_returns_only_exact_normalized_name(self) -> None:
        vitamin_a = main.time_series(
            None, None, ["  Vitamin A  "], self.user, self.session
        )
        vita = main.time_series(None, None, ["VitA"], self.user, self.session)

        self.assertEqual(len(vitamin_a.series), 1)
        self.assertEqual(vitamin_a.series[0].spec, "Vitamin A")
        self.assertEqual([point.value for point in vitamin_a.series[0].points], [1.2])
        self.assertEqual([point.value for point in vita.series[0].points], [2.3])


if __name__ == "__main__":
    unittest.main()