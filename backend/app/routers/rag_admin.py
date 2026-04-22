"""RAG admin endpoints for manual indexing triggers and status."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from app.auth import require_lecturer
from app import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/rag", tags=["RAG Admin"])


@router.post("/index-course/{course_id}")
async def trigger_index(course_id: str, user=Depends(require_lecturer)):
    """Manually trigger re-indexing for a course's content into the vector store."""
    try:
        await rag_service.index_course_content(course_id)
        status = rag_service.get_index_status(course_id)
        return {"ok": True, "course_id": course_id, "status": status}
    except Exception as e:
        logger.exception("Indexing failed for course %s", course_id)
        raise HTTPException(500, f"Indexing failed: {str(e)}")


@router.get("/index-status/{course_id}")
async def index_status(course_id: str, user=Depends(require_lecturer)):
    """Get indexing statistics for a course."""
    return rag_service.get_index_status(course_id)
