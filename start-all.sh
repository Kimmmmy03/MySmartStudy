#!/usr/bin/env bash
# MySmartStudy — Start All Services
# Usage: bash start-all.sh [device_id]
#   Starts: Backend (8000) + Web Frontend (3000) + Flutter Mobile
#   device_id: optional mobile device (default: emulator-5554)

ROOT="$(cd "$(dirname "$0")" && pwd)"
DEVICE="${1:-emulator-5554}"

cleanup() {
  echo ""
  echo "======================================"
  echo "  Shutting down all services..."
  echo "======================================"
  [ -n "$MOBILE_PID" ]  && kill $MOBILE_PID 2>/dev/null
  [ -n "$WEB_PID" ]     && kill $WEB_PID 2>/dev/null
  [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
  wait 2>/dev/null
  echo "[done] All stopped."
  exit 0
}
trap cleanup INT TERM

echo "======================================"
echo "  MySmartStudy — All Services"
echo "======================================"

# ── Backend ──
cd "$ROOT/backend"
if [ -d "venv/Scripts" ]; then
  source venv/Scripts/activate 2>/dev/null
elif [ -d "venv/bin" ]; then
  source venv/bin/activate 2>/dev/null
fi
pip install -r requirements.txt --quiet 2>&1 | tail -1
uvicorn main:app --reload --host 0.0.0.0 --port 8000 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!
sleep 3

# ── Web Frontend ──
cd "$ROOT/frontend-web"
[ ! -d "node_modules" ] && npm install --silent 2>&1 | tail -1
[ ! -f ".env.local" ] && echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev 2>&1 | sed 's/^/[web] /' &
WEB_PID=$!

# ── Flutter Mobile ──
cd "$ROOT/frontend-mobile"
flutter pub get 2>&1 | tail -3
flutter run -d "$DEVICE" 2>&1 | sed 's/^/[mobile] /' &
MOBILE_PID=$!

echo ""
echo "======================================"
echo "  Backend:  http://localhost:8000"
echo "  Web:      http://localhost:3000"
echo "  Mobile:   Flutter on $DEVICE"
echo ""
echo "  Ctrl+C to stop all"
echo "======================================"
echo ""

wait
