#!/usr/bin/env bash
# MySmartStudy — Start Web Frontend (Next.js)
# Usage: bash start-frontend-web.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

trap 'echo ""; echo "[done] Web frontend stopped."; kill $PID 2>/dev/null; exit 0' INT TERM

echo "======================================"
echo "  MySmartStudy — Web Frontend"
echo "======================================"

cd "$ROOT/frontend-web"

[ ! -d "node_modules" ] && npm install --silent 2>&1 | tail -1

if [ ! -f ".env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
  echo "[web] Created .env.local"
fi

echo ""
echo "  URL:   http://localhost:3000"
echo "  Ctrl+C to stop"
echo ""

npm run dev &
PID=$!
wait $PID
