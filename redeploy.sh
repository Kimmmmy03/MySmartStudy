#!/usr/bin/env bash
# Redeploy MySmartStudy Cloud Run services.
#
# Usage:
#   ./redeploy.sh              # deploy both backend and web (parallel, live status)
#   ./redeploy.sh backend      # deploy only the backend (mysmartstudy-api)
#   ./redeploy.sh web          # deploy only the web frontend (mysmartstudy-web)
#   ./redeploy.sh both         # explicit form of the default
#
# Requires gcloud CLI authenticated against project mysmartstudy-71f7c.

set -euo pipefail

PROJECT="mysmartstudy-71f7c"
REGION="asia-southeast1"
BACKEND_SERVICE="mysmartstudy-api"
WEB_SERVICE="mysmartstudy-web"

# Add Windows gcloud SDK path if gcloud isn't already on PATH (per REDEPLOY.md).
if ! command -v gcloud >/dev/null 2>&1; then
    export PATH="$PATH:/c/Users/ASUS/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
fi

if ! command -v gcloud >/dev/null 2>&1; then
    echo "ERROR: gcloud CLI not found on PATH" >&2
    exit 1
fi

# Resolve repo root so the script works from any directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Make sure we're targeting the right project before deploying anything.
gcloud config set project "$PROJECT" >/dev/null

# fmt_elapsed <start_seconds> -> "Mm SSs"
fmt_elapsed() {
    local start=$1
    local now diff mins secs
    now=$(date +%s)
    diff=$(( now - start ))
    mins=$(( diff / 60 ))
    secs=$(( diff % 60 ))
    printf '%dm %02ds' "$mins" "$secs"
}

# Print bytes between two byte offsets of a file, prefixed with [prefix].
# Args: <prefix> <log_file> <from_byte_offset> <to_byte_offset>
# Returns: nothing useful via stdout (the prefixed lines go straight to terminal).
print_chunk() {
    local prefix="$1"
    local log="$2"
    local from="$3"
    local to="$4"
    local len=$(( to - from ))
    [ "$len" -le 0 ] && return 0
    # Read the new bytes, prefix non-empty lines, suppress trailing blank.
    dd if="$log" bs=1 skip="$from" count="$len" 2>/dev/null \
        | sed -e "s/^/[${prefix}] /" -e '/^\['"${prefix}"'\] $/d'
}

# Get current size of a file in bytes (portable enough for Git Bash + Linux).
file_size() {
    wc -c < "$1" 2>/dev/null | tr -d ' \t\n\r' || echo 0
}

deploy_backend() {
    echo "==> Deploying backend ($BACKEND_SERVICE) from backend/..."
    gcloud run deploy "$BACKEND_SERVICE" \
        --source backend/ \
        --region "$REGION" \
        --quiet
}

deploy_web() {
    echo "==> Deploying web ($WEB_SERVICE) from frontend-web/..."
    gcloud run deploy "$WEB_SERVICE" \
        --source frontend-web/ \
        --region "$REGION" \
        --quiet
}

