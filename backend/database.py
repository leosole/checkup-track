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

from sqlalchemy import inspect, text
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


def _migrate_medication_uses() -> None:
    """Move per-medication prescription data onto dated ``medicationuse`` rows.

    Older databases stored dosage, frequency and dates directly on
    ``medication``. Each legacy row becomes one use with the same id, so
    existing share links keep pointing at the right course. Runs once; the
    column check makes it idempotent.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "medication" not in tables:
        return
    legacy_columns = {"dosage", "frequency_per_day", "start_date"} <= {
        item["name"] for item in inspector.get_columns("medication")
    }
    if not legacy_columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO medicationuse "
                "(id, medication_id, dosage, frequency_per_day, start_date, end_date) "
                "SELECT m.id, m.id, m.dosage, m.frequency_per_day, m.start_date, "
                "m.end_date FROM medication m WHERE NOT EXISTS ("
                "SELECT 1 FROM medicationuse u WHERE u.medication_id = m.id)"
            )
        )
        if IS_POSTGRES:
            # Explicit ids were copied, so advance the sequence past them.
            connection.execute(
                text(
                    "SELECT setval("
                    "pg_get_serial_sequence('medicationuse', 'id'), "
                    "COALESCE((SELECT MAX(id) FROM medicationuse), 1))"
                )
            )

    # Share links now reference a use instead of a medication.
    if "sharemedication" in tables:
        share_columns = {
            item["name"] for item in inspector.get_columns("sharemedication")
        }
        if "medication_use_id" not in share_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE sharemedication RENAME TO sharemedication_legacy")
                )
            SQLModel.metadata.create_all(engine)
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO sharemedication (share_id, medication_use_id) "
                        "SELECT share_id, medication_id FROM sharemedication_legacy"
                    )
                )
                connection.execute(text("DROP TABLE sharemedication_legacy"))

    # Drop the legacy columns; only the NOT NULL ones must go for new inserts.
    if IS_POSTGRES:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE medication "
                    "DROP COLUMN IF EXISTS dosage, "
                    "DROP COLUMN IF EXISTS frequency_per_day, "
                    "DROP COLUMN IF EXISTS start_date, "
                    "DROP COLUMN IF EXISTS end_date, "
                    "DROP COLUMN IF EXISTS color"
                )
            )
        return

    # SQLite cannot drop columns on older versions, so rebuild the table.
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE medication_new ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "user_id VARCHAR NOT NULL, name VARCHAR NOT NULL)"
            )
        )
        connection.execute(
            text("INSERT INTO medication_new (id, user_id, name) SELECT id, user_id, name FROM medication")
        )
        connection.execute(text("DROP TABLE medication"))
        connection.execute(text("ALTER TABLE medication_new RENAME TO medication"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_medication_user_id ON medication (user_id)")
        )


def init_db() -> None:
    """Create database tables (idempotent, safe on every cold start)."""
    # Import models so they register on the SQLModel metadata before create_all.
    from models import (  # noqa: F401
        Exam,
        ExamBiomarker,
        ExamProcessingJob,
        Medication,
        MedicationUse,
        ShareExam,
        ShareGrant,
        ShareMedication,
        ShareSymptom,
        Symptom,
        SymptomOccurrence,
        User,
        UserProviderCredential,
    )

    SQLModel.metadata.create_all(engine)
    # create_all never alters an existing table, so new nullable columns are
    # added here. Each entry is (table, column, SQL type).
    new_columns = (
        ("examprocessingjob", "requested_date", "DATE"),
        ("exam", "laboratory", "VARCHAR(200)"),
    )
    existing_columns: dict[str, set[str]] = {}
    for table, column, column_type in new_columns:
        if table not in existing_columns:
            existing_columns[table] = {
                item["name"] for item in inspect(engine).get_columns(table)
            }
        if column in existing_columns[table]:
            continue
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
                )
            existing_columns[table].add(column)
        except Exception:
            if column not in {
                item["name"] for item in inspect(engine).get_columns(table)
            }:
                raise

    _migrate_medication_uses()


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a SQLModel session."""
    with Session(engine) as session:
        yield session
