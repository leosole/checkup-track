"""SQLModel engine initialization and session management.

Production deployments set ``DATABASE_URL`` to a Postgres instance (Neon,
Supabase, RDS, ...). When the variable is unset — local development, tests and
CI — the app falls back to SQLite at ``backend/health.db`` so nothing extra is
required to run it.
"""

import os
import tempfile
from pathlib import Path
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine

from env_loader import load_env_files

# ``.env.local`` has to be read before anything below inspects the environment.
load_env_files()

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
DATABASE_PATH = BASE_DIR / "health.db"

DEFAULT_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


def _normalize_database_url(url: str) -> str:
    """Accept the legacy ``postgres://`` spelling and pin the installed driver.

    SQLAlchemy 2.1 resolves a bare ``postgresql://`` URL to the psycopg (v3)
    driver, but this project installs psycopg2-binary. Naming the driver keeps
    the URL working across SQLAlchemy releases; URLs that already name one are
    left untouched.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


def _writable_dir(path: Path) -> Path:
    """Return a writable directory, falling back to the temp dir if needed.

    Hosted filesystems may be read-only, and ``storage/`` lives inside the
    source tree. PDFs only need to exist while text is being extracted, so the
    system temp dir is an acceptable fallback (B2 is used when configured).
    """
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write-probe"
        probe.touch()
        probe.unlink()
        return path
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "vitals-storage" / path.name
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


PDF_DIR = _writable_dir(STORAGE_DIR / "pdfs")
MARKDOWN_DIR = _writable_dir(STORAGE_DIR / "markdowns")

DATABASE_URL = _normalize_database_url(
    os.environ.get("DATABASE_URL", "").strip() or DEFAULT_DATABASE_URL
)
IS_POSTGRES = DATABASE_URL.startswith(("postgresql://", "postgresql+"))

if IS_POSTGRES:
    try:
        engine = create_engine(
            DATABASE_URL,
            # Hosted Postgres drops idle connections; verify before use.
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_recycle=1800,
            echo=False,
        )
    except ModuleNotFoundError as exc:  # pragma: no cover - missing driver
        raise RuntimeError(
            "Postgres requires psycopg2-binary. Install dependencies with "
            "`pip install -r backend/requirements.txt`."
        ) from exc
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )


def init_db() -> None:
    """Create database tables (idempotent, safe on every cold start)."""
    # Import models so they register on the SQLModel metadata before create_all.
    from models import Exam, ExamBiomarker, Medication, User  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a SQLModel session."""
    with Session(engine) as session:
        yield session
