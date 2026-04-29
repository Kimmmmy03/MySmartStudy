#!/usr/bin/env bash
# Redeploy MySmartStudy Cloud Run services.
#
# Usage:
#   ./redeploy.sh              # deploy both backend and web (parallel)
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

target="${1:-both}"

case "$target" in
    backend|api)
        deploy_backend
        ;;
    web|frontend)
        deploy_web
        ;;
    both|all|"")
        # Run in parallel; surface either failure via wait + set -e.
        deploy_backend > /tmp/redeploy-backend.log 2>&1 &
        backend_pid=$!
        deploy_web > /tmp/redeploy-web.log 2>&1 &
        web_pid=$!

        echo "Backend PID $backend_pid (log: /tmp/redeploy-backend.log)"
        echo "Web     PID $web_pid (log: /tmp/redeploy-web.log)"
        echo "Waiting for both deploys to finish..."

        backend_status=0
        web_status=0
        wait "$backend_pid" || backend_status=$?
        wait "$web_pid"     || web_status=$?

        echo
        echo "==== Backend deploy log ===="
        tail -n 20 /tmp/redeploy-backend.log
        echo
        echo "==== Web deploy log ===="
        tail -n 20 /tmp/redeploy-web.log
        echo

        if [ "$backend_status" -ne 0 ] || [ "$web_status" -ne 0 ]; then
            echo "ERROR: backend exit=$backend_status, web exit=$web_status" >&2
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [backend|web|both]" >&2
        exit 2
        ;;
esac

echo "Done."
