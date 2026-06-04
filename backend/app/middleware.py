"""Custom ASGI middleware: request body-size limiting.

Rejects oversized request bodies *before* FastAPI parses them, so a malicious
or buggy client can't exhaust server memory with a giant JSON payload. JSON
routes get a small cap; multipart (file upload) routes get a larger cap since
legitimate uploads are bigger (per-file validation still happens in
``file_validation.py``). Both caps are env-configurable.
"""

import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Defaults: 2 MB for JSON/other, 25 MB for multipart uploads.
_JSON_MAX = int(os.getenv("MAX_JSON_BODY_BYTES", str(2 * 1024 * 1024)))
_UPLOAD_MAX = int(os.getenv("MAX_UPLOAD_BODY_BYTES", str(25 * 1024 * 1024)))


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds the per-type cap (HTTP 413)."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
            except ValueError:
                return JSONResponse({"detail": "Invalid Content-Length"}, status_code=400)

            content_type = (request.headers.get("content-type") or "").lower()
            limit = _UPLOAD_MAX if "multipart/form-data" in content_type else _JSON_MAX
            if size > limit:
                return JSONResponse(
                    {"detail": f"Payload too large (max {limit // (1024 * 1024)} MB)."},
                    status_code=413,
                )
        return await call_next(request)
