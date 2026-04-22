"""AI-powered study material generation from course resources."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import os
import hashlib
from app.firestore import db
from app.auth import get_current_user
from app import models
from app.ai_service import generate_json, generate_text, get_knowledge_base, FAST_MODEL, set_tracking_context
from app import rag_service
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/ai/study-materials", tags=["AI Study Materials"])


class GenerateRequest(BaseModel):
    resource_id: str
    course_id: str
    type: str  # "summary", "flashcards", "quiz"


class TopicGenerateRequest(BaseModel):
    topic: str
    course_id: str
    type: str  # "summary", "flashcards", "quiz"


def _material_out(d: dict) -> dict:
    return {
        "id": d.get("id"),
        "resource_id": d.get("resourceId"),
        "course_id": d.get("courseId"),
        "type": d.get("type"),
        "title": d.get("title", ""),
        "content": d.get("content"),
        "created_at": d.get("createdAt"),
    }


def _read_pdf(path: str) -> str:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""


async def _extract_resource_text(item: dict) -> str:
    """Extract text from a resource item (PDF file, Canva link, or URL)."""
    file_path = item.get("filePath")
    if file_path:
        text = _read_pdf(file_path)
        if text.strip():
            return text

    url = item.get("url") or ""
    from app.services.canva_service import is_canva_url, canva_to_pdf
    if is_canva_url(url):
        pdf_path = await canva_to_pdf(url)
        if pdf_path:
            text = _read_pdf(str(pdf_path))
            if text.strip():
                return text

    return (item.get("title", "") + "\n" + url).strip()


def _find_recent_material(user_id: str, resource_id: str, mat_type: str) -> dict | None:
    """Return an existing material for the same (user, resource, type) within 7 days."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        docs = (
            db.collection(models.GENERATED_STUDY_MATERIALS)
            .where(filter=FieldFilter("userId", "==", user_id))
            .where(filter=FieldFilter("resourceId", "==", resource_id))
            .where(filter=FieldFilter("type", "==", mat_type))
            .limit(5)
            .get()
        )
        for doc in docs:
            d = doc.to_dict()
            if d.get("createdAt", "") >= cutoff:
                d["id"] = doc.id
                return d
    except Exception:
        pass
    return None


