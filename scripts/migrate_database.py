#!/usr/bin/env python3
"""Copy every CheckUpTrack table from one database into another.

Built for moving production off Neon onto Aiven, but it works between any two
SQLAlchemy URLs (SQLite -> Postgres is useful for promoting a local dev DB).

The schema always comes from ``models.py``: the target gets
``SQLModel.metadata.create_all`` first, then rows are copied table by table in
foreign-key order and integer sequences are advanced past the copied ids.

The two URLs come from ``.env.local`` (or ``.env``) at the repo root, read by
the same ``env_loader`` the backend uses; real environment variables still win:

- ``MIGRATE_FROM_DATABASE_URL`` — the old database (source).
- ``MIGRATE_TO_DATABASE_URL`` — the new database (target). Falls back to
  ``DATABASE_URL``, which is what the app itself connects to.

``--from`` / ``--to`` override those values for a one-off run.

Usage::

    cd backend && .venv/bin/python ../scripts/migrate_database.py

    # look before you leap: report row counts and change nothing
    ... --dry-run

    # empty the target first (refuses otherwise)
    ... --replace

URLs are never printed in full; passwords are masked.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from datetime import datetime, timezone  # noqa: E402

from sqlalchemy import DateTime, MetaData, Table, create_engine, inspect, text  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from env_loader import load_env_files  # noqa: E402

# ``.env.local`` has to be read before the variables below are looked up.
load_env_files()

from database import _normalize_database_url  # noqa: E402
import models  # noqa: E402,F401  (registers the tables on SQLModel.metadata)

# Where each URL comes from, in lookup order (first non-empty value wins).
SOURCE_ENV_VARS = ("MIGRATE_FROM_DATABASE_URL", "OLD_DATABASE_URL")
TARGET_ENV_VARS = ("MIGRATE_TO_DATABASE_URL", "DATABASE_URL")


def _first_env(names: tuple[str, ...]) -> tuple[str, str]:
    """Return the first non-empty variable among *names* and its name."""
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value, name
    return "", names[0]


def _engine(url: str, label: str) -> Engine:
    """Create an engine for *url*, failing with a readable message."""
    normalized = _normalize_database_url(url.strip())
    if not normalized:
        raise SystemExit(f"{label}: no database URL given")
    if normalized.startswith("sqlite:///"):
        return create_engine(
            normalized, connect_args={"check_same_thread": False}, echo=False
        )
    return create_engine(normalized, pool_pre_ping=True, echo=False)


def _describe(engine: Engine) -> str:
    return engine.url.render_as_string(hide_password=True)


def _missing(label: str, names: tuple[str, ...], flag: str) -> str:
    joined = " or ".join(names)
    return (
        f"{label}: no database URL set ({joined}). Add it to .env.local at the "
        f"repo root (or export {names[0]}), or pass {flag} on the command line."
    )


def _table_order(metadata: MetaData) -> list[Table]:
    """Tables ordered so referenced tables are copied before their references."""
    return list(metadata.sorted_tables)


def _row_count(engine: Engine, table: Table) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text(f'SELECT COUNT(*) FROM "{table.name}"')).scalar() or 0)


def _shared_columns(source_columns: set[str], table: Table) -> list:
    """Model columns that also exist in the source table, in model order."""
    return [column for column in table.columns if column.name in source_columns]


def migrate(
    source: Engine,
    target: Engine,
    *,
    dry_run: bool = False,
    replace: bool = False,
) -> int:
    """Copy all tables from *source* into *target*; returns rows written."""
    if _describe(source) == _describe(target):
        raise SystemExit("--from and --to point at the same database")

    metadata = SQLModel.metadata
    tables = _table_order(metadata)

    print(f"source: {_describe(source)}")
    print(f"target: {_describe(target)}")

    if dry_run:
        source_tables = set(inspect(source).get_table_names())
        for table in tables:
            if table.name not in source_tables:
                print(f"  {table.name:<22} (missing in source, skipped)")
                continue
            print(f"  {table.name:<22} {_row_count(source, table)} rows")
        print("dry run: nothing was written")
        return 0

    # The target gets a complete, current schema even when it is brand new.
    metadata.create_all(target)

    existing = set(inspect(target).get_table_names())
    missing = [table.name for table in tables if table.name not in existing]
    if missing:
        raise SystemExit(f"target is missing tables after create_all: {missing}")

    if replace:
        with target.begin() as connection:
            for table in reversed(tables):
                connection.execute(text(f'DELETE FROM "{table.name}"'))
    else:
        occupied = [
            (table.name, _row_count(target, table))
            for table in tables
            if _row_count(target, table)
        ]
        if occupied:
            detail = ", ".join(f"{name}={count}" for name, count in occupied)
            raise SystemExit(
                "target is not empty "
                f"({detail}). Re-run with --replace to overwrite it, or point "
                "--to at a fresh Aiven database."
            )

    source_tables = set(inspect(source).get_table_names())
    written = 0
    for table in tables:
        if table.name not in source_tables:
            print(f"  {table.name:<22} 0 rows (not in source)")
            continue

        source_columns = {item["name"] for item in inspect(source).get_columns(table.name)}
        columns = _shared_columns(source_columns, table)
        if not columns:
            print(f"  {table.name:<22} 0 rows (no shared columns)")
            continue

        with source.connect() as connection:
            result = connection.execute(
                table.select().with_only_columns(*columns).order_by(None)
            )
            rows = [_normalize_row(columns, row._mapping) for row in result]

        if not rows:
            print(f"  {table.name:<22} 0 rows")
            continue

        with target.begin() as connection:
            connection.execute(table.insert(), rows)
        written += len(rows)
        print(f"  {table.name:<22} {len(rows)} rows")

    if target.dialect.name == "postgresql":
        _sync_sequences(target, tables)

    _verify(source, target, tables)
    return written


def _normalize_row(columns: list, mapping) -> dict:
    """Return a plain dict, with naive datetimes treated as UTC.

    SQLite stores timestamps without a timezone while the models declare
    timezone-aware ``datetime`` columns; SQLModel rejects naive values on insert.
    """
    row: dict = {}
    for column in columns:
        value = mapping[column.name]
        if (
            isinstance(value, datetime)
            and value.tzinfo is None
            and isinstance(column.type, DateTime)
            and column.type.timezone
        ):
            value = value.replace(tzinfo=timezone.utc)
        row[column.name] = value
    return row


def _sync_sequences(target: Engine, tables: list[Table]) -> None:
    """Advance serial sequences past the ids copied with explicit values."""
    with target.begin() as connection:
        for table in tables:
            column = table.columns.get("id")
            if column is None or not column.primary_key:
                continue
            if not str(column.type).upper().startswith(("INTEGER", "BIGINT", "SERIAL")):
                continue
            try:
                connection.execute(
                    text(
                        "SELECT setval("
                        f"pg_get_serial_sequence('{table.name}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM \"{table.name}\"), 1), "
                        f"(SELECT MAX(id) FROM \"{table.name}\") IS NOT NULL)"
                    )
                )
            except Exception as exc:  # pragma: no cover - table without a sequence
                print(f"  ! could not sync sequence for {table.name}: {exc}")


def _verify(source: Engine, target: Engine, tables: list[Table]) -> None:
    source_tables = set(inspect(source).get_table_names())
    mismatched: list[str] = []
    for table in tables:
        if table.name not in source_tables:
            continue
        if _row_count(source, table) != _row_count(target, table):
            mismatched.append(table.name)
    if mismatched:
        raise SystemExit(f"row counts differ after copy: {mismatched}")
    print("verified: row counts match for every copied table")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Copy CheckUpTrack data between two databases. URLs are read from "
            ".env.local unless --from/--to are given."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Environment (.env.local at the repo root):\n"
            "  MIGRATE_FROM_DATABASE_URL  old database (source)\n"
            "  MIGRATE_TO_DATABASE_URL    new database (target), default DATABASE_URL\n"
            "\nExample (Neon -> Aiven), with both set in .env.local:\n"
            "  cd backend && .venv/bin/python ../scripts/migrate_database.py --dry-run"
        ),
    )
    parser.add_argument(
        "--from",
        dest="source",
        default=None,
        help="source URL (default: MIGRATE_FROM_DATABASE_URL)",
    )
    parser.add_argument(
        "--to",
        dest="target",
        default=None,
        help="target URL (default: MIGRATE_TO_DATABASE_URL, then DATABASE_URL)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="report row counts, write nothing"
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="empty the target tables before copying (refused otherwise)",
    )
    args = parser.parse_args(argv)

    env_source, source_var = _first_env(SOURCE_ENV_VARS)
    env_target, target_var = _first_env(TARGET_ENV_VARS)
    source_url = args.source or env_source
    target_url = args.target or env_target
    if not source_url:
        raise SystemExit(_missing("source", SOURCE_ENV_VARS, "--from"))
    if not target_url:
        raise SystemExit(_missing("target", TARGET_ENV_VARS, "--to"))

    print(
        f"source url: {'--from' if args.source else source_var}"
        f" | target url: {'--to' if args.target else target_var}"
    )

    source = _engine(source_url, "source")
    target = _engine(target_url, "target")
    written = migrate(
        source, target, dry_run=args.dry_run, replace=args.replace
    )
    if not args.dry_run:
        print(f"copied {written} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
