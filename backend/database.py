"""SQLModel engine initialization and session management."""

from pathlib import Path
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
PDF_DIR = STORAGE_DIR / "pdfs"
MARKDOWN_DIR = STORAGE_DIR / "markdowns"
DATABASE_PATH = BASE_DIR / "health.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


def init_db() -> None:
    """Create local storage folders and create database tables."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)

    # Import models so they register on the SQLModel metadata before create_all.
    from models import Exam, ExamBiomarker, Medication, User  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a SQLModel session."""
    with Session(engine) as session:
        yield session
