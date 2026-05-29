"""AI-powered study material generation from course resources."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import os
import re
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
    course_id: str = ""  # required only when evidence_tier == "course"
    type: str  # "summary", "flashcards", "quiz"
    # Which source tier the material should be grounded in:
    #   "course"            — RAG against the lecturer's indexed course (default)
    #   "online"            — OpenAlex peer-reviewed sources (last 6 years)
    #   "general_knowledge" — Gemini's general knowledge with cited works
    evidence_tier: str = "course"


def _material_out(d: dict) -> dict:
    return {
        "id": d.get("id"),
        "resource_id": d.get("resourceId"),
        "course_id": d.get("courseId"),
        "type": d.get("type"),
        "title": d.get("title", ""),
        "content": d.get("content"),
        "created_at": d.get("createdAt"),
        # Source-tier metadata for topic-based materials. Older docs without
        # these fields just render unchanged — the UI treats them as missing.
        "evidence_tier": d.get("evidenceTier"),
        "provenance_banner": d.get("provenanceBanner"),
        "citations": d.get("citations") or [],
    }


def _read_pdf(path: str) -> str:
    """Try PyPDF2 first (fast, free). Fall back to Gemini vision OCR for scanned
    PDFs and Jawi (Arabic-script) lecture notes where PyPDF2 returns nothing
    useful because the page is an embedded image."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if len(text.strip()) >= 80:
            return text
    except Exception:
        text = ""

    # Fallback: hand the PDF bytes to Gemini as an inline document part.
    # Works for Jawi / Arabic script, handwriting, and scanned images because
    # the model can see the page layout rather than relying on extracted glyphs.
    return _ocr_pdf_with_gemini(path) or text


def _ocr_pdf_with_gemini(path: str) -> str:
    """OCR a PDF using Gemini vision. Returns '' on failure."""
    import logging
    log = logging.getLogger(__name__)
    try:
        from google.genai import types
        from app.ai_service import _get_client, FAST_MODEL

        with open(path, "rb") as f:
            data = f.read()
        if len(data) > 20 * 1024 * 1024:
            # Gemini inline-data cap is ~20MB
            return ""

        client = _get_client()
        prompt = (
            "Transcribe all text in this document into plain UTF-8. "
            "The document may contain English, Bahasa Melayu in Rumi script, "
            "or Bahasa Melayu in Jawi (Arabic) script — transcribe Jawi exactly "
            "as written using Arabic Unicode characters, do not transliterate. "
            "Preserve paragraph breaks and bullet structure. "
            "Output only the transcribed text, no commentary."
        )
        response = client.models.generate_content(
            model=FAST_MODEL,
            contents=[
                types.Part.from_bytes(data=data, mime_type="application/pdf"),
                prompt,
            ],
        )
        return (getattr(response, "text", "") or "").strip()
    except Exception as e:
        log.warning("Gemini OCR fallback failed for %s: %s", path, e)
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


async def _verify_citations(raw: list[dict]) -> list[dict]:
    """Verify each Gemini-emitted citation against OpenAlex so the UI can flag
    hallucinated references. Cap to 6 to keep the OpenAlex calls bounded."""
    from app.services import external_lookup
    out: list[dict] = []
    for c in (raw or [])[:6]:
        if not isinstance(c, dict):
            continue
        title = (c.get("title") or "").strip()
        verified = await external_lookup.verify_citation(title) if title else None
        if verified:
            out.append({**verified, "tier": "general_knowledge", "verified": True})
        else:
            out.append({
                "tier": "general_knowledge",
                "kind": "citation",
                "title": title,
                "authors": c.get("authors", ""),
                "year": c.get("year"),
                "venue": c.get("venue", ""),
                "url": "",
                "verified": False,
            })
    return out


_CITATIONS_RE = re.compile(r"CITATIONS_JSON:\s*(\[.*?\])\s*$", re.DOTALL)


async def _parse_and_verify_gk_citations(text: str) -> tuple[str, list[dict]]:
    """Strip a trailing CITATIONS_JSON: [...] block from the generated text and
    verify each entry. Returns (clean_text, verified_citations)."""
    m = _CITATIONS_RE.search(text)
    if not m:
        return text, []
    body = text[:m.start()].rstrip()
    try:
        import json as _json
        raw = _json.loads(m.group(1))
        verified = await _verify_citations(raw if isinstance(raw, list) else [])
        return body, verified
    except Exception:
        return body, []


