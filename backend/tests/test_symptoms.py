import unittest
from datetime import date

from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import main
from models import (
    Symptom,
    SymptomCreate,
    SymptomOccurrence,
    SymptomOccurrenceUpdate,
    User,
)


class SymptomTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.user = User(id="user-1", email="one@example.com", name="One")
        self.other = User(id="user-2", email="two@example.com", name="Two")
        self.session.add_all([self.user, self.other])
        self.session.commit()
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)

    def log(self, entries, title="Headache", user=None):
        payload = SymptomCreate(
            title=title,
            dates=[
                {
                    "start_date": start,
                    "end_date": end,
                    "observation": observation,
                }
                for start, end, observation in entries
            ],
        )
        return main.create_symptoms(payload, user or self.user, self.session)

    def test_create_logs_one_occurrence_per_date_entry(self) -> None:
        created = self.log(
            [
                (date(2026, 11, 1), None, "Started in the morning"),
                (date(2026, 11, 3), date(2026, 11, 5), None),
                (date(2026, 11, 3), date(2026, 11, 3), "Single day"),
            ]
        )

        self.assertEqual(len(created), 3)
        self.assertEqual({item.symptom_id for item in created}, {created[0].symptom_id})
        self.assertEqual(
            [item.observation for item in created],
            ["Started in the morning", None, "Single day"],
        )
        self.assertEqual(len(self.session.exec(select(Symptom)).all()), 1)
        self.assertEqual(len(self.session.exec(select(SymptomOccurrence)).all()), 3)
        self.assertIsNone(created[0].end_date)

    def test_reuses_existing_title_case_insensitively(self) -> None:
        first = self.log([(date(2026, 11, 1), None, "a")], title="Headache")
        second = self.log([(date(2026, 11, 7), None, "b")], title="  headache ")

        self.assertEqual(first[0].symptom_id, second[0].symptom_id)
        self.assertEqual(len(self.session.exec(select(Symptom)).all()), 1)
        self.assertEqual(len(self.session.exec(select(SymptomOccurrence)).all()), 2)

    def test_rename_merges_into_existing_symptom(self) -> None:
        headache = self.log([(date(2026, 11, 1), None, None)], title="Headache")[0]
        migraine = self.log(
            [(date(2026, 11, 4), None, "aura")], title="Migraine"
        )[0]

        updated = main.update_symptom_occurrence(
            migraine.id,
            SymptomOccurrenceUpdate(title="Headache"),
            self.user,
            self.session,
        )

        self.assertEqual(updated.symptom_id, headache.symptom_id)
        self.assertEqual(updated.title, "Headache")
        self.assertIsNone(self.session.get(Symptom, migraine.symptom_id))
        self.assertEqual(len(self.session.exec(select(SymptomOccurrence)).all()), 2)

    def test_rename_without_conflict_renames_the_symptom(self) -> None:
        occurrence = self.log(
            [(date(2026, 11, 1), None, None)], title="Head ache"
        )[0]

        updated = main.update_symptom_occurrence(
            occurrence.id,
            SymptomOccurrenceUpdate(title="Headache"),
            self.user,
            self.session,
        )

        self.assertEqual(updated.title, "Headache")
        symptom = self.session.get(Symptom, occurrence.symptom_id)
        self.assertIsNotNone(symptom)
        self.assertEqual(symptom.title, "Headache")

    def test_update_clears_observation_and_end_date(self) -> None:
        occurrence = self.log(
            [(date(2026, 11, 1), date(2026, 11, 4), "pressure")]
        )[0]

        updated = main.update_symptom_occurrence(
            occurrence.id,
            SymptomOccurrenceUpdate(observation=None, end_date=None),
            self.user,
            self.session,
        )

        self.assertIsNone(updated.observation)
        self.assertIsNone(updated.end_date)

    def test_rejects_a_backwards_range(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            self.log([(date(2026, 11, 5), date(2026, 11, 1), None)])
        self.assertEqual(raised.exception.status_code, 422)

        occurrence = self.log([(date(2026, 11, 5), None, None)])[0]
        with self.assertRaises(HTTPException) as raised:
            main.update_symptom_occurrence(
                occurrence.id,
                SymptomOccurrenceUpdate(end_date=date(2026, 11, 1)),
                self.user,
                self.session,
            )
        self.assertEqual(raised.exception.status_code, 422)

    def test_other_user_cannot_read_or_delete_an_occurrence(self) -> None:
        occurrence = self.log([(date(2026, 11, 1), None, None)])[0]

        with self.assertRaises(HTTPException) as raised:
            main.update_symptom_occurrence(
                occurrence.id,
                SymptomOccurrenceUpdate(observation="mine now"),
                self.other,
                self.session,
            )
        self.assertEqual(raised.exception.status_code, 404)

        with self.assertRaises(HTTPException) as raised:
            main.delete_symptom_occurrence(occurrence.id, self.other, self.session)
        self.assertEqual(raised.exception.status_code, 404)

    def test_deleting_the_last_occurrence_removes_the_symptom(self) -> None:
        created = self.log(
            [
                (date(2026, 11, 1), None, "a"),
                (date(2026, 11, 2), None, "b"),
            ]
        )
        symptom_id = created[0].symptom_id

        main.delete_symptom_occurrence(created[0].id, self.user, self.session)
        self.assertIsNotNone(self.session.get(Symptom, symptom_id))

        main.delete_symptom_occurrence(created[1].id, self.user, self.session)
        self.assertIsNone(self.session.get(Symptom, symptom_id))

    def test_calendar_returns_symptom_ranges(self) -> None:
        self.log([(date(2026, 11, 3), date(2026, 11, 4), "tender")], title="Headache")

        response = main.calendar(self.user, self.session)

        self.assertEqual(len(response.symptoms), 1)
        symptom = response.symptoms[0]
        self.assertEqual(symptom.title, "Headache")
        self.assertEqual(symptom.observation, "tender")
        self.assertEqual(symptom.start_date, date(2026, 11, 3))
        self.assertEqual(symptom.end_date, date(2026, 11, 4))


if __name__ == "__main__":
    unittest.main()
