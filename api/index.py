"""ASGI entrypoint for Freebuff's Python hosting.

Freebuff runs Python from ``api/*.py`` and installs ``api/requirements.txt``
itself. The application still lives in ``backend/main.py``; this module only
makes ``backend/`` importable and re-exports the FastAPI ``app`` object.

The backend modules use flat imports (``from database import ...``), so that
directory has to be on ``sys.path`` before importing ``main``.
"""

import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import init_db  # noqa: E402  (import after sys.path setup)
from main import app  # noqa: E402

logger = logging.getLogger("api.entrypoint")

# Serverless hosts do not reliably run ASGI lifespan/startup events, so create
# the schema here instead. create_all is idempotent and cheap; a failure is
# logged rather than raised so /health can still answer and show the outage.
try:
    init_db()
except Exception:  # pragma: no cover - misconfigured DATABASE_URL
    logger.exception("Database initialization failed at startup")

__all__ = ["app"]
