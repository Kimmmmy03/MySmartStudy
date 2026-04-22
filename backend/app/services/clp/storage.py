"""
CLP — Storage Service

Uses MySmartStudy's Firestore via get_db() dependency pattern.
L1 in-memory cache for session files (large binary data).
L2 Firestore for draft persistence and dedup.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from app import models
from app.schemas import CLPSessionDraft, CLPUploadMetadata, CLPWeekData, CLPGroupAttendance


# ---------------------------------------------------------------------------
# In-memory caches (L1) — for large binary data and hot session state
# ---------------------------------------------------------------------------
_input_files: dict[str, bytes] = {}
_file_hashes: dict[str, str] = {}  # content_hash → session_id


# ---------------------------------------------------------------------------
# Server timestamp helper
# ---------------------------------------------------------------------------
def _server_timestamp():
    try:
        from firebase_admin import firestore
        return firestore.SERVER_TIMESTAMP
    except Exception:
        return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# File hash & dedup
# ---------------------------------------------------------------------------
def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def find_duplicate(db, file_hash: str) -> Optional[str]:
    """Check for duplicate: L1 memory first, then L2 Firestore."""
    result = _file_hashes.get(file_hash)
    if result:
        return result
    try:
        doc = db.collection(models.CLP_FILE_HASHES).document(file_hash[:20]).get()
        if doc.exists:
            data = doc.to_dict()
            if data.get("hash") == file_hash:
                sid = data.get("session_id")
                _file_hashes[file_hash] = sid
                return sid
    except Exception as e:
        print(f"[CLP Storage] Find duplicate failed: {e}")
    return None


def register_file_hash(db, file_hash: str, session_id: str) -> None:
    _file_hashes[file_hash] = session_id
    try:
        db.collection(models.CLP_FILE_HASHES).document(file_hash[:20]).set({
            "hash": file_hash,
            "session_id": session_id,
            "created_at": _server_timestamp(),
        })
    except Exception as e:
        print(f"[CLP Storage] Register hash failed: {e}")


# ---------------------------------------------------------------------------
# Layout fingerprint & extraction patterns
# ---------------------------------------------------------------------------
def compute_layout_fingerprint(filename: str, header_row: int | None,
                                col_count: int, row_count: int) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    raw = f"{ext}|hr={header_row}|cols={col_count}|rows={row_count}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def save_extraction_pattern(db, fingerprint: str, pattern_data: dict) -> None:
    try:
        pattern_data["updated_at"] = _server_timestamp()
        db.collection(models.CLP_EXTRACTION_RESULTS).document(fingerprint).set(
            pattern_data, merge=True
        )
    except Exception as e:
        print(f"[CLP Storage] Save extraction pattern failed: {e}")


# ---------------------------------------------------------------------------
# Failed uploads
# ---------------------------------------------------------------------------
def store_failed_upload(db, file_bytes: bytes, filename: str, error_msg: str,
                        user_id: str = "") -> bool:
    try:
        fail_id = str(uuid.uuid4())[:8]
        db.collection(models.CLP_FAILED_UPLOADS).document(fail_id).set({
            "filename": filename,
            "error": str(error_msg)[:500],
            "user_id": user_id,
            "file_size": len(file_bytes),
            "created_at": _server_timestamp(),
        })
        return True
    except Exception as e:
        print(f"[CLP Storage] Store failed upload error: {e}")
        return False


# ---------------------------------------------------------------------------
# Draft CRUD (L2 Firestore)
# ---------------------------------------------------------------------------
def save_draft(db, session_id: str, draft: CLPSessionDraft) -> None:
    try:
        data = draft.model_dump()
        data["updated_at"] = _server_timestamp()
        if not data.get("created_at"):
            data["created_at"] = _server_timestamp()
        db.collection(models.CLP_DRAFTS).document(session_id).set(data)
    except Exception as e:
        print(f"[CLP Storage] Save draft failed for {session_id}: {e}")


def get_draft(db, session_id: str) -> Optional[CLPSessionDraft]:
    try:
        doc = db.collection(models.CLP_DRAFTS).document(session_id).get()
        if doc.exists:
            data = doc.to_dict()
            # Convert Firestore timestamps to datetime
            for ts_field in ("created_at", "updated_at"):
                val = data.get(ts_field)
                if val and hasattr(val, "isoformat"):
                    pass  # already datetime-like
                elif isinstance(val, str):
                    try:
                        data[ts_field] = datetime.fromisoformat(val)
                    except (ValueError, TypeError):
                        data[ts_field] = None
            return CLPSessionDraft(**data)
    except Exception as e:
        print(f"[CLP Storage] Get draft failed for {session_id}: {e}")
    return None


def get_drafts_by_owner(db, owner_id: str) -> list[dict]:
    """List all drafts for a given lecturer, returning lightweight summaries."""
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        docs = (
            db.collection(models.CLP_DRAFTS)
            .where(filter=FieldFilter("owner_id", "==", owner_id))
            .get()
        )
        results = []
        for doc in docs:
            d = doc.to_dict()
            meta = d.get("metadata", {})
            results.append({
                "session_id": d.get("session_id", doc.id),
                "nama_kursus": meta.get("nama_kursus", ""),
                "kod_kursus": meta.get("kod_kursus", ""),
                "week_count": len(d.get("weeks", [])),
                "created_at": d.get("created_at"),
                "updated_at": d.get("updated_at"),
            })
        results.sort(key=lambda x: str(x.get("updated_at", "")), reverse=True)
        return results
    except Exception as e:
        print(f"[CLP Storage] Get drafts by owner failed: {e}")
        return []


def delete_draft(db, session_id: str) -> None:
    try:
        db.collection(models.CLP_DRAFTS).document(session_id).delete()
        _input_files.pop(session_id, None)
    except Exception as e:
        print(f"[CLP Storage] Delete draft failed for {session_id}: {e}")


# ---------------------------------------------------------------------------
# Input file storage (L1 in-memory only — large binary data)
# ---------------------------------------------------------------------------
def save_input_file(session_id: str, file_bytes: bytes) -> None:
    _input_files[session_id] = file_bytes


def get_input_file(session_id: str) -> bytes | None:
    return _input_files.get(session_id)
