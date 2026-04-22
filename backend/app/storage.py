"""Unified file storage.

Writes to Google Cloud Storage when the ``GCS_BUCKET`` env var is set
(production on Cloud Run), and to the local ``uploads/`` folder otherwise
(local dev). Callers get back a URL they can store in Firestore and serve
to the frontend directly.
"""
from __future__ import annotations

import os

_GCS_BUCKET = os.getenv("GCS_BUCKET", "").strip()
_bucket = None

if _GCS_BUCKET:
    from google.cloud import storage as _gcs_storage

    _client = _gcs_storage.Client()
    _bucket = _client.bucket(_GCS_BUCKET)


def save_upload(
    data: bytes,
    subdir: str,
    filename: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Persist ``data`` under ``subdir/filename`` and return its URL."""
    if _bucket is not None:
        blob_path = f"{subdir}/{filename}"
        blob = _bucket.blob(blob_path)
        blob.upload_from_string(data, content_type=content_type)
        return f"https://storage.googleapis.com/{_GCS_BUCKET}/{blob_path}"

    local_dir = os.path.join("uploads", subdir)
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)
    with open(local_path, "wb") as f:
        f.write(data)
    return f"/uploads/{subdir}/{filename}"
