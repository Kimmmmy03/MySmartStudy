"""
Frontend smoke test for MySmartStudy, driven through the agent-browser CLI.

For each role it logs in via the real UI, then visits every top-level page,
captures the resolved pathname + an accessibility snapshot + a screenshot,
and classifies the outcome (PASS / REDIRECT / ERROR / EMPTY).

Results -> results/frontend_results.json  ·  screenshots -> screenshots/

Prereqs: local frontend on :3000, local backend on :8000, agent-browser
installed with Chrome (`agent-browser install`).
"""

import json
import re
import subprocess
import time
import datetime

BASE = "http://localhost:3000"
PASSWORD = "Test1234!"

ACCOUNTS = {
    "student": "student1@mysmartstudy.com",
    "lecturer": "lecturer1@mysmartstudy.com",
    "admin": "admin@mysmartstudy.com",
}

PAGES = {
    "student": [
        "dashboard", "my-maps", "create-map", "courses", "grades", "gradebook",
        "planner", "calendar", "messages", "achievements", "activity",
        "notifications", "study-materials", "study-guide", "exam-planner",
        "explore", "feed", "certificates", "attendance", "profile",
    ],
    "lecturer": [
        "dashboard", "class-management", "review-maps", "analytics",
        "manage-badges", "messages", "notifications", "planner",
        "learning-plan", "profile",
    ],
    "admin": [
        "dashboard", "users", "ai-settings", "ai-usage", "usage-analytics",
        "audit-logs", "announcements", "email-settings", "homepage-editor",
        "manage-badges",
    ],
}

ERROR_MARKERS = (
    "application error", "unhandled runtime error", "this page could not be found",
    "404", "500", "internal server error", "something went wrong",
)

results = []


def ab(*args, timeout=60):
    """Run an agent-browser command, return stdout (stderr folded in).

    Uses shell=True so the Windows npm shim (agent-browser.cmd) resolves;
    list2cmdline handles quoting of args that contain spaces/JS.
    """
    cmd = subprocess.list2cmdline(["agent-browser", *[str(a) for a in args]])
    try:
        p = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, shell=True,
        )
        return (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return "__TIMEOUT__"
    except Exception as e:  # noqa: BLE001
        return f"__ERROR__ {e}"


def pathname():
    out = ab("eval", "location.pathname", timeout=30)
    return out.strip().strip('"').strip()


def login(role, email):
    print(f"\n== Login as {role} ({email}) ==", flush=True)
    # Sign out via the app's /logout route — this runs the real Firebase
    # signOut(), which correctly closes and clears its own IndexedDB session
    # (an active session keeps IndexedDB connections open, so a manual
    # deleteDatabase would just block).
    ab("open", f"{BASE}/logout", timeout=60)
    time.sleep(6)
    # load a CLEAN /login (no ?redirect= param) and poll for the form;
    # re-open /login each miss in case sign-out was still settling.
    ab("open", f"{BASE}/login", timeout=60)
    textboxes, submit, snap = [], None, ""
    for _ in range(7):
        time.sleep(2)
        snap = ab("snapshot", timeout=25)
        textboxes = re.findall(r'textbox "[^"]*"\s*\[[^\]]*ref=(e\d+)', snap)
        submit = re.search(r'button "Sign In"\s*\[[^\]]*ref=(e\d+)', snap)
        if len(textboxes) >= 2 and submit:
            break
        ab("open", f"{BASE}/login", timeout=60)
    if len(textboxes) < 2 or not submit:
        print(f"  [FAIL] login form not found for {role} "
              f"(snapshot len={len(snap)}, textboxes={textboxes})", flush=True)
        return False
    ab("fill", f"@{textboxes[0]}", email, timeout=30)
    ab("fill", f"@{textboxes[1]}", PASSWORD, timeout=30)
    ab("click", f"@{submit.group(1)}", timeout=30)
    time.sleep(7)
    path = pathname()
    ok = path.startswith(f"/{role}")
    print(f"  {'[PASS]' if ok else '[FAIL]'} landed on {path}")
    return ok


def visit(role, page):
    url = f"{BASE}/{role}/{page}"
    ab("open", url, timeout=60)
    time.sleep(5)  # client components fetch data after mount
    path = pathname()
    snap = ab("snapshot", timeout=45)
    shot = f"screenshots/{role}_{page}.png"
    ab("screenshot", shot, timeout=45)

    snap_low = snap.lower()
    elements = snap.count("ref=e")

    if path.startswith("/login"):
        status, note = "REDIRECT", "bounced to /login (auth guard)"
    elif "__timeout__" in snap_low:
        status, note = "ERROR", "snapshot timed out"
    elif any(m in snap_low for m in ERROR_MARKERS):
        status, note = "ERROR", "error marker in page"
    elif elements < 8:
        status, note = "EMPTY", f"only {elements} elements rendered"
    else:
        status, note = "PASS", f"{elements} elements rendered"

    ok = status == "PASS"
    mark = {"PASS": "PASS", "REDIRECT": "WARN", "EMPTY": "WARN", "ERROR": "FAIL"}[status]
    print(f"  [{mark}] /{role}/{page}  ->  {path}  ({note})")
    results.append({
        "role": role, "page": page, "url": url, "final_path": path,
        "status": status, "ok": ok, "note": note, "screenshot": shot,
    })


def main():
    started = datetime.datetime.now()
    for role, email in ACCOUNTS.items():
        if not login(role, email):
            # record every page for this role as blocked
            for page in PAGES[role]:
                results.append({
                    "role": role, "page": page, "url": f"{BASE}/{role}/{page}",
                    "final_path": "", "status": "BLOCKED", "ok": False,
                    "note": "login failed", "screenshot": "",
                })
            continue
        for page in PAGES[role]:
            visit(role, page)

    ab("close", timeout=30)

    elapsed = (datetime.datetime.now() - started).total_seconds()
    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    summary = {
        "started": started.isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "results": results,
    }
    json.dump(summary, open("results/frontend_results.json", "w", encoding="utf-8"), indent=2)
    print(f"\n== DONE ==  {passed}/{total} pages OK, {elapsed:.0f}s")
    print("results -> results/frontend_results.json")


if __name__ == "__main__":
    main()