async def _split_flashcards_and_citations(text: str) -> tuple[str, list[dict]]:
    """For flashcard/quiz prompts: extract the leading JSON array + trailing
    CITATIONS_JSON block. Returns (json_string, verified_citations)."""
    # First strip any trailing CITATIONS_JSON tail and verify.
    body, cites = await _parse_and_verify_gk_citations(text)
    # The body should be a JSON array. Find its outermost [...] span.
    body = body.strip()
    if body.startswith("```"):
        # Strip optional fenced code block ('```json\n...\n```').
        body = re.sub(r"^```(?:json)?\s*", "", body)
        body = re.sub(r"\s*```$", "", body)
    start = body.find("[")
    end = body.rfind("]")
    if start != -1 and end > start:
        body = body[start:end + 1]
    return body, cites


def _banner_for_tier(tier: str, citations: list[dict]) -> str:
    """Provenance banner persisted at the top of the stored material so the
    student always sees where the content was sourced from — even on reload."""
    if tier == "course":
        return "> 🎓 **Generated from your lecturer's course notes.**\n\n"
    if tier == "online":
        lines = ["> ⚠️ **NOT from your course notes.** Sourced from academic literature (last 6 years):"]
        for c in citations[:5]:
            line = f"> – {c.get('authors','Unknown')} ({c.get('year','n.d.')}). {c.get('title','')}."
            if c.get("venue"):
                line += f" *{c['venue']}*."
            if c.get("url"):
                line += f" [link]({c['url']})"
            lines.append(line)
        return "\n".join(lines) + "\n\n"
    # general_knowledge
    return (
        "> ⚠️ **NOT from your course notes.** AI general knowledge, with no "
        "verifiable academic sources from the last 6 years for this topic. "
        "Cross-check key facts before relying on them.\n\n"
    )


