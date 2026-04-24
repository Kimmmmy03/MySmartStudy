"""Phase 1 followers migration — idempotent backfill.

Adds social-graph defaults to existing users and maps so the new endpoints
don't trip on missing fields. Safe to re-run; it only writes fields that
aren't already present.

Run from the backend/ directory:
    python -m scripts.migrate_social_fields              # dry run, no writes
    python -m scripts.migrate_social_fields --apply      # actually write

Or via gcloud CLI once deployed:
    gcloud run services proxy mysmartstudy-api ...
    (not needed — this script runs offline via service account)
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

# Reuse the app's Firestore bootstrap so we pick up the same service account /
# emulator config.
from app.firestore import db
from app import models


def _needs(d: dict, key: str) -> bool:
    return d.get(key) is None or (isinstance(d.get(key), str) and d.get(key) == "" and key in {"bio", "coverPhotoURL"})


def _prefs_defaults() -> dict:
    return {
        "newFollower": True,
        "mapLike": True,
        "mapComment": True,
        "followedUserPosts": False,
    }


def migrate_users(apply: bool) -> tuple[int, int]:
    updated = 0
    scanned = 0
    for doc in db.collection(models.USERS).stream():
        scanned += 1
        data: dict[str, Any] = doc.to_dict() or {}
        patch: dict[str, Any] = {}

        if data.get("bio") is None:
            patch["bio"] = ""
        if data.get("coverPhotoURL") is None:
            patch["coverPhotoURL"] = ""
        if data.get("followerCount") is None:
            patch["followerCount"] = 0
        if data.get("followingCount") is None:
            patch["followingCount"] = 0
        # Only set the whole prefs object if missing; don't stomp custom prefs.
        if not isinstance(data.get("notificationPrefs"), dict):
            patch["notificationPrefs"] = _prefs_defaults()

        if not patch:
            continue
        updated += 1
        print(f"[user]   {doc.id:36s}  +{', '.join(sorted(patch.keys()))}")
        if apply:
            db.collection(models.USERS).document(doc.id).set(patch, merge=True)
    return scanned, updated


def migrate_maps(apply: bool) -> tuple[int, int]:
    updated = 0
    scanned = 0
    for doc in db.collection(models.MAPS).stream():
        scanned += 1
        data: dict[str, Any] = doc.to_dict() or {}
        patch: dict[str, Any] = {}

        if data.get("visibility") is None:
            patch["visibility"] = "private"   # existing maps stay private
        if data.get("likeCount") is None:
            patch["likeCount"] = 0
        if data.get("commentCount") is None:
            patch["commentCount"] = 0
        # publishedAt only makes sense for public maps; leave null for private.

        if not patch:
            continue
        updated += 1
        print(f"[map]    {doc.id:36s}  +{', '.join(sorted(patch.keys()))}")
        if apply:
            db.collection(models.MAPS).document(doc.id).set(patch, merge=True)
    return scanned, updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill Phase 1 social fields.")
    parser.add_argument("--apply", action="store_true", help="Actually write changes. Default is dry-run.")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== Phase 1 social migration ({mode}) ===\n")

    u_scanned, u_updated = migrate_users(args.apply)
    print(f"\nusers:  scanned {u_scanned}, updated {u_updated}")

    m_scanned, m_updated = migrate_maps(args.apply)
    print(f"maps:   scanned {m_scanned}, updated {m_updated}")

    if not args.apply:
        print("\n(dry run — re-run with --apply to write changes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
