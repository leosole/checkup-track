#!/bin/sh
# Preview launcher: starts the FastAPI backend and the Vite dev server.
# Freebuff injects PORT for the frontend; backend stays on 8000 (internal).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_PORT="${PORT:-5173}"

echo "==> Starting backend on :8000"
cd "$ROOT/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting frontend on :$FRONTEND_PORT"
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
