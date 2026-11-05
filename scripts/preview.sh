#!/bin/sh
# Preview launcher: starts the FastAPI backend and the Vite dev server.
# Freebuff injects PORT for the frontend; backend stays on 8000 (internal).
# Backend auto-reload is on by default; set RELOAD=0 to disable it.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_PORT="${PORT:-5173}"

RELOAD_FLAG=""
if [ "${RELOAD:-1}" != "0" ]; then
  RELOAD_FLAG="--reload"
fi

# Prefer the project virtualenv: the system python3 is often too old for the
# backend dependencies (uvicorn, markitdown), which otherwise fails silently.
if [ -x "$ROOT/backend/.venv/bin/python" ]; then
  PYTHON="$ROOT/backend/.venv/bin/python"
else
  PYTHON="python3"
fi

echo "==> Starting backend on :8000${RELOAD_FLAG:+ (auto-reload)}"
cd "$ROOT/backend"
"$PYTHON" -m uvicorn main:app --host 0.0.0.0 --port 8000 $RELOAD_FLAG &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for the API before starting the UI. A frontend with no backend reports
# "Google sign-in is not configured", which hides the real cause.
printf '==> Waiting for the API'
attempts=0
ready=0
while [ "$attempts" -lt 40 ]; do
  if "$PYTHON" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo
    echo "ERROR: the backend exited during startup; see the traceback above." >&2
    exit 1
  fi
  attempts=$((attempts + 1))
  printf '.'
  sleep 0.5
done
echo
if [ "$ready" != "1" ]; then
  echo "ERROR: the API never answered on http://127.0.0.1:8000/health" >&2
  exit 1
fi

echo "==> Starting frontend on :$FRONTEND_PORT"
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