@router.post("/generate")
async def generate_material(req: GenerateRequest, user=Depends(get_current_user)):
    if req.type not in ("summary", "flashcards", "quiz", "mindmap"):
        raise HTTPException(400, "Type must be summary, flashcards, quiz, or mindmap")

    set_tracking_context(user["id"], "study_materials")

    # ── Dedup: return existing material if generated within last 7 days ────────
    existing = _find_recent_material(user["id"], req.resource_id, req.type)
    if existing:
        out = _material_out(existing)
        out["_cached"] = True
        return out

    # Fetch the resource item
    item_doc = db.collection(models.MODULE_ITEMS).document(req.resource_id).get()
    if not item_doc.exists:
        raise HTTPException(404, "Resource not found")
    item = item_doc.to_dict()

    # Extract text content
    content = await _extract_resource_text(item)
    if not content or len(content.strip()) < 30:
        raise HTTPException(400, "Resource has insufficient text content")

    system = get_knowledge_base("study_materials")
    resource_title = item.get("title", "Untitled Resource")

    if req.type == "summary":
        prompt = f"""Create concise study notes from the following lecture content.
Organise with clear headings, bullet points, and highlight key concepts and definitions.

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return the summary as plain text with markdown formatting."""
        try:
            result_text = await generate_text(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        stored_content = result_text

    elif req.type == "flashcards":
        prompt = f"""Generate flashcards from the following lecture content.
Create 10-15 flashcards covering the most important concepts.

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return JSON array with this structure:
[
  {{"front": "<question or term>", "back": "<answer or definition>"}},
  ...
]"""
        try:
            result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        import json
        stored_content = json.dumps(result)

    elif req.type == "quiz":
        prompt = f"""Generate a practice quiz from the following lecture content.
Create 10 questions of mixed types (multiple choice and true/false).

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return JSON array with this structure:
[
  {{
    "question": "<question text>",
    "type": "mcq" | "true_false",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "<correct option text>",
    "explanation": "<brief explanation>"
  }},
  ...
]"""
        try:
            result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        import json
        stored_content = json.dumps(result)

    elif req.type == "mindmap":
        prompt = f"""Extract a mind map (hierarchical concept tree) from the following lecture content.
Identify one central topic, 3-6 main branches, and 2-4 sub-nodes per branch.

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return JSON with this structure:
{{
  "root": "<central topic>",
  "branches": [
    {{
      "label": "<main branch>",
      "children": ["<sub-node>", "<sub-node>"]
    }}
  ]
}}"""
        try:
            result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        import json
        stored_content = json.dumps(result)

    # Store in Firestore
    mat_id = models.gen_id()
    now = datetime.now(timezone.utc).isoformat()
    mat_data = {
        "userId": user["id"],
        "resourceId": req.resource_id,
        "courseId": req.course_id,
        "type": req.type,
        "title": f"{req.type.capitalize()} — {resource_title}",
        "content": stored_content,
        "createdAt": now,
    }
    db.collection(models.GENERATED_STUDY_MATERIALS).document(mat_id).set(mat_data)
    mat_data["id"] = mat_id

    return _material_out(mat_data)


async def _run_generation(resource_title: str, content: str, mat_type: str, system: str) -> str:
    import json
    if mat_type == "summary":
        prompt = f"""Create concise study notes from the following content.
Organise with clear headings, bullet points, and highlight key concepts and definitions.

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return the summary as plain text with markdown formatting."""
        return await generate_text(prompt, system_instruction=system, model_name=FAST_MODEL)
    if mat_type == "flashcards":
        prompt = f"""Generate flashcards from the following content.
Create 10-15 flashcards covering the most important concepts.

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return JSON array: [{{"front": "...", "back": "..."}}]"""
        result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        return json.dumps(result)
    if mat_type == "quiz":
        prompt = f"""Generate a practice quiz from the following content.
Create 10 questions of mixed types (multiple choice and true/false).

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return JSON array: [{{"question": "...", "type": "mcq"|"true_false", "options": ["..."], "correct_answer": "...", "explanation": "..."}}]"""
        result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        return json.dumps(result)
    if mat_type == "mindmap":
        prompt = f"""Extract a mind map (hierarchical concept tree) from the following content.
Identify one central topic, 3-6 main branches, and 2-4 sub-nodes per branch.

RESOURCE: {resource_title}
CONTENT:
\"\"\"
{content[:10000]}
\"\"\"

Return JSON: {{"root": "...", "branches": [{{"label": "...", "children": ["..."]}}]}}"""
        result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        return json.dumps(result)
    raise HTTPException(400, "Unsupported type")


@router.post("/generate-from-upload")
async def generate_from_upload(
    file: UploadFile = File(...),
    type: str = Form(...),
    title: str = Form(""),
    user=Depends(get_current_user),
):
    """Generate a study material directly from an uploaded PDF — no course/module required."""
    if type not in ("summary", "flashcards", "quiz", "mindmap"):
        raise HTTPException(400, "Type must be summary, flashcards, quiz, or mindmap")

    set_tracking_context(user["id"], "study_materials")

    content_bytes = await file.read()
    if len(content_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF uploads are supported")

    # Persist the upload under the user's folder.
    upload_dir = os.path.join("uploads", "study-materials", user["id"])
    os.makedirs(upload_dir, exist_ok=True)
    digest = hashlib.sha256(content_bytes).hexdigest()[:16]
    safe_path = os.path.join(upload_dir, f"{digest}_{file.filename}")
    if not os.path.exists(safe_path):
        with open(safe_path, "wb") as f:
            f.write(content_bytes)

    # Dedup: re-use any existing material for this file+type within 7 days.
    resource_key = f"upload_{digest}"
    existing = _find_recent_material(user["id"], resource_key, type)
    if existing:
        out = _material_out(existing)
        out["_cached"] = True
        return out

    text = _read_pdf(safe_path)
    if not text.strip() or len(text.strip()) < 30:
        raise HTTPException(400, "Could not extract text from the PDF")

    display_title = title.strip() or (file.filename or "Uploaded PDF").rsplit(".", 1)[0]
    stored_content = await _run_generation(display_title, text, type, get_knowledge_base("study_materials"))

    mat_id = models.gen_id()
    now = datetime.now(timezone.utc).isoformat()
    mat_data = {
        "userId": user["id"],
        "resourceId": resource_key,
        "courseId": "uploaded",
        "type": type,
        "title": f"{type.capitalize()} — {display_title}",
        "content": stored_content,
        "createdAt": now,
        "sourceFile": safe_path.replace(os.sep, "/"),
    }
    db.collection(models.GENERATED_STUDY_MATERIALS).document(mat_id).set(mat_data)
    mat_data["id"] = mat_id
    return _material_out(mat_data)


@router.post("/generate-by-topic")
async def generate_by_topic(req: TopicGenerateRequest, user=Depends(get_current_user)):
    """RAG-powered: generate study materials by topic using multi-source retrieval."""
    set_tracking_context(user["id"], "study_materials")
    if req.type not in ("summary", "flashcards", "quiz"):
        raise HTTPException(400, "Type must be summary, flashcards, or quiz")

    if not req.topic or len(req.topic.strip()) < 3:
        raise HTTPException(400, "Topic must be at least 3 characters")

    # ── Dedup: reuse topic-based material within 7 days ───────────────────────
    # topic-based materials use resource_id="topic_search", keyed by topic text
    import hashlib as _hashlib
    topic_key = f"topic_{_hashlib.sha256(req.topic.strip().lower().encode()).hexdigest()[:16]}"
    existing = _find_recent_material(user["id"], topic_key, req.type)
    if existing:
        out = _material_out(existing)
        out["_cached"] = True
        return out

    # RAG: retrieve relevant content from the course
    rag_chunks = await rag_service.retrieve(req.topic, [req.course_id], top_k=8)
    if not rag_chunks:
        raise HTTPException(404, "No relevant course materials found for this topic. Try indexing the course first.")

    rag_context = rag_service.format_context(rag_chunks)
    sources = rag_service.format_citations(rag_chunks)

    system = get_knowledge_base("study_materials")

    if req.type == "summary":
        prompt = f"""Create concise study notes about "{req.topic}" using the following course materials.
Organise with clear headings, bullet points, and highlight key concepts and definitions.
Cite sources using [Source N] notation where applicable.

RETRIEVED COURSE MATERIALS:
{rag_context}

Return the summary as plain text with markdown formatting."""
        try:
            result_text = await generate_text(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        stored_content = result_text

    elif req.type == "flashcards":
        prompt = f"""Generate flashcards about "{req.topic}" using the following course materials.
Create 10-15 flashcards covering the most important concepts.

RETRIEVED COURSE MATERIALS:
{rag_context}

Return JSON array with this structure:
[
  {{"front": "<question or term>", "back": "<answer or definition>"}},
  ...
]"""
        try:
            result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        import json
        stored_content = json.dumps(result)

    elif req.type == "quiz":
        prompt = f"""Generate a practice quiz about "{req.topic}" using the following course materials.
Create 10 questions of mixed types (multiple choice and true/false).

RETRIEVED COURSE MATERIALS:
{rag_context}

Return JSON array with this structure:
[
  {{
    "question": "<question text>",
    "type": "mcq" | "true_false",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "<correct option text>",
    "explanation": "<brief explanation>"
  }},
  ...
]"""
        try:
            result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        import json
        stored_content = json.dumps(result)

    # Store in Firestore
    mat_id = models.gen_id()
    now = datetime.now(timezone.utc).isoformat()
    mat_data = {
        "userId": user["id"],
        "resourceId": topic_key,
        "courseId": req.course_id,
        "type": req.type,
        "title": f"{req.type.capitalize()} — {req.topic}",
        "content": stored_content,
        "createdAt": now,
    }
    db.collection(models.GENERATED_STUDY_MATERIALS).document(mat_id).set(mat_data)
    mat_data["id"] = mat_id

    result_out = _material_out(mat_data)
    result_out["sources"] = sources
    return result_out


@router.get("/")
async def list_materials(
    resource_id: str = None,
    course_id: str = None,
    user=Depends(get_current_user),
):
    query = db.collection(models.GENERATED_STUDY_MATERIALS).where(filter=FieldFilter(
        "userId", "==", user["id"]
    ))
    if course_id:
        query = query.where(filter=FieldFilter("courseId", "==", course_id))
    if resource_id:
        query = query.where(filter=FieldFilter("resourceId", "==", resource_id))

    try:
        docs = query.order_by("createdAt", direction="DESCENDING").limit(50).get()
    except Exception:
        # Fallback if composite index doesn't exist — fetch and sort in Python
        docs = query.limit(50).get()
    results = [_material_out(models.doc_to_dict(d)) for d in docs]
    results.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return results


class QuizAttemptBody(BaseModel):
    score: int
    total: int
    percentage: float


@router.post("/{material_id}/quiz-attempts")
async def save_quiz_attempt(material_id: str, body: QuizAttemptBody, user=Depends(get_current_user)):
    """Save a quiz attempt score for a generated study material."""
    doc = db.collection(models.GENERATED_STUDY_MATERIALS).document(material_id).get()
    if not doc.exists:
        raise HTTPException(404, "Material not found")
    if doc.to_dict().get("userId") != user["id"]:
        raise HTTPException(403, "Not your material")

    attempt_id = models.gen_id()
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "materialId": material_id,
        "userId": user["id"],
        "score": body.score,
        "total": body.total,
        "percentage": body.percentage,
        "createdAt": now,
    }
    db.collection(models.STUDY_QUIZ_ATTEMPTS).document(attempt_id).set(data)
    data["id"] = attempt_id
    return data


@router.get("/{material_id}/quiz-attempts")
async def list_quiz_attempts(material_id: str, user=Depends(get_current_user)):
    """List all quiz attempts for a specific generated study material."""
    try:
        docs = (
            db.collection(models.STUDY_QUIZ_ATTEMPTS)
            .where(filter=FieldFilter("materialId", "==", material_id))
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .order_by("createdAt", direction="DESCENDING")
            .limit(20)
            .get()
        )
    except Exception:
        docs = (
            db.collection(models.STUDY_QUIZ_ATTEMPTS)
            .where(filter=FieldFilter("materialId", "==", material_id))
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .limit(20)
            .get()
        )
    results = []
    for d in docs:
        data = d.to_dict()
        data["id"] = d.id
        results.append(data)
    results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return results


@router.delete("/{material_id}")
async def delete_material(material_id: str, user=Depends(get_current_user)):
    doc = db.collection(models.GENERATED_STUDY_MATERIALS).document(material_id).get()
    if not doc.exists:
        raise HTTPException(404, "Material not found")
    if doc.to_dict().get("userId") != user["id"]:
        raise HTTPException(403, "Not your material")
    doc.reference.delete()
    return {"ok": True}
