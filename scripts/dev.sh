#!/usr/bin/env bash
# MySmartStudy — Interactive Dev Manager
# Usage: bash dev.sh [device_id]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVICE="${1:-emulator-5554}"

BACKEND_PID=""
WEB_PID=""
MOBILE_PID=""

LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

# ── Colors ────────────────────────────────────────────────────────────────────
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
C='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
is_running() { [ -n "$1" ] && kill -0 "$1" 2>/dev/null; }

status_badge() {
  if is_running "$1"; then echo -e "${G}● RUNNING${NC}"; else echo -e "${R}○ STOPPED${NC}"; fi
}

hr() { echo -e "${DIM}──────────────────────────────────────${NC}"; }

# ── Service: Backend ──────────────────────────────────────────────────────────
start_backend() {
  is_running "$BACKEND_PID" && { echo -e "${C}[backend]${NC} Already running."; return; }
  echo -e "${C}[backend]${NC} Starting..."
  cd "$ROOT/backend"
  if   [ -d "venv/Scripts" ]; then source venv/Scripts/activate 2>/dev/null
  elif [ -d "venv/bin"     ]; then source venv/bin/activate     2>/dev/null
  fi
  uvicorn main:app --reload --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo -e "${C}[backend]${NC} Started → http://localhost:8000  (PID $BACKEND_PID)"
}

stop_backend() {
  if is_running "$BACKEND_PID"; then
    kill "$BACKEND_PID" 2>/dev/null; wait "$BACKEND_PID" 2>/dev/null
    echo -e "${C}[backend]${NC} Stopped."
  else
    echo -e "${C}[backend]${NC} Already stopped."
  fi
  BACKEND_PID=""
}

# ── Service: Web Frontend ─────────────────────────────────────────────────────
start_web() {
  is_running "$WEB_PID" && { echo -e "${B}[web]${NC} Already running."; return; }
  echo -e "${B}[web]${NC} Starting..."
  cd "$ROOT/frontend-web"
  [ ! -d "node_modules" ] && { echo -e "${B}[web]${NC} Installing npm deps..."; npm install --silent; }
  [ ! -f ".env.local" ] && echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
  npm run dev > "$LOG_DIR/web.log" 2>&1 &
  WEB_PID=$!
  echo -e "${B}[web]${NC} Started → http://localhost:3000  (PID $WEB_PID)"
}

stop_web() {
  if is_running "$WEB_PID"; then
    kill "$WEB_PID" 2>/dev/null; wait "$WEB_PID" 2>/dev/null
    echo -e "${B}[web]${NC} Stopped."
  else
    echo -e "${B}[web]${NC} Already stopped."
  fi
  WEB_PID=""
}

# ── Service: Mobile ───────────────────────────────────────────────────────────
start_mobile() {
  is_running "$MOBILE_PID" && { echo -e "${Y}[mobile]${NC} Already running."; return; }
  echo -e "${Y}[mobile]${NC} Starting on device: ${BOLD}$DEVICE${NC}"
  cd "$ROOT/frontend-mobile"
  flutter pub get > /dev/null 2>&1
  flutter run -d "$DEVICE" > "$LOG_DIR/mobile.log" 2>&1 &
  MOBILE_PID=$!
  echo -e "${Y}[mobile]${NC} Started  (PID $MOBILE_PID)"
}

stop_mobile() {
  if is_running "$MOBILE_PID"; then
    kill "$MOBILE_PID" 2>/dev/null; wait "$MOBILE_PID" 2>/dev/null
    echo -e "${Y}[mobile]${NC} Stopped."
  else
    echo -e "${Y}[mobile]${NC} Already stopped."
  fi
  MOBILE_PID=""
}

# ── Bulk ─────────────────────────────────────────────────────────────────────
start_all()   { start_backend; sleep 2; start_web; start_mobile; }
stop_all()    { stop_mobile; stop_web; stop_backend; }
restart_all() { stop_all; sleep 1; start_all; }

# ── Live Logs ─────────────────────────────────────────────────────────────────
show_logs() {
  local logfile="$1" label="$2"
  if [ ! -f "$logfile" ]; then
    echo -e "$label Log not found — service may not have started yet."
    return
  fi
  echo -e "$label Live log  ${DIM}(Ctrl+C to return to menu)${NC}"
  hr
  trap 'echo ""; trap cleanup INT TERM' INT
  tail -f "$logfile"
  trap cleanup INT TERM
  hr
  echo -e "${DIM}Back in dev manager.${NC}"
}

# ── Menu ──────────────────────────────────────────────────────────────────────
show_menu() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║    MySmartStudy — Dev Manager        ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
  echo -e "  ${C}Backend${NC}  :8000    $(status_badge "$BACKEND_PID")"
  echo -e "  ${B}Web${NC}      :3000    $(status_badge "$WEB_PID")"
  echo -e "  ${Y}Mobile${NC}   Flutter  $(status_badge "$MOBILE_PID")"
  hr
  echo -e "  ${DIM}── All Services ──────────────────────${NC}"
  echo -e "  ${BOLD}[1]${NC} Start All   ${BOLD}[2]${NC} Stop All   ${BOLD}[3]${NC} Restart All"
  echo ""
  echo -e "  ${DIM}── ${C}Backend${NC} ${DIM}─────────────────────────${NC}"
  echo -e "  ${BOLD}[4]${NC} Start   ${BOLD}[5]${NC} Stop   ${BOLD}[6]${NC} Restart   ${BOLD}[7]${NC} Logs"
  echo ""
  echo -e "  ${DIM}── ${B}Web${NC} ${DIM}──────────────────────────────${NC}"
  echo -e "  ${BOLD}[8]${NC} Start   ${BOLD}[9]${NC} Stop   ${BOLD}[10]${NC} Restart  ${BOLD}[11]${NC} Logs"
  echo ""
  echo -e "  ${DIM}── ${Y}Mobile${NC} ${DIM}───────────────────────────${NC}"
  echo -e "  ${BOLD}[12]${NC} Start  ${BOLD}[13]${NC} Stop  ${BOLD}[14]${NC} Restart  ${BOLD}[15]${NC} Logs"
  hr
  echo -e "  ${BOLD}[16]${NC} Refresh status   ${R}${BOLD}[0]${NC} Quit all & exit"
  hr
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${BOLD}Shutting down all services...${NC}"
  stop_all
  echo -e "${G}Bye!${NC}"
  exit 0
}
trap cleanup INT TERM

# ── Boot ──────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}Starting backend…${NC}"
start_backend
show_menu

# ── Main loop ─────────────────────────────────────────────────────────────────
while true; do
  echo -ne "\n${BOLD}Choose [0-16]:${NC} "
  read -r choice

  case "$choice" in
    1)  start_all ;;
    2)  stop_all ;;
    3)  restart_all ;;

    4)  start_backend ;;
    5)  stop_backend ;;
    6)  stop_backend; start_backend ;;
    7)  show_logs "$LOG_DIR/backend.log" "${C}[backend]${NC}" ;;

    8)  start_web ;;
    9)  stop_web ;;
    10) stop_web; start_web ;;
    11) show_logs "$LOG_DIR/web.log" "${B}[web]${NC}" ;;

    12) start_mobile ;;
    13) stop_mobile ;;
    14) stop_mobile; start_mobile ;;
    15) show_logs "$LOG_DIR/mobile.log" "${Y}[mobile]${NC}" ;;

    16) show_menu ;;
    0)  cleanup ;;

    "") ;;
    *)  echo -e "${DIM}Invalid choice. Enter a number 0–16.${NC}" ;;
  esac
done
