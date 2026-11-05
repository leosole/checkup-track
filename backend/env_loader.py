"""Load dotenv files for local development before configuration is read.

``.env.local`` at the repo root holds the real development values, but nothing
in the process ever reads that file: a plain ``uvicorn main:app`` (or any
script importing backend modules) only sees variables the shell already
exported. Importing this module first loads the known dotenv files into
``os.environ`` so ``DATABASE_URL``, ``GOOGLE_CLIENT_ID``, ``B2_*`` and
``CREDENTIAL_ENCRYPTION_KEY`` behave the same however the app is started.

Rules:

- Real environment variables always win (``override=False``). CI and the hosted
  platform set variables directly and must never be replaced by a file.
- ``.env.local`` takes priority over ``.env``; repo root over ``backend/``.
  The first file to define a key wins.
- Loading is idempotent and never raises: a broken file must not stop the API.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import List

logger = logging.getLogger("env")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Priority order: the first file to define a key wins.
_ENV_FILES = (
    PROJECT_ROOT / ".env.local",
    BASE_DIR / ".env.local",
    PROJECT_ROOT / ".env",
    BASE_DIR / ".env",
)

try:  # python-dotenv handles quoting/escaping properly; fall back when absent.
    from dotenv import load_dotenv as _load_dotenv
except ModuleNotFoundError:  # pragma: no cover - listed in requirements
    _load_dotenv = None

_loaded = False


def _fallback_load(path: Path) -> None:
    """Minimal KEY=VALUE reader used when python-dotenv is not installed."""
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, sep, value = line.partition("=")
        key = key.strip()
        if not sep or not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            # Trailing ``# comment`` after an unquoted value.
            value = value.split(" #", 1)[0].strip()
        os.environ[key] = value


def load_env_files() -> List[Path]:
    """Load whichever dotenv files exist; returns the paths that were read."""
    global _loaded
    if _loaded:
        return []
    _loaded = True

    loaded: List[Path] = []
    for path in _ENV_FILES:
        if not path.is_file():
            continue
        try:
            if _load_dotenv is not None:
                _load_dotenv(path, override=False)
            else:
                _fallback_load(path)
        except (OSError, ValueError):
            logger.warning("Could not read environment file %s", path, exc_info=True)
            continue
        loaded.append(path)

    if loaded:
        logger.info("Loaded environment from %s", ", ".join(str(p) for p in loaded))
    return loaded
