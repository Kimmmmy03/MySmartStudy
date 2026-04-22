#!/usr/bin/env bash
# MySmartStudy — Start Mobile App (Flutter)
# Usage: bash start-frontend-mobile.sh [device_id]
#   device_id: optional — defaults to first available device
#   Examples:
#     bash start-frontend-mobile.sh                   # auto-detect
#     bash start-frontend-mobile.sh emulator-5554     # Android emulator

ROOT="$(cd "$(dirname "$0")" && pwd)"
DEVICE="${1:-}"

trap 'echo ""; echo "[done] Mobile app stopped."; kill $PID 2>/dev/null; exit 0' INT TERM

echo "======================================"
echo "  MySmartStudy — Flutter Mobile"
echo "======================================"

cd "$ROOT/frontend-mobile"

echo ""
echo "  Devices:"
flutter devices 2>&1 | grep -v "^$"
echo ""

flutter pub get 2>&1 | tail -3

if [ -n "$DEVICE" ]; then
  echo "  Target: $DEVICE"
  flutter run -d "$DEVICE" &
else
  echo "  Target: first available device"
  flutter run &
fi
PID=$!

echo "  Ctrl+C to stop"
echo ""
wait $PID
