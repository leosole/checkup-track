import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier
from unittest.mock import patch

import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import auth
import main
from database import get_session
from models import Exam, ExamBiomarker, Medication, ShareGrant, User
from test_user import TEST_USER_ID, user_response


class TestAccountAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.environment = patch.dict(
            os.environ, {"JWT_SECRET": "test-secret", "TEST_USER_ENABLED": "1"}
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.addCleanup(self.engine.dispose)
        self.session = Session(self.engine)
        self.addCleanup(self.session.close)
        self.user = User(id=TEST_USER_ID, email="test@example.invalid", name="Test User")
        self.owner = User(id="owner", email="owner@example.invalid", name="Owner")
        self.session.add_all([self.user, self.owner])
        self.session.commit()

    def authenticate(self, token: str) -> User:
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        return auth.get_current_user(credentials, self.session)

    def test_test_account_has_only_the_agreed_write_permissions(self) -> None:
        response = user_response(self.authenticate(auth.create_access_token(TEST_USER_ID)))
        self.assertEqual(response.name, "Test User")
        self.assertEqual(
            {name for name, allowed in response.capabilities.model_dump().items() if allowed},
            {"edit_exam_metadata", "edit_medications", "create_shares"},
        )
        self.assertTrue(all(user_response(self.owner).capabilities.model_dump().values()))

    def test_disabling_test_access_invalidates_existing_sessions(self) -> None:
        token = auth.create_access_token(TEST_USER_ID)
        with patch.dict(os.environ, {"TEST_USER_ENABLED": "0"}):
            with self.assertRaises(HTTPException) as raised:
                self.authenticate(token)
        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(self.authenticate(auth.create_access_token("owner")).id, "owner")

    def test_test_scope_cannot_authenticate_an_owner_or_be_removed(self) -> None:
        for subject, scope in [("owner", "test"), (TEST_USER_ID, None), ("owner", "unknown")]:
            with self.subTest(subject=subject, scope=scope):
                token = jwt.encode(
                    {"sub": subject, "scope": scope}, "test-secret", algorithm="HS256"
                )
                with self.assertRaises(HTTPException) as raised:
                    self.authenticate(token)
                self.assertEqual(raised.exception.status_code, 401)

    def test_capability_guard_denies_record_creation_but_allows_edits(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            auth.require_capability("create_records")(self.user)
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(auth.require_capability("edit_medications")(self.user), self.user)
        self.assertEqual(auth.require_capability("create_records")(self.owner), self.owner)


class TestAccountAPITests(unittest.TestCase):
    def setUp(self) -> None:
        self.environment = patch.dict(os.environ, {
            "JWT_SECRET": "test-secret",
            "TEST_USER_ENABLED": "1",
            "GOOGLE_CLIENT_ID": "",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.addCleanup(self.engine.dispose)

        def test_session():
            with Session(self.engine) as session:
                yield session

        main.app.dependency_overrides[get_session] = test_session
        self.addCleanup(main.app.dependency_overrides.clear)
        self.search_engine = patch("parser.engine", self.engine)
        self.search_engine.start()
        self.addCleanup(self.search_engine.stop)
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)

    def login(self):
        response = self.client.post("/api/auth/test")
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.client.headers["Authorization"] = f"Bearer {result['access_token']}"
        return result

    def counts(self):
        with Session(self.engine) as session:
            return tuple(len(session.exec(select(model)).all()) for model in (
                User, Exam, ExamBiomarker, Medication, ShareGrant,
            ))

    def test_google_free_login_seeds_once_and_preserves_metadata_edits(self):
        config = self.client.get("/api/auth/config").json()
        self.assertIsNone(config["google_client_id"])
        self.assertTrue(config["test_user_enabled"])
        login = self.login()
        self.assertEqual(self.counts(), (1, 3, 9, 2, 0))
        self.assertEqual(self.client.get("/api/auth/me").json(), login["user"])
        exams = self.client.get("/api/exams").json()
        exam_id = exams[0]["id"]
        updated = self.client.patch(f"/api/exams/{exam_id}", json={
            "title": "Shared visitor edit", "date_performed": "2026-10-12",
        })
        self.assertEqual(updated.status_code, 200, updated.text)
        self.login()
        self.assertEqual(self.counts(), (1, 3, 9, 2, 0))
        persisted = {exam["id"]: exam for exam in self.client.get("/api/exams").json()}
        self.assertEqual(persisted[exam_id]["title"], "Shared visitor edit")
        self.assertEqual(persisted[exam_id]["date_performed"], "2026-10-12")
        self.assertEqual(len(persisted[exam_id]["biomarkers"]), 3)
        medication = self.client.get("/api/medications").json()[0]
        changed = self.client.patch(f"/api/medications/uses/{medication['id']}", json={
            "medication_name": "Edited sample supplement", "dosage": "500 IU",
        })
        self.assertEqual(changed.status_code, 200, changed.text)
        self.assertEqual(changed.json()["dosage"], "500 IU")
        self.assertEqual(self.counts(), (1, 3, 9, 2, 0))

    def test_disabled_login_and_sessions_are_unavailable(self):
        self.login()
        with patch.dict(os.environ, {"TEST_USER_ENABLED": "0"}):
            self.assertFalse(self.client.get("/api/auth/config").json()["test_user_enabled"])
            self.assertEqual(self.client.post("/api/auth/test").status_code, 404)
            self.assertEqual(self.client.get("/api/exams").status_code, 401)
        self.client.headers.pop("Authorization")
        self.assertEqual(self.client.get("/api/exams").status_code, 401)

    def test_google_accounts_keep_normal_creation_and_deletion_permissions(self):
        with patch("main.verify_google_id_token", return_value={
            "sub": "google-owner", "email": "owner@example.invalid", "name": "Owner",
        }) as verify:
            response = self.client.post("/api/auth/google", json={"token": "external-google-token"})
        self.assertEqual(response.status_code, 200, response.text)
        verify.assert_called_once_with("external-google-token")
        self.assertTrue(all(response.json()["user"]["capabilities"].values()))
        self.client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
        created = self.client.post("/api/medications", json={
            "medication_name": "Owner medication",
            "uses": [{"dosage": "10 mg", "frequency_per_day": 1, "start_date": "2026-01-01"}],
        })
        self.assertEqual(created.status_code, 200, created.text)
        deleted = self.client.delete(f"/api/medications/uses/{created.json()[0]['id']}")
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertEqual(self.client.get("/api/medications").json(), [])

    def test_forbidden_mutations_have_no_database_or_external_effects(self):
        self.login()
        exam = self.client.get("/api/exams").json()[0]
        medication = self.client.get("/api/medications").json()[0]
        before = self.counts()
        routes = [
            ("POST", "/api/medications", {"medication_name": "New", "uses": [{"dosage": "1 mg", "frequency_per_day": 1, "start_date": "2026-01-01"}]}),
            ("DELETE", f"/api/medications/uses/{medication['id']}", None),
            ("DELETE", f"/api/exams/{exam['id']}", None),
            ("PUT", f"/api/exams/{exam['id']}/manual", {"title": "Changed", "date_performed": "2026-01-01", "biomarkers": []}),
            ("POST", f"/api/exams/{exam['id']}/retry", None),
            ("PUT", "/api/profile/providers/gemini", {"api_key": "fake-test-key"}),
            ("DELETE", "/api/profile/providers/gemini", None),
            ("PUT", "/api/profile/providers/order", {"providers": ["gemini"]}),
            ("DELETE", "/api/shares/1", None),
        ]
        with patch("main.enqueue_exam") as enqueue, patch("main.encrypt_api_key") as encrypt, patch("main.object_storage.delete_pdf") as delete_pdf:
            for method, path, payload in routes:
                with self.subTest(method=method, path=path):
                    response = self.client.request(method, path, json=payload)
                    self.assertEqual(response.status_code, 403, response.text)
            upload = self.client.post("/api/exams/upload", files={
                "file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf"),
            })
            self.assertEqual(upload.status_code, 403, upload.text)
            enqueue.assert_not_called()
            encrypt.assert_not_called()
            delete_pdf.assert_not_called()
        self.assertEqual(self.counts(), before)
        self.assertEqual(self.client.get("/api/exams").json()[0], exam)

    def test_reads_pdf_and_sharing_work_and_guest_cannot_write(self):
        self.login()
        exams = self.client.get("/api/exams").json()
        self.assertEqual(len(self.client.get("/api/exams/search?q=Glucose").json()), 3)
        self.assertEqual(len(self.client.get("/api/calendar").json()["exams"]), 3)
        series = self.client.get("/api/analytics/time-series?specs=Glucose").json()
        self.assertEqual(len(series["series"][0]["points"]), 3)
        for exam in exams:
            pdf = self.client.get(f"/api/exams/{exam['id']}/pdf")
            self.assertEqual(pdf.status_code, 200, pdf.text[:80])
            self.assertTrue(pdf.content.startswith(b"%PDF-"))
        created = self.client.post("/api/shares", json={"exam_ids": [exams[0]["id"]]})
        self.assertEqual(created.status_code, 201, created.text)
        share = created.json()["share"]
        redeemed = self.client.post("/api/shares/redeem", json={"code": share["code"]})
        self.assertEqual(redeemed.status_code, 200, redeemed.text)
        self.client.headers["Authorization"] = f"Bearer {redeemed.json()['access_token']}"
        data = self.client.get("/api/guest/data")
        self.assertEqual(data.status_code, 200, data.text)
        self.assertEqual([exam["id"] for exam in data.json()["exams"]], [exams[0]["id"]])
        self.assertEqual(self.client.get(f"/api/guest/exams/{exams[0]['id']}/pdf").status_code, 200)
        self.assertEqual(self.client.get(f"/api/guest/exams/{exams[1]['id']}/pdf").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/exams/{exams[0]['id']}", json={"title": "Forbidden"}).status_code, 401)
        self.assertEqual(self.client.post("/api/shares/redeem", json={"code": share["code"]}).status_code, 403)

    def test_owner_isolation_and_share_limits(self):
        self.login()
        exam = self.client.get("/api/exams").json()[0]
        with Session(self.engine) as session:
            session.add(User(id="owner", email="owner@example.invalid", name="Owner"))
            session.commit()
            private = Exam(user_id="owner", title="Private", date_performed=datetime.now().date(), pdf_path="private.pdf", markdown_path="")
            session.add(private)
            session.commit()
            private_id = private.id
        self.assertEqual(len(self.client.get("/api/exams").json()), 3)
        self.assertEqual(self.client.patch(f"/api/exams/{private_id}", json={"title": "Not mine"}).status_code, 404)
        self.assertEqual(self.client.post("/api/shares", json={"exam_ids": [private_id]}).status_code, 404)
        for index in range(20):
            created = self.client.post("/api/shares", json={"exam_ids": [exam["id"]]})
            self.assertEqual(created.status_code, 201, f"share {index}: {created.text}")
        self.assertEqual(self.client.post("/api/shares", json={"exam_ids": [exam["id"]]}).status_code, 429)
        with Session(self.engine) as session:
            grant = session.exec(select(ShareGrant)).first()
            grant.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            session.add(grant)
            session.commit()
        self.assertEqual(self.client.post("/api/shares", json={"exam_ids": [exam["id"]]}).status_code, 201)
        self.assertEqual(self.counts()[-1], 20)
        self.client.headers["Authorization"] = f"Bearer {auth.create_access_token('owner')}"
        self.assertEqual(self.client.get("/api/auth/me").json()["capabilities"]["create_records"], True)
        self.assertEqual(self.client.delete(f"/api/exams/{exam['id']}").status_code, 404)

    def test_expired_tampered_and_guest_tokens_cannot_access_the_account(self):
        login = self.login()
        expired = jwt.encode({
            "sub": TEST_USER_ID,
            "scope": "test",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        }, "test-secret", algorithm="HS256")
        for token in (expired, login["access_token"] + "tampered", auth.create_guest_token(1, datetime.now(timezone.utc) + timedelta(days=1))):
            with self.subTest(token=token[:20]):
                self.client.headers["Authorization"] = f"Bearer {token}"
                self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
                self.assertEqual(self.client.get("/api/exams").status_code, 401)

    def test_concurrent_first_logins_and_shares_are_bounded(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.engine = create_engine(
            f"sqlite:///{Path(directory.name) / 'concurrency.db'}",
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        SQLModel.metadata.create_all(self.engine)
        self.addCleanup(self.engine.dispose)
        barrier = Barrier(4)

        def first_login(visitor):
            barrier.wait(timeout=10)
            return self.client.post("/api/auth/test")

        with ThreadPoolExecutor(max_workers=4) as executor:
            responses = list(executor.map(first_login, range(4)))
        self.assertEqual([response.status_code for response in responses], [200] * 4)
        self.assertEqual(self.counts(), (1, 3, 9, 2, 0))
        self.login()
        exam = self.client.get("/api/exams").json()[0]

        def create_share(visitor):
            return self.client.post("/api/shares", json={"exam_ids": [exam["id"]]})

        with ThreadPoolExecutor(max_workers=4) as executor:
            responses = list(executor.map(create_share, range(24)))
        statuses = [response.status_code for response in responses]
        self.assertEqual(statuses.count(201), 20, statuses)
        self.assertEqual(statuses.count(429), 4, statuses)
        self.assertEqual(self.counts(), (1, 3, 9, 2, 20))

    def test_retained_share_limit_cannot_be_bypassed_by_redeeming_codes(self):
        self.login()
        exam = self.client.get("/api/exams").json()[0]
        now = datetime.now(timezone.utc)
        with Session(self.engine) as session:
            session.add_all([
                ShareGrant(
                    owner_id=TEST_USER_ID,
                    code_hash=f"used-test-share-{index}",
                    expires_at=now + timedelta(days=1),
                    used_at=now,
                )
                for index in range(100)
            ])
            session.commit()
        response = self.client.post("/api/shares", json={"exam_ids": [exam["id"]]})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(self.counts()[-1], 100)