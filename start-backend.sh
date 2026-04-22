#!/usr/bin/env bash
# MySmartStudy — Start Backend (FastAPI)
# Usage: bash start-backend.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

trap 'echo ""; echo "[done] Backend stopped."; kill $PID 2>/dev/null; exit 0' INT TERM

echo "======================================"
echo "  MySmartStudy — Backend"
echo "======================================"

cd "$ROOT/backend"

# Activate venv
if [ -d "venv/Scripts" ]; then
  source venv/Scripts/activate 2>/dev/null
elif [ -d "venv/bin" ]; then
  source venv/bin/activate 2>/dev/null
fi

pip install -r requirements.txt --quiet 2>&1 | tail -1

echo ""
echo "  API:   http://localhost:8000"
echo "  Docs:  http://localhost:8000/docs"
echo "  Ctrl+C to stop"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
PID=$!
wait $PID
