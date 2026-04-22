"""Magic number validation for file uploads."""

# Magic number signatures for allowed file types
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpeg": [b"\xff\xd8\xff"],
    "docx": [b"PK\x03\x04"],  # ZIP-based (also matches pptx, xlsx)
    "pptx": [b"PK\x03\x04"],
}

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".pptx"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def validate_file(content: bytes, filename: str) -> tuple[bool, str]:
    """Validate file by magic number and extension.
    Returns (is_valid, error_message).
    """
    import os
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '{ext}' is not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"

    if len(content) > MAX_FILE_SIZE:
        return False, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"

    if len(content) < 4:
        return False, "File is too small to be valid"

    # Map extension to magic signature key
    ext_to_key = {
        ".pdf": "pdf",
        ".png": "png",
        ".jpg": "jpeg",
        ".jpeg": "jpeg",
        ".docx": "docx",
        ".pptx": "pptx",
    }

    key = ext_to_key.get(ext)
    if key and key in MAGIC_SIGNATURES:
        if not any(content.startswith(sig) for sig in MAGIC_SIGNATURES[key]):
            return False, f"File content does not match '{ext}' format (invalid magic number)"

    return True, ""