@router.post("/generate-by-topic")
async def generate_by_topic(req: TopicGenerateRequest, user=Depends(get_current_user)):
    """RAG-powered: generate study materials by topic. Three source tiers —
    course / online (OpenAlex, last 6 years) / Gemini general knowledge with
    verified citations. All results are saved to GENERATED_STUDY_MATERIALS so
    they appear in the Study Materials page."""
    set_tracking_context(user["id"], "study_materials")
    if req.type not in ("summary", "flashcards", "quiz"):
        raise HTTPException(400, "Type must be summary, flashcards, or quiz")

    if not req.topic or len(req.topic.strip()) < 3:
        raise HTTPException(400, "Topic must be at least 3 characters")

    tier = (req.evidence_tier or "course").strip().lower()
    if tier not in ("course", "online", "general_knowledge"):
        raise HTTPException(400, "evidence_tier must be course, online, or general_knowledge")

    # ── Dedup key: include tier so course vs online vs Gemini don't collide ──
    import hashlib as _hashlib
    topic_key = f"topic_{tier}_{_hashlib.sha256(req.topic.strip().lower().encode()).hexdigest()[:16]}"
    existing = _find_recent_material(user["id"], topic_key, req.type)
    if existing:
        out = _material_out(existing)
        out["_cached"] = True
        return out

    # ── Build grounding context per tier ──
    rag_context = ""
    citations: list[dict] = []
    course_id_for_storage = req.course_id

    if tier == "course":
        if not req.course_id:
            raise HTTPException(400, "course_id is required for course-sourced materials")
        rag_chunks = await rag_service.retrieve(req.topic, [req.course_id], top_k=8)
        if not rag_chunks:
            raise HTTPException(404, "No relevant course materials found for this topic. Try indexing the course first.")
        rag_context = rag_service.format_context(rag_chunks)
        citations = rag_service.format_citations(rag_chunks)

    elif tier == "online":
        from app.services import external_lookup
        oa_sources = await external_lookup.lookup_openalex(req.topic, top_k=6)
        if not oa_sources:
            raise HTTPException(404, "No peer-reviewed academic sources found in the last 6 years for this topic.")
        rag_context = external_lookup.format_online_context(oa_sources)
        citations = oa_sources
        course_id_for_storage = course_id_for_storage or "external"

    else:  # general_knowledge — no grounding context; the prompt itself enforces citation
        rag_context = ""
        citations = []  # populated after generation by parsing model's CITATIONS_JSON
        course_id_for_storage = course_id_for_storage or "general"

    system = get_knowledge_base("study_materials")

    # ── Per-type prompts ──
    # General_knowledge tier: do NOT ask Gemini to cite. The model kept
    # emitting classical references outside the 6-year window (e.g. Vygotsky
    # 1978) that couldn't be verified, so we now suppress citations entirely
    # in this tier. The provenance banner makes the "no verifiable sources"
    # state clear to the student.
    gk_citation_rule = (
        "\n\nIMPORTANT: Do NOT include any inline citations, [Source N] markers, "
        "Author (Year) references, or a CITATIONS list. The student will see a "
        "banner explaining this content is AI general knowledge with no "
        "verifiable academic sources."
    )

    if req.type == "summary":
        if tier == "general_knowledge":
            prompt = (
                f'Create concise study notes about "{req.topic}".\n'
                "Organise with clear headings, bullet points, and highlight key concepts and definitions.\n"
                "Return as plain text with markdown formatting."
                + gk_citation_rule
            )
        else:
            src_label = "ACADEMIC SOURCES" if tier == "online" else "RETRIEVED COURSE MATERIALS"
            prompt = (
                f'Create concise study notes about "{req.topic}" using the following materials.\n'
                "Organise with clear headings, bullet points, and highlight key concepts and definitions.\n"
                "Cite sources using [Source N] notation where applicable.\n\n"
                f"{src_label}:\n{rag_context}\n\n"
                "Return the summary as plain text with markdown formatting."
            )
        try:
            result_text = await generate_text(prompt, system_instruction=system, model_name=FAST_MODEL)
        except Exception as e:
            raise HTTPException(502, f"AI generation failed: {str(e)}")
        # For general_knowledge, parse out CITATIONS_JSON and verify each cite.
        if tier == "general_knowledge":
            result_text, citations = await _parse_and_verify_gk_citations(result_text)
        stored_content = result_text

    elif req.type == "flashcards":
        if tier == "general_knowledge":
            prompt = (
                f'Generate flashcards about "{req.topic}".\n'
                "Create 10-15 flashcards covering the most important concepts.\n\n"
                'Return JSON array with this structure: [{"front":"...","back":"..."}, ...]'
                + gk_citation_rule
                + "\nThe CITATIONS_JSON line must come AFTER the flashcards JSON, on its own line."
            )
            try:
                result_text = await generate_text(prompt, system_instruction=system, model_name=FAST_MODEL)
            except Exception as e:
                raise HTTPException(502, f"AI generation failed: {str(e)}")
            stored_content, citations = await _split_flashcards_and_citations(result_text)
        else:
            src_label = "ACADEMIC SOURCES" if tier == "online" else "RETRIEVED COURSE MATERIALS"
            prompt = (
                f'Generate flashcards about "{req.topic}" using the following materials.\n'
                "Create 10-15 flashcards covering the most important concepts.\n\n"
                f"{src_label}:\n{rag_context}\n\n"
                'Return JSON array: [{"front":"<question or term>","back":"<answer or definition>"}, ...]'
            )
            try:
                result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
            except Exception as e:
                raise HTTPException(502, f"AI generation failed: {str(e)}")
            import json
            stored_content = json.dumps(result)

    elif req.type == "quiz":
        if tier == "general_knowledge":
            prompt = (
                f'Generate a practice quiz about "{req.topic}".\n'
                "Create 10 questions of mixed types (multiple choice and true/false).\n\n"
                'Return JSON array: [{"question":"...","type":"mcq"|"true_false",'
                '"options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}, ...]'
                + gk_citation_rule
                + "\nThe CITATIONS_JSON line must come AFTER the quiz JSON, on its own line."
            )
            try:
                result_text = await generate_text(prompt, system_instruction=system, model_name=FAST_MODEL)
            except Exception as e:
                raise HTTPException(502, f"AI generation failed: {str(e)}")
            stored_content, citations = await _split_flashcards_and_citations(result_text)
        else:
            src_label = "ACADEMIC SOURCES" if tier == "online" else "RETRIEVED COURSE MATERIALS"
            prompt = (
                f'Generate a practice quiz about "{req.topic}" using the following materials.\n'
                "Create 10 questions of mixed types (multiple choice and true/false).\n\n"
                f"{src_label}:\n{rag_context}\n\n"
                'Return JSON array: [{"question":"...","type":"mcq"|"true_false",'
                '"options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}, ...]'
            )
            try:
                result = await generate_json(prompt, system_instruction=system, model_name=FAST_MODEL)
            except Exception as e:
                raise HTTPException(502, f"AI generation failed: {str(e)}")
            import json
            stored_content = json.dumps(result)

    # ── Persist so the material appears in the Study Materials page ──
    # Banner is stored separately from content because flashcards/quiz content
    # is pure JSON parsed by the viewer — mixing markdown in would break it.
    mat_id = models.gen_id()
    now = datetime.now(timezone.utc).isoformat()
    mat_data = {
        "userId": user["id"],
        "resourceId": topic_key,
        "courseId": course_id_for_storage,
        "type": req.type,
        "title": f"{req.type.capitalize()} — {req.topic}",
        "content": stored_content,
        "createdAt": now,
        "evidenceTier": tier,
        "provenanceBanner": _banner_for_tier(tier, citations),
        "citations": citations[:5],
    }
    db.collection(models.GENERATED_STUDY_MATERIALS).document(mat_id).set(mat_data)
    mat_data["id"] = mat_id

    result_out = _material_out(mat_data)
    # Echo the citations back to the caller under `sources` for back-compat
    # with the existing frontend type that expected a `sources` field.
    result_out["sources"] = citations
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