# Foreground polling loop: tracks each log's byte offset, prints new content
# with [prefix] tags, and emits a heartbeat every 30s when nothing new lands.
# This avoids the orphan-process problem of background `tail -f | sed` pipes.
run_parallel() {
    local backend_log="/tmp/redeploy-backend.log"
    local web_log="/tmp/redeploy-web.log"
    : > "$backend_log"
    : > "$web_log"

    local start_be start_we
    start_be=$(date +%s)
    start_we=$(date +%s)

    deploy_backend > "$backend_log" 2>&1 &
    local backend_pid=$!
    deploy_web > "$web_log" 2>&1 &
    local web_pid=$!

    echo "------------------------------------------------------------"
    echo "Backend ($BACKEND_SERVICE)  PID $backend_pid  log: $backend_log"
    echo "Web     ($WEB_SERVICE)      PID $web_pid  log: $web_log"
    echo "Streaming progress (Ctrl-C aborts streaming; deploys keep running)."
    echo "------------------------------------------------------------"

    local be_offset=0 we_offset=0
    local be_quiet_since be_running=1
    local we_quiet_since we_running=1
    be_quiet_since=$(date +%s)
    we_quiet_since=$(date +%s)
    local heartbeat_secs=30

    while [ "$be_running" -eq 1 ] || [ "$we_running" -eq 1 ]; do
        # Stop loop conditions per service.
        if [ "$be_running" -eq 1 ] && ! kill -0 "$backend_pid" 2>/dev/null; then
            be_running=0
        fi
        if [ "$we_running" -eq 1 ] && ! kill -0 "$web_pid" 2>/dev/null; then
            we_running=0
        fi

        # Stream any new bytes per log.
        local new_size now
        now=$(date +%s)
        new_size=$(file_size "$backend_log")
        if [ "$new_size" -gt "$be_offset" ]; then
            print_chunk "backend" "$backend_log" "$be_offset" "$new_size"
            be_offset=$new_size
            be_quiet_since=$now
        elif [ "$be_running" -eq 1 ] && [ $(( now - be_quiet_since )) -ge "$heartbeat_secs" ]; then
            echo "[backend] ... still deploying ($(fmt_elapsed "$start_be") elapsed)"
            be_quiet_since=$now
        fi

        new_size=$(file_size "$web_log")
        if [ "$new_size" -gt "$we_offset" ]; then
            print_chunk "web    " "$web_log" "$we_offset" "$new_size"
            we_offset=$new_size
            we_quiet_since=$now
        elif [ "$we_running" -eq 1 ] && [ $(( now - we_quiet_since )) -ge "$heartbeat_secs" ]; then
            echo "[web    ] ... still deploying ($(fmt_elapsed "$start_we") elapsed)"
            we_quiet_since=$now
        fi

        sleep 1
    done

    # Final flush — capture anything written between last poll and process exit.
    local be_final we_final
    be_final=$(file_size "$backend_log")
    we_final=$(file_size "$web_log")
    [ "$be_final" -gt "$be_offset" ] && print_chunk "backend" "$backend_log" "$be_offset" "$be_final"
    [ "$we_final" -gt "$we_offset" ] && print_chunk "web    " "$web_log" "$we_offset" "$we_final"

    # Reap exit codes.
    set +e
    wait "$backend_pid"; local backend_status=$?
    wait "$web_pid";     local web_status=$?
    set -e

    echo
    echo "============================================================"
    if [ "$backend_status" -eq 0 ]; then
        echo "  backend: OK   ($(fmt_elapsed "$start_be"))"
    else
        echo "  backend: FAIL exit=$backend_status   ($(fmt_elapsed "$start_be"))"
    fi
    if [ "$web_status" -eq 0 ]; then
        echo "  web:     OK   ($(fmt_elapsed "$start_we"))"
    else
        echo "  web:     FAIL exit=$web_status   ($(fmt_elapsed "$start_we"))"
    fi
    echo "============================================================"
    grep -E '^Service URL:' "$backend_log" 2>/dev/null | sed 's/^/  backend  → /' || true
    grep -E '^Service URL:' "$web_log"     2>/dev/null | sed 's/^/  web      → /' || true

    if [ "$backend_status" -ne 0 ] || [ "$web_status" -ne 0 ]; then
        echo
        echo "Tail of failing logs:"
        if [ "$backend_status" -ne 0 ]; then
            echo "---- $backend_log ----"
            tail -n 30 "$backend_log"
        fi
        if [ "$web_status" -ne 0 ]; then
            echo "---- $web_log ----"
            tail -n 30 "$web_log"
        fi
        exit 1
    fi
}

target="${1:-both}"

case "$target" in
    backend|api)
        # Single-target: gcloud already streams to stdout — just time it.
        start=$(date +%s)
        deploy_backend
        echo "Backend deploy finished in $(fmt_elapsed "$start")."
        ;;
    web|frontend)
        start=$(date +%s)
        deploy_web
        echo "Web deploy finished in $(fmt_elapsed "$start")."
        ;;
    both|all|"")
        run_parallel
        ;;
    *)
        echo "Usage: $0 [backend|web|both]" >&2
        exit 2
        ;;
esac

echo "Done."
