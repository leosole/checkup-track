import os
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import auth
import main
from models import (
    Exam,
    ExamBiomarker,
    GuestCodeRequest,
    Medication,
    MedicationUse,
    ShareCreate,
    ShareGrant,
    ShareGroupTitleUpdate,
    Symptom,
    SymptomOccurrence,
    User,
)


class ShareTests(unittest.TestCase):
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
        self.exam_a = Exam(
            user_id=self.user.id,
            title="Panel A",
            date_performed=date(2026, 1, 1),
            pdf_path="exams/a.pdf",
            markdown_path="storage/markdowns/a.md",
        )
        self.exam_b = Exam(
            user_id=self.user.id,
            title="Panel B",
            date_performed=date(2026, 2, 1),
            pdf_path="exams/b.pdf",
            markdown_path="storage/markdowns/b.md",
        )
        self.other_exam = Exam(
            user_id=self.other_user.id,
            title="Someone else's panel",
            date_performed=date(2026, 3, 1),
            pdf_path="exams/c.pdf",
            markdown_path="storage/markdowns/c.md",
        )
        self.medication_a = Medication(user_id=self.user.id, name="Med A")
        self.medication_b = Medication(user_id=self.user.id, name="Med B")
        self.other_medication = Medication(
            user_id=self.other_user.id, name="Med C"
        )
        self.symptom = Symptom(user_id=self.user.id, title="Headache")
        self.other_symptom = Symptom(user_id=self.other_user.id, title="Cramp")
        self.session.add_all([self.symptom, self.other_symptom])
        self.session.commit()
        self.session.refresh(self.symptom)
        self.session.refresh(self.other_symptom)
        self.occurrence_a = SymptomOccurrence(
            symptom_id=self.symptom.id,
            observation="morning",
            start_date=date(2026, 1, 2),
        )
        self.occurrence_b = SymptomOccurrence(
            symptom_id=self.symptom.id,
            start_date=date(2026, 1, 5),
            end_date=date(2026, 1, 7),
        )
        self.other_occurrence = SymptomOccurrence(
            symptom_id=self.other_symptom.id,
            start_date=date(2026, 1, 9),
        )
        self.session.add_all(
            [self.occurrence_a, self.occurrence_b, self.other_occurrence]
        )
        self.session.commit()
        for occurrence in (
            self.occurrence_a,
            self.occurrence_b,
            self.other_occurrence,
        ):
            self.session.refresh(occurrence)
        rows = [
            self.user,
            self.other_user,
            self.exam_a,
            self.exam_b,
            self.other_exam,
            self.medication_a,
            self.medication_b,
            self.other_medication,
        ]
        self.session.add_all(rows)
        self.session.commit()
        for row in rows[2:]:
            self.session.refresh(row)

        self.use_a = MedicationUse(
            medication_id=self.medication_a.id,
            dosage="10 mg",
            frequency_per_day=1,
            start_date=date(2026, 1, 1),
        )
        self.use_b = MedicationUse(
            medication_id=self.medication_b.id,
            dosage="5 mg",
            frequency_per_day=2,
            start_date=date(2026, 2, 1),
        )
        self.other_use = MedicationUse(
            medication_id=self.other_medication.id,
            dosage="1 mg",
            frequency_per_day=1,
            start_date=date(2026, 3, 1),
        )
        self.session.add_all([self.use_a, self.use_b, self.other_use])
        self.session.commit()
        for use in (self.use_a, self.use_b, self.other_use):
            self.session.refresh(use)

        self.environment = patch.dict(os.environ, {"JWT_SECRET": "test-secret"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)

    def create(
        self,
        exam_ids=(),
        medication_use_ids=(),
        symptom_occurrence_ids=(),
        user=None,
    ):
        return main.create_share(
            ShareCreate(
                exam_ids=list(exam_ids),
                medication_use_ids=list(medication_use_ids),
                symptom_occurrence_ids=list(symptom_occurrence_ids),
            ),
            user or self.user,
            self.session,
        )

    def stored_share(self, share_id: int) -> ShareGrant:
        share = self.session.get(ShareGrant, share_id)
        self.assertIsNotNone(share)
        return share

    def guest_credentials(self, token: str) -> HTTPAuthorizationCredentials:
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    def test_creation_returns_code_once_and_stores_only_a_hash(self) -> None:
        created = self.create([self.exam_a.id], [self.use_a.id])

        self.assertTrue(created.share.code)
        self.assertEqual(
            created.group_key,
            f"exams={self.exam_a.id};medications={self.use_a.id}",
        )
        share = self.stored_share(created.share.id)
        self.assertNotEqual(share.code_hash, created.share.code)
        self.assertNotIn(created.share.code.replace("-", ""), share.code_hash)
        self.assertEqual(created.share.status, "active")

    def test_cannot_share_another_users_records(self) -> None:
        with self.assertRaises(HTTPException) as exams_raised:
            self.create([self.other_exam.id])
        self.assertEqual(exams_raised.exception.status_code, 404)

        with self.assertRaises(HTTPException) as medications_raised:
            self.create([], [self.other_use.id])
        self.assertEqual(medications_raised.exception.status_code, 404)

    def test_requires_at_least_one_record(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            self.create()
        self.assertEqual(raised.exception.status_code, 422)

    def test_code_can_be_redeemed_only_once(self) -> None:
        created = self.create([self.exam_a.id])
        assert created.share.code is not None

        guest = main.redeem_share_code(
            GuestCodeRequest(code=created.share.code), self.session
        )
        self.assertTrue(guest.access_token)
        self.assertEqual(guest.share.exam_count, 1)

        with self.assertRaises(HTTPException) as raised:
            main.redeem_share_code(
                GuestCodeRequest(code=created.share.code), self.session
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_expired_code_cannot_be_redeemed(self) -> None:
        created = self.create([self.exam_a.id])
        assert created.share.code is not None
        share = self.stored_share(created.share.id)
        share.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        self.session.add(share)
        self.session.commit()

        with self.assertRaises(HTTPException) as raised:
            main.redeem_share_code(
                GuestCodeRequest(code=created.share.code), self.session
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_guest_sees_only_selected_records_and_cannot_use_owner_routes(self) -> None:
        created = self.create([self.exam_a.id], [self.use_a.id])
        assert created.share.code is not None
        guest = main.redeem_share_code(
            GuestCodeRequest(code=created.share.code), self.session
        )
        credentials = self.guest_credentials(guest.access_token)

        share = auth.get_guest_share(credentials, self.session)
        data = main.guest_shared_data(share, self.session)

        self.assertEqual([exam.id for exam in data.exams], [self.exam_a.id])
        self.assertEqual(
            [medication.id for medication in data.medications],
            [self.medication_a.id],
        )
        self.assertEqual(
            [use.id for use in data.medications[0].uses], [self.use_a.id]
        )
        self.assertEqual(data.share.owner_name, "One")
        self.assertNotIn("pdf_path", data.exams[0].model_dump())

        with self.assertRaises(HTTPException) as raised:
            auth.get_current_user(credentials, self.session)
        self.assertEqual(raised.exception.status_code, 401)

    def test_guest_trends_only_include_shared_exams(self) -> None:
        self.session.add_all(
            [
                ExamBiomarker(
                    exam_id=self.exam_a.id,
                    biomarker_name="Glucose",
                    value=5.4,
                    unit="mmol/L",
                    is_abnormal=False,
                ),
                ExamBiomarker(
                    exam_id=self.exam_b.id,
                    biomarker_name="Glucose",
                    value=6.1,
                    unit="mmol/L",
                    is_abnormal=True,
                ),
                ExamBiomarker(
                    exam_id=self.other_exam.id,
                    biomarker_name="Glucose",
                    value=9.9,
                    unit="mmol/L",
                    is_abnormal=True,
                ),
            ]
        )
        self.session.commit()

        created = self.create([self.exam_a.id])
        assert created.share.code is not None
        guest = main.redeem_share_code(
            GuestCodeRequest(code=created.share.code), self.session
        )
        share = auth.get_guest_share(
            self.guest_credentials(guest.access_token), self.session
        )

        trends = main.guest_time_series(None, None, ["Glucose"], share, self.session)

        self.assertEqual(len(trends.series), 1)
        self.assertEqual(
            [point.exam_title for point in trends.series[0].points], ["Panel A"]
        )
        self.assertEqual(trends.series[0].unit, "mmol/L")

        with self.assertRaises(HTTPException) as raised:
            main.guest_time_series(None, None, [], share, self.session)
        self.assertEqual(raised.exception.status_code, 422)

    def test_identical_selections_share_a_group_and_reshares_raise_the_count(self) -> None:
        first = self.create([self.exam_a.id], [self.use_a.id])
        second = self.create([self.exam_a.id], [self.use_a.id])
        self.create([self.exam_b.id])

        self.assertEqual(first.group_key, second.group_key)

        groups = main.list_share_groups(self.user, self.session)
        self.assertEqual(len(groups), 2)

        repeated = next(
            group for group in groups if group.group_key == first.group_key
        )
        self.assertEqual(repeated.times_shared, 2)
        self.assertEqual([exam.title for exam in repeated.exams], ["Panel A"])
        self.assertEqual(len(repeated.codes), 2)
        self.assertEqual(repeated.active_codes, 2)

        other_groups = main.list_share_groups(self.other_user, self.session)
        self.assertEqual(other_groups, [])

    def test_group_title_can_be_set_renamed_and_cleared(self) -> None:
        created = self.create([self.exam_a.id])

        named = main.rename_share_group(
            ShareGroupTitleUpdate(group_key=created.group_key, title="  Cardiology "),
            self.user,
            self.session,
        )
        self.assertEqual(named[0].title, "Cardiology")

        # Sharing the same selection again keeps the group (and its name).
        self.create([self.exam_a.id])
        groups = main.list_share_groups(self.user, self.session)
        self.assertEqual([group.title for group in groups], ["Cardiology"])

        renamed = main.rename_share_group(
            ShareGroupTitleUpdate(group_key=created.group_key, title="Annual visit"),
            self.user,
            self.session,
        )
        self.assertEqual(renamed[0].title, "Annual visit")

        cleared = main.rename_share_group(
            ShareGroupTitleUpdate(group_key=created.group_key, title="   "),
            self.user,
            self.session,
        )
        self.assertIsNone(cleared[0].title)

    def test_cannot_rename_another_users_group(self) -> None:
        created = self.create([self.exam_a.id])

        with self.assertRaises(HTTPException) as raised:
            main.rename_share_group(
                ShareGroupTitleUpdate(group_key=created.group_key, title="Mine"),
                self.other_user,
                self.session,
            )
        self.assertEqual(raised.exception.status_code, 404)

    def test_revoking_ends_an_active_guest_session(self) -> None:
        created = self.create([self.exam_a.id])
        assert created.share.code is not None
        guest = main.redeem_share_code(
            GuestCodeRequest(code=created.share.code), self.session
        )
        credentials = self.guest_credentials(guest.access_token)

        main.revoke_share(created.share.id, self.user, self.session)

        with self.assertRaises(HTTPException) as raised:
            auth.get_guest_share(credentials, self.session)
        self.assertEqual(raised.exception.status_code, 401)

        groups = main.list_share_groups(self.user, self.session)
        self.assertEqual(groups[0].codes[0].status, "revoked")
        self.assertEqual(groups[0].active_codes, 0)

    def test_guest_sees_only_selected_symptom_occurrences_nested(self) -> None:
        created = self.create(symptom_occurrence_ids=[self.occurrence_a.id])
        assert created.share.code is not None
        guest = main.redeem_share_code(
            GuestCodeRequest(code=created.share.code), self.session
        )
        share = auth.get_guest_share(
            self.guest_credentials(guest.access_token), self.session
        )

        data = main.guest_shared_data(share, self.session)

        self.assertEqual(len(data.symptoms), 1)
        symptom = data.symptoms[0]
        self.assertEqual(symptom.title, "Headache")
        self.assertEqual(
            [occurrence.id for occurrence in symptom.occurrences],
            [self.occurrence_a.id],
        )
        self.assertEqual(symptom.occurrences[0].observation, "morning")
        self.assertEqual(data.share.symptom_count, 1)

    def test_cannot_share_another_users_symptom(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            self.create(symptom_occurrence_ids=[self.other_occurrence.id])
        self.assertEqual(raised.exception.status_code, 404)

    def test_symptom_occurrences_group_into_share_groups(self) -> None:
        occurrence_ids = [self.occurrence_a.id, self.occurrence_b.id]
        first = self.create(symptom_occurrence_ids=occurrence_ids)
        second = self.create(symptom_occurrence_ids=occurrence_ids)

        self.assertEqual(first.group_key, second.group_key)
        groups = main.list_share_groups(self.user, self.session)
        repeated = next(
            group for group in groups if group.group_key == first.group_key
        )
        self.assertEqual(repeated.symptom_occurrence_ids, occurrence_ids)
        self.assertEqual([item.title for item in repeated.symptoms], ["Headache"])
        self.assertEqual(len(repeated.symptoms[0].occurrences), 2)

    def test_deleting_a_use_drops_it_from_share_groups(self) -> None:
        self.create(medication_use_ids=[self.use_a.id])

        main.delete_medication_use(self.use_a.id, self.user, self.session)

        self.assertEqual(main.list_share_groups(self.user, self.session), [])

    def test_deleting_an_occurrence_drops_it_from_share_groups(self) -> None:
        self.create(symptom_occurrence_ids=[self.occurrence_a.id])

        main.delete_symptom_occurrence(self.occurrence_a.id, self.user, self.session)

        self.assertEqual(main.list_share_groups(self.user, self.session), [])

    def test_other_users_cannot_revoke_a_share(self) -> None:
        created = self.create([self.exam_a.id])

        with self.assertRaises(HTTPException) as raised:
            main.revoke_share(created.share.id, self.other_user, self.session)
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
