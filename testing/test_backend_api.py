"""
Backend API smoke test for MySmartStudy.

- Mints real Firebase ID tokens for a student / lecturer / admin test account.
- Reads the live OpenAPI spec, then exercises every parameter-free GET endpoint
  with the appropriate role, plus a curated set of path-parameter endpoints
  (IDs discovered at runtime) and a few safe POST endpoints.
- Writes structured results to results/backend_results.json for the report.

Run from the testing/ directory with the backend venv active:
    python test_backend_api.py
"""

import json
import time
import datetime
import requests

BACKEND = "http://127.0.0.1:8000"
FIREBASE_WEB_KEY = "AIzaSyAPlGp3a1mo5A-XHTF1wqwuq9rNkYevYMc"
PASSWORD = "Test1234!"
ACCOUNTS = {
    "student": "student1@mysmartstudy.com",
    "lecturer": "lecturer1@mysmartstudy.com",
    "admin": "admin@mysmartstudy.com",
}

results = []          # one dict per test
tokens = {}


def log(role, method, path, status, ok, note=""):
    results.append({
        "role": role, "method": method, "path": path,
        "status": status, "ok": ok, "note": note,
    })
    mark = "PASS" if ok else ("WARN" if note else "FAIL")
    print(f"  [{mark}] {method:4} {path}  ->  {status}  {note}")


def mint_tokens():
    print("== Minting Firebase ID tokens ==")
    url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
        f"?key={FIREBASE_WEB_KEY}"
    )
    for role, email in ACCOUNTS.items():
        try:
            r = requests.post(url, json={
                "email": email, "password": PASSWORD, "returnSecureToken": True,
            }, timeout=30)
            if r.status_code == 200:
                tokens[role] = r.json()["idToken"]
                print(f"  [PASS] token minted for {role} ({email})")
            else:
                print(f"  [FAIL] token mint for {role}: {r.status_code} {r.text[:120]}")
        except Exception as e:
            print(f"  [FAIL] token mint for {role}: {e}")


def headers(role):
    if role and role in tokens:
        return {"Authorization": f"Bearer {tokens[role]}"}
    return {}


def call(role, method, path, body=None, expect_ok=(200, 201)):
    url = BACKEND + path
    try:
        r = requests.request(method, url, headers=headers(role), json=body, timeout=60)
        ok = r.status_code in expect_ok
        note = ""
        if not ok:
            if r.status_code in (401, 403):
                note = "auth/permission"
            elif r.status_code == 404:
                note = "not found"
            elif r.status_code == 422:
                note = "needs params"
            elif r.status_code >= 500:
                note = "SERVER ERROR"
        log(role, method, path, r.status_code, ok, note)
        return r
    except Exception as e:
        log(role, method, path, 0, False, f"exception: {e}")
        return None


def role_for_path(path):
    """Pick which role should own a parameter-free GET endpoint."""
    p = path.lower()
    if p.startswith("/api/admin") or "audit" in p:
        return "admin"
    if any(k in p for k in ("teaching", "analytics", "review-maps", "gradebook/course")):
        return "lecturer"
    if p in ("/", "/api/homepage/content", "/api/homepage/stats"):
        return None  # public
    return "student"


def main():
    started = datetime.datetime.now()
    mint_tokens()
    spec = json.load(open("results/openapi.json", encoding="utf-8"))
    paths = spec.get("paths", {})

    # ---- Phase 1: every parameter-free GET endpoint ----
    print("\n== Phase 1: parameter-free GET endpoints ==")
    param_free_gets = []
    path_param_gets = []
    for path, methods in sorted(paths.items()):
        if "get" not in methods:
            continue
        if "{" in path:
            path_param_gets.append(path)
        else:
            param_free_gets.append(path)

    for path in param_free_gets:
        role = role_for_path(path)
        # public endpoints expect 200; authed ones too
        call(role, "GET", path)
        time.sleep(0.05)

    # ---- Phase 2: discover real IDs for path-param endpoints ----
    print("\n== Phase 2: discovering resource IDs ==")
    discovered = {}
    r = call("student", "GET", "/api/courses/enrolled")
    if r is not None and r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and data:
            discovered["course_id"] = data[0].get("id")
            print(f"  discovered course_id = {discovered['course_id']}")
    r = call("student", "GET", "/api/maps/")
    if r is not None and r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and data:
            discovered["map_id"] = data[0].get("id")
            print(f"  discovered map_id = {discovered['map_id']}")

    # ---- Phase 3: a sample of path-parameter GET endpoints ----
    print("\n== Phase 3: path-parameter GET endpoints (sampled) ==")
    substitutions = {
        "{course_id}": discovered.get("course_id"),
        "{cid}": discovered.get("course_id"),
        "{map_id}": discovered.get("map_id"),
        "{mapId}": discovered.get("map_id"),
        "{id}": discovered.get("map_id"),
    }
    tested_pp = 0
    for path in path_param_gets:
        if tested_pp >= 25:
            break
        resolved = path
        skip = False
        for ph, val in substitutions.items():
            if ph in resolved:
                if not val:
                    skip = True
                    break
                resolved = resolved.replace(ph, str(val))
        if skip or "{" in resolved:
            continue  # unresolved param — cannot test in a smoke run
        role = role_for_path(path)
        call(role, "GET", resolved)
        tested_pp += 1
        time.sleep(0.05)

    # ---- Phase 4: a few safe POST endpoints ----
    print("\n== Phase 4: selected POST endpoints ==")
    # reminder create + delete round-trip (safe, student-owned)
    r = call("student", "POST", "/api/reminders/", body={
        "date": datetime.date.today().isoformat(),
        "title": "Smoke-test reminder", "type": "task", "priority": "low",
    })
    if r is not None and r.status_code in (200, 201):
        try:
            rid = r.json().get("id")
            if rid:
                call("student", "DELETE", f"/api/reminders/{rid}", expect_ok=(200, 204))
        except Exception:
            pass

    # ---- Summary ----
    elapsed = (datetime.datetime.now() - started).total_seconds()
    total = len(results)
    passed = sum(1 for x in results if x["ok"])
    server_errors = [x for x in results if x["status"] >= 500]
    summary = {
        "started": started.isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "server_errors": len(server_errors),
        "total_routes_in_spec": len(paths),
        "results": results,
    }
    json.dump(summary, open("results/backend_results.json", "w", encoding="utf-8"), indent=2)
    print(f"\n== DONE ==  {passed}/{total} passed, "
          f"{len(server_errors)} server errors, {elapsed:.1f}s")
    print("results -> results/backend_results.json")


if __name__ == "__main__":
    main()
