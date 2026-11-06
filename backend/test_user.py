"""Identity and permissions for the public synthetic account."""

import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from models import (
    AccountCapabilities,
    Exam,
    ExamBiomarker,
    Medication,
    ShareExam,
    ShareGrant,
    ShareMedication,
    User,
    UserResponse,
)

TEST_USER_ID = "checkup-track:test-user"
TEST_TOKEN_SCOPE = "test"
FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "test-user"
SAMPLE_REPORTS = {
    "test-user:baseline": "baseline.pdf",
    "test-user:follow-up": "follow-up.pdf",
    "test-user:latest": "latest.pdf",
}


def test_user_enabled() -> bool:
    return os.environ.get("TEST_USER_ENABLED", "").strip().lower() in ("1", "true")


def account_capabilities(user: User) -> AccountCapabilities:
    if user.id != TEST_USER_ID:
        return AccountCapabilities()
    return AccountCapabilities(
        create_records=False,
        delete_records=False,
        edit_results=False,
        manage_providers=False,
        revoke_shares=False,
        retry_extraction=False,
    )


def user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        capabilities=account_capabilities(user),
    )


def ensure_test_user(session: Session) -> User:
    user = session.get(User, TEST_USER_ID)
    if user is not None:
        return user
    user = User(id=TEST_USER_ID, email="test@example.invalid", name="Test User")
    today = date.today()
    try:
        session.add(user)
        session.flush()
        panels = [
            ("baseline", "Sample baseline panel", 180, 108.0, 224.0, 13.8),
            ("follow-up", "Sample follow-up panel", 90, 99.0, 205.0, 14.1),
            ("latest", "Sample latest panel", 0, 92.0, 188.0, 14.3),
        ]
        for key, title, days_ago, glucose, cholesterol, hemoglobin in panels:
            exam = Exam(
                user_id=user.id,
                title=title,
                date_performed=today - timedelta(days=days_ago),
                pdf_path=f"test-user:{key}",
                markdown_path="",
            )
            session.add(exam)
            session.flush()
            for name, value, unit, reference, abnormal in [
                ("Glucose", glucose, "mg/dL", "70-99", glucose > 99),
                ("Total Cholesterol", cholesterol, "mg/dL", "<200", cholesterol >= 200),
                ("Hemoglobin", hemoglobin, "g/dL", "12.0-17.5", False),
            ]:
                session.add(ExamBiomarker(
                    exam_id=exam.id,
                    biomarker_name=name,
                    value=value,
                    unit=unit,
                    reference_range=reference,
                    is_abnormal=abnormal,
                ))
        session.add_all([
            Medication(
                user_id=user.id,
                name="Sample vitamin D",
                dosage="1000 IU",
                frequency_per_day=1,
                start_date=today - timedelta(days=60),
            ),
            Medication(
                user_id=user.id,
                name="Sample iron supplement",
                dosage="18 mg",
                frequency_per_day=1,
                start_date=today - timedelta(days=150),
                end_date=today - timedelta(days=90),
            ),
        ])
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.get(User, TEST_USER_ID)
        if existing is None:
            raise
        return existing
    session.refresh(user)
    return user


def sample_pdf(exam: Exam) -> bytes | None:
    filename = SAMPLE_REPORTS.get(exam.pdf_path)
    if exam.user_id != TEST_USER_ID or filename is None:
        return None
    return (FIXTURE_DIR / filename).read_bytes()


def prepare_test_share(session: Session, user: User, now: datetime) -> None:
    if user.id != TEST_USER_ID:
        return
    session.exec(update(User).where(User.id == TEST_USER_ID).values(name=User.name))
    expired_ids = select(ShareGrant.id).where(
        ShareGrant.owner_id == user.id, ShareGrant.expires_at <= now
    )
    session.exec(delete(ShareExam).where(ShareExam.share_id.in_(expired_ids)))
    session.exec(delete(ShareMedication).where(ShareMedication.share_id.in_(expired_ids)))
    session.exec(delete(ShareGrant).where(
        ShareGrant.owner_id == user.id, ShareGrant.expires_at <= now
    ))
    retained = session.exec(select(ShareGrant).where(ShareGrant.owner_id == user.id)).all()
    active_count = sum(
        share.used_at is None and share.revoked_at is None for share in retained
    )
    if active_count >= 20 or len(retained) >= 100:
        raise HTTPException(
            status_code=429,
            detail="The test account has reached its share limit. Try after existing shares expire.",
        )