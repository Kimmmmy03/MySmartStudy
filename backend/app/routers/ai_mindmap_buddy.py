"""AI Mind Map Buddy — smart assistant for mind map creation with memory."""

import hashlib
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user
from app.ai_service import generate_json, generate_text, chat_completion, set_tracking_context
from app.firestore import db
from app import models, rag_service, rag_multistep, gag_service, knowledge_graph_service
from app.multi_agent import fan_out, get_or_default
from app.services import external_lookup
from google.cloud.firestore_v1.base_query import FieldFilter
from datetime import datetime, timezone
import re

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/mindmap-buddy", tags=["AI MindMap Buddy"])


# ── Cache helpers ──────────────────────────────────────────────────────────────

def _content_hash(*parts: str) -> str:
    key = "|".join(str(p) for p in parts)
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def _get_cache(collection: str, cache_key: str, ttl_hours: float) -> dict | None:
    doc = db.collection(collection).document(cache_key).get()
    if not doc.exists:
        return None
    d = doc.to_dict()
    created = d.get("createdAt", "")
    if created:
        try:
            age_hours = (
                datetime.now(timezone.utc) - datetime.fromisoformat(created)
            ).total_seconds() / 3600
            if age_hours <= ttl_hours:
                return d.get("result")
        except Exception:
            pass
    return None


def _set_cache(collection: str, cache_key: str, result: dict):
    try:
        db.collection(collection).document(cache_key).set({
            "result": result,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

MINDMAP_SYSTEM_PROMPT = """You are SmartBuddy for Mind Maps, an AI assistant that helps students create better mind maps.
You analyse the student's current mind map structure and provide actionable suggestions.
You are knowledgeable about different mind map types (concept map, spider map, tree map, flow chart, hierarchy map, fishbone/Ishikawa diagram).
Be concise, friendly, and educational. Focus on practical improvements.
You remember the student's previous conversations and adapt your advice based on their preferences and history."""


class MapAnalyzeRequest(BaseModel):
    title: str = ""
    nodes: list[dict] = []  # [{id, label, type, position, ...}]
    edges: list[dict] = []  # [{id, source, target, ...}]
    task_description: str = ""  # optional assignment context
    map_type: str = ""  # current mind map type/template


class NodeRecommendRequest(BaseModel):
    title: str = ""
    node_id: str
    node_label: str
    parent_labels: list[str] = []
    sibling_labels: list[str] = []
    map_topic: str = ""
    # Sequential wizard: which kind of child to recommend next for this node.
    # One of: subtopic | detail | example | image | resource. Empty = generic mix.
    rec_type: str = ""
    # Labels already added under this node — so we don't recommend duplicates.
    existing_children: list[str] = []


# Per-type guidance for the sequential "build out this node" wizard. Each entry
# tailors what kind of child node to propose and how to format its label.
REC_TYPE_GUIDANCE: dict[str, str] = {
    "subtopic": (
        "Suggest SUBTOPICS — direct conceptual branches that break the node "
        "into its main parts. Use a short noun-phrase label (no prefix)."
    ),
    "detail": (
        "Suggest DETAILS — a key fact, definition, or explanation about the "
        "node. Use a concise label (no prefix)."
    ),
    "example": (
        "Suggest EXAMPLES — a concrete, worked example or real-world instance. "
        'Prefix each label with "[Example] ".'
    ),
    "image": (
        "Suggest IMAGES — a diagram/visual that would clarify the node. "
        'Prefix each label with "[Image] " and describe the visual to add.'
    ),
    "resource": (
        "Suggest RESOURCES — a study resource, reference, or source to review "
        'for this node. Prefix each label with "[Resource] ".'
    ),
}


class MapSuggestAllRequest(BaseModel):
    title: str = ""
    nodes: list[dict] = []  # [{id, label, type, position}]
    edges: list[dict] = []  # [{id, source, target}]


class ChatRequest(BaseModel):
    message: str
    map_context: Optional[dict] = None  # current map state summary


def _get_memory(user_id: str) -> dict:
    """Load user's mindmap buddy memory (chat history + preferences)."""
    docs = db.collection(models.AI_MINDMAP_BUDDY_MEMORY).where(
        filter=FieldFilter("userId", "==", user_id)
    ).limit(1).get()
    if docs:
        return {"id": docs[0].id, **docs[0].to_dict()}
    return {}


def _save_memory(user_id: str, memory_id: str | None, messages: list[dict], preferences: dict):
    """Save or update the user's mindmap buddy memory."""
    # Keep last 30 messages
    trimmed = messages[-30:]
    data = {
        "userId": user_id,
        "messages": trimmed,
        "preferences": preferences,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if memory_id:
        db.collection(models.AI_MINDMAP_BUDDY_MEMORY).document(memory_id).update(data)
    else:
        mid = models.gen_id()
        db.collection(models.AI_MINDMAP_BUDDY_MEMORY).document(mid).set(data)


def _build_history_context(messages: list[dict], limit: int = 10) -> str:
    """Build a conversation context string from recent messages."""
    recent = messages[-limit:]
    if not recent:
        return ""
    lines = []
    for m in recent:
        role = "Student" if m.get("role") == "user" else "SmartBuddy"
        lines.append(f"{role}: {m.get('text', '')}")
    return "\n\nPrevious conversation:\n" + "\n".join(lines)


@router.post("/analyze")
async def analyze_mindmap(req: MapAnalyzeRequest, user=Depends(get_current_user)):
    """Analyze the current mind map and return suggestions, rating, and recommendations."""
    set_tracking_context(user["id"], "mindmap_buddy")
    node_labels = [n.get("label", n.get("data", {}).get("label", "")) for n in req.nodes if n]
    edge_count = len(req.edges)
    node_count = len(req.nodes)

    # ── Cache check (TTL: 2 hours) ─────────────────────────────────────────────
    cache_key = _content_hash(
        user["id"],
        "|".join(sorted(node_labels)),
        str(edge_count),
        req.map_type or "",
    )
    cached = _get_cache(models.AI_MAP_ANALYSIS_CACHE, cache_key, ttl_hours=2)
    if cached is not None:
        cached["_cached"] = True
        return cached

    # Load user preferences from memory
    memory = _get_memory(user["id"])
    prefs = memory.get("preferences", {})
    pref_str = ""
    if prefs:
        pref_str = f"\nStudent preferences: preferred map type = {prefs.get('preferred_map_type', 'any')}, experience level = {prefs.get('experience', 'unknown')}"

    prompt = f"""Analyze this mind map and provide structured feedback.

Mind Map Title: {req.title or "Untitled"}
Task/Assignment: {req.task_description or "General mind map"}
Current Map Type: {req.map_type or "Unknown"}
Number of Nodes: {node_count}
Number of Connections: {edge_count}
Node Labels: {', '.join(node_labels[:50]) if node_labels else "No nodes yet"}{pref_str}

IMPORTANT: If the student is already using a suitable map type for their topic, set "type_change_reason" to "" (empty string) and set "recommended_map_type" to the current type. Only recommend a DIFFERENT map type if the current one is genuinely unsuitable.

Provide your analysis as JSON:
{{
  "rating": <1-10 score>,
  "rating_label": "<Excellent/Good/Fair/Needs Work/Just Started>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<actionable improvement 1>", "<actionable improvement 2>", "<actionable improvement 3>"],
  "suggested_nodes": ["<suggested node to add 1>", "<suggested node to add 2>", "<suggested node to add 3>"],
  "recommended_map_type": "<best map type OR current type if already good>",
  "type_change_reason": "<why a DIFFERENT type is better, or empty string if current type is fine>",
  "structure_feedback": "<brief feedback about the overall structure and organization>"
}}"""

    try:
        result = await generate_json(
            prompt,
            system_instruction=MINDMAP_SYSTEM_PROMPT,
            temperature=0.4,
        )
        _set_cache(models.AI_MAP_ANALYSIS_CACHE, cache_key, result)
        result["_cached"] = False
        return result
    except Exception as e:
        logger.exception("analyze failed")
        raise HTTPException(502, f"Analysis failed: {str(e)}")


@router.post("/recommend-nodes")
async def recommend_nodes(req: NodeRecommendRequest, user=Depends(get_current_user)):
    """Recommend child nodes using RAG + knowledge graph context."""
    set_tracking_context(user["id"], "mindmap_buddy")
    # ── Cache check (TTL: 24 hours) ────────────────────────────────────────────
    cache_key = _content_hash(
        user["id"],
        req.node_label,
        "|".join(sorted(req.parent_labels)),
        "|".join(sorted(req.sibling_labels)),
        req.map_topic or "",
        req.rec_type or "",
        "|".join(sorted(req.existing_children)),
    )
    cached = _get_cache(models.AI_NODE_RECS_CACHE, cache_key, ttl_hours=24)
    if cached is not None:
        cached["_cached"] = True
        return cached

    # ── Fan-out: RAG + Knowledge Graph in parallel ─────────────────────────
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user["id"])
    ).get()
    course_ids = [doc.id for doc in course_docs]

    async def _rag_agent():
        if not course_ids:
            return ""
        query = f"{req.node_label} {req.map_topic or ''}"
        chunks, _ = await rag_multistep.retrieve_multistep(query, course_ids, top_k=3)
        if chunks:
            return f"\n\nRELEVANT COURSE MATERIALS:\n{rag_service.format_context(chunks)}"
        return ""

    async def _kg_agent():
        for cid in course_ids:
            subgraph = knowledge_graph_service.query_related_concepts(
                cid, [req.node_label], depth=1,
            )
            if subgraph.get("nodes"):
                related = [n.get("label", "") for n in subgraph["nodes"].values()]
                return f"\nRELATED CONCEPTS FROM COURSE: {', '.join(related[:10])}"
        return ""

    retrieval = await fan_out({"rag": _rag_agent(), "kg": _kg_agent()})
    rag_context = get_or_default(retrieval, "rag", "") or ""
    kg_context = get_or_default(retrieval, "kg", "") or ""

    type_guidance = REC_TYPE_GUIDANCE.get(req.rec_type, "")
    existing_str = (
        f"\nAlready added under this node (do NOT repeat these): {', '.join(req.existing_children)}"
        if req.existing_children else ""
    )
    if type_guidance:
        task_line = (
            f"{type_guidance}\n"
            f"Suggest 3 such child nodes for \"{req.node_label}\", best first."
        )
    else:
        task_line = (
            f"Suggest 5 child nodes that would be good branches from \"{req.node_label}\"."
        )

    prompt = f"""A student is building a mind map about "{req.map_topic or 'a topic'}".
They have a node labeled "{req.node_label}".
Parent context: {', '.join(req.parent_labels) if req.parent_labels else 'This is a root/top-level node'}
Sibling nodes: {', '.join(req.sibling_labels) if req.sibling_labels else 'No siblings yet'}{existing_str}
{rag_context}{kg_context}

{task_line}
Ground your suggestions in the course materials and related concepts where possible.

Return JSON:
{{
  "suggestions": [
    {{"label": "<node label>", "description": "<brief 1-line explanation>"}},
    ...
  ]
}}"""

    try:
        result = await generate_json(
            prompt,
            system_instruction=MINDMAP_SYSTEM_PROMPT,
            temperature=0.5,
        )
        # Tag each suggestion with the requested type so the wizard can render
        # the right icon / add the right node kind.
        if req.rec_type and isinstance(result, dict):
            for s in result.get("suggestions", []):
                if isinstance(s, dict):
                    s.setdefault("rec_type", req.rec_type)
            result["rec_type"] = req.rec_type
        _set_cache(models.AI_NODE_RECS_CACHE, cache_key, result)
        result["_cached"] = False
        return result
    except Exception as e:
        logger.exception("recommend-nodes failed")
        raise HTTPException(502, f"Recommendation failed: {str(e)}")


@router.post("/suggest-all")
async def suggest_all_nodes(req: MapSuggestAllRequest, user=Depends(get_current_user)):
    """RAG+GAG (Graph): Suggest new nodes using course materials and knowledge graph."""
    set_tracking_context(user["id"], "mindmap_buddy")
    node_labels = [n.get("label", "") for n in req.nodes if n.get("label")]

    # ── Cache check (TTL: 2 hours) ─────────────────────────────────────────────
    edge_pairs = sorted(
        f"{e.get('source')}>{e.get('target')}" for e in req.edges if e.get("source") and e.get("target")
    )
    cache_key = _content_hash(
        user["id"],
        "|".join(sorted(node_labels)),
        "|".join(edge_pairs),
        req.title or "",
    )
    cached = _get_cache(models.AI_SUGGEST_ALL_CACHE, cache_key, ttl_hours=2)
    if cached is not None:
        cached["_cached"] = True
        return cached

    # ── Fan-out: RAG + Knowledge Graph in parallel ─────────────────────────
    course_docs = db.collection(models.COURSES).where(
        filter=FieldFilter("enrolledStudents", "array_contains", user["id"])
    ).get()
    course_ids = [doc.id for doc in course_docs]

    async def _rag_suggest():
        if not course_ids:
            return []
        query = f"{req.title or ''} {' '.join(node_labels[:10])}"
        return await rag_service.retrieve(query, course_ids, top_k=5)

    async def _kg_suggest():
        if not course_ids or not node_labels:
            return {}
        for cid in course_ids:
            subgraph = knowledge_graph_service.query_related_concepts(
                cid, node_labels[:10], depth=2,
            )
            if subgraph.get("nodes"):
                return subgraph
        return {}

    retrieval = await fan_out({"rag": _rag_suggest(), "kg": _kg_suggest()})
    rag_chunks = get_or_default(retrieval, "rag", []) or []
    concept_subgraph = get_or_default(retrieval, "kg", {}) or {}

    # Use GAG service for graph-structured suggestions if we have RAG/KG context
    if rag_chunks or concept_subgraph.get("nodes"):
        try:
            result = await gag_service.generate_graph_suggestions(
                map_nodes=req.nodes,
                map_edges=req.edges,
                rag_chunks=rag_chunks,
                concept_subgraph=concept_subgraph,
                map_title=req.title,
            )
            _set_cache(models.AI_SUGGEST_ALL_CACHE, cache_key, result)
            result["_cached"] = False
            return result
        except Exception as e:
            logger.warning("GAG graph suggestions failed, falling back: %s", e)

    # Fallback: original direct prompting
    edge_list = req.edges
    source_ids = {e.get("source") for e in edge_list}
    target_ids = {e.get("target") for e in edge_list}
    node_map = {n.get("id"): n.get("label", "") for n in req.nodes if n.get("id")}

    root_labels = [node_map[nid] for nid in node_map if nid not in target_ids and node_map[nid]]
    leaf_labels = [node_map[nid] for nid in node_map if nid not in source_ids and node_map[nid]]

    hierarchy_lines = []
    for e in edge_list[:30]:
        src = node_map.get(e.get("source"), "?")
        tgt = node_map.get(e.get("target"), "?")
        if src and tgt:
            hierarchy_lines.append(f'  "{src}" → "{tgt}"')

    prompt = f"""A student is building a mind map titled "{req.title or 'Untitled'}".

Node hierarchy:
  Root/Main nodes: {', '.join(root_labels[:5]) if root_labels else 'None identified'}
  Leaf nodes (no children): {', '.join(leaf_labels[:15]) if leaf_labels else 'None'}
  All nodes: {', '.join(node_labels[:40]) if node_labels else 'None yet'}
  Connections:
{chr(10).join(hierarchy_lines[:30]) if hierarchy_lines else '  (none)'}

Suggest 5-8 new nodes to improve this mind map. For EACH suggestion:
- "parent_label" MUST be an EXACT match to one of the existing node labels listed above
- Include a mix of content types: explanations, examples, and images/diagrams
- For image suggestions, start the label with "[Image]" and describe what image to add
- For example suggestions, start with "[Example]"
- For explanation suggestions, just use a clear label

Return JSON:
{{
  "suggestions": [
    {{"label": "<new node label>", "description": "<why this adds value>", "parent_label": "<EXACT existing node label to connect to>"}},
    {{"label": "[Image] <visual description>", "description": "<why a visual helps here — suggest using AI image generation>", "parent_label": "<EXACT existing node label>"}},
    {{"label": "[Example] <example title>", "description": "<brief description>", "parent_label": "<EXACT existing node label>"}},
    ...
  ]
}}"""

    try:
        result = await generate_json(
            prompt,
            system_instruction=MINDMAP_SYSTEM_PROMPT,
            temperature=0.5,
        )
        _set_cache(models.AI_SUGGEST_ALL_CACHE, cache_key, result)
        result["_cached"] = False
        return result
    except Exception as e:
        logger.exception("suggest-all failed")
        raise HTTPException(502, f"Suggestion failed: {str(e)}")


# ── Study-question intent detection ────────────────────────────────────────
# When the user asks a substantive academic question (not just "hi"), we
# surface AI Study Material CTAs (flashcards / summary). Cheap regex; the
# message must be long enough AND contain a learning verb.
_STUDY_VERB_RE = re.compile(
    r"\b(explain|describe|what is|what are|how does|how do|compare|contrast|define|"
    r"summari[sz]e|discuss|analy[sz]e|outline|teach me|tell me about|elaborate)\b",
    re.IGNORECASE,
)


def _is_study_question(msg: str) -> bool:
    return len(msg.strip()) >= 30 and bool(_STUDY_VERB_RE.search(msg))


async def _extract_topic(message: str) -> str:
    """Extract a short topic phrase from the student's question — used to seed
    flashcard / summary generation. Falls back to the message verbatim."""
    msg = message.strip()
    if len(msg) <= 60:
        return msg
    try:
        prompt = (
            "Extract the central study topic from this question as a short "
            "noun phrase of 3-8 words. Output ONLY the phrase, no quotes, no "
            f"punctuation at the end.\n\nQuestion: {msg}"
        )
        topic = (await generate_text(prompt, temperature=0.2)).strip()
        # Strip surrounding quotes / trailing period that the model sometimes adds.
        topic = topic.strip("\"'`").rstrip(".").strip()
        if 3 <= len(topic) <= 120:
            return topic
    except Exception:
        pass
    return msg[:120]


async def _verify_gemini_citations(citations: list[dict]) -> list[dict]:
    """Look each citation up in OpenAlex; tag verified vs unverified so the UI
    can warn the student about potentially hallucinated references."""
    out = []
    for c in citations:
        title = c.get("title", "")
        verified = await external_lookup.verify_citation(title) if title else None
        if verified:
            # Prefer the OpenAlex-canonical record (carries DOI, URL, real venue).
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


@router.post("/chat")
async def mindmap_chat(req: ChatRequest, user=Depends(get_current_user)):
    """Chat with Smart Buddy. Three-tier source pipeline: lecturer's course
    materials first, then peer-reviewed academic literature (OpenAlex, last 6
    years), finally Gemini's general knowledge with cited works. Every
    substantive answer reports where the info came from so the student can
    judge it; flashcard / summary CTAs are surfaced for study questions."""
    set_tracking_context(user["id"], "mindmap_buddy")
    memory = _get_memory(user["id"])
    memory_id = memory.get("id")
    messages = memory.get("messages", [])
    preferences = memory.get("preferences", {})

    context_parts = []
    if req.map_context:
        context_parts.append(f"Current map context: {req.map_context}")
    if preferences:
        pref_type = preferences.get("preferred_map_type", "")
        pref_exp = preferences.get("experience", "")
        if pref_type:
            context_parts.append(f"Student's preferred map type: {pref_type}")
        if pref_exp:
            context_parts.append(f"Student's experience level: {pref_exp}")

    # ── Tier 1: course materials (lecturer-indexed RAG) ──
    course_ids: list[str] = []
    course_chunks: list[dict] = []
    try:
        course_docs = db.collection(models.COURSES).where(
            filter=FieldFilter("enrolledStudents", "array_contains", user["id"])
        ).get()
        course_ids = [doc.id for doc in course_docs]
        if course_ids:
            course_chunks, _ = await rag_multistep.retrieve_multistep(req.message, course_ids, top_k=3)
    except Exception:
        course_chunks = []

    # Score threshold — chunks below this are too weak to count as course-grounded.
    COURSE_SCORE_THRESHOLD = 0.40
    strong_course = [c for c in course_chunks if (c.get("score") or 0) >= COURSE_SCORE_THRESHOLD]

    # ── Tier 2: OpenAlex (only when course tier is weak/empty AND it's a study
    # question — short chit-chat shouldn't trigger external lookups) ──
    is_study = _is_study_question(req.message)
    online_sources: list[dict] = []
    # Extract a clean topic phrase first; the full question text is too wordy
    # for OpenAlex's keyword search and tanks the hit rate.
    topic_query = await _extract_topic(req.message) if is_study else req.message
    if is_study and not strong_course:
        online_sources = await external_lookup.lookup_openalex(topic_query, top_k=5)

    # ── Decide tier + assemble grounding context ──
    sources: list[dict] = []
    evidence_level = "general_knowledge"
    grounding_context = ""
    tier_instruction = ""

    if strong_course:
        evidence_level = "course"
        grounding_context = (
            "\n\nRELEVANT COURSE MATERIALS — your lecturer's indexed notes. "
            "Use these to ground the answer and cite as [Source N]:\n"
            + rag_service.format_context(strong_course)
        )
        for c in strong_course:
            sources.append({
                "tier": "course",
                "title": c.get("title", "Untitled"),
                "doc_type": c.get("doc_type", ""),
                "course_id": c.get("course_id", ""),
                "doc_id": c.get("doc_id", ""),
                "score": c.get("score", 0),
            })
        tier_instruction = (
            "Cite each substantive claim with [Source N] using the numbered "
            "course materials above. Don't fabricate sources outside the list."
        )

    elif online_sources:
        evidence_level = "online"
        grounding_context = "\n\n" + external_lookup.format_online_context(online_sources)
        sources = online_sources
        tier_instruction = (
            "Ground the answer in the academic sources above and cite each claim "
            "as [Source N]. Don't invent sources outside that list. Mention this "
            "answer is from academic literature, not the student's course notes."
        )

    elif is_study:
        evidence_level = "general_knowledge"
        # No citations in this tier. The previous flow asked Gemini to emit
        # cited works, but the model kept producing classical sources outside
        # the 6-year window (e.g. Vygotsky 1978), so we now suppress citations
        # entirely when we can't ground in OpenAlex. The UI shows a clear
        # "no academic sources matched" notice instead of fake references.
        tier_instruction = (
            "No course materials or open-access papers from the last 6 years "
            "matched this topic. Answer from established knowledge in your own "
            "words. Do NOT include any inline citations, [Source N] markers, "
            "or Author/Year references — they cannot be verified and could "
            "mislead the student."
        )
    # else: chit-chat — no sources, no special instruction (style rules apply).

    # ── Build system prompt ──
    # Style block targets the formatting conventions students expect from
    # Claude / ChatGPT / Gemini: natural prose by default, bullets only when
    # the content is genuinely a list, no em dashes (replaced post-hoc as a
    # safety net below in case the model slips).
    system_prompt = (
        f"{MINDMAP_SYSTEM_PROMPT}\n\n"
        "RESPONSE STYLE — format like a thoughtful chat assistant "
        "(Claude / ChatGPT / Gemini):\n"
        "- Default to natural prose, NOT bullets. Paragraphs of 1-3 sentences.\n"
        "- Use a bulleted list ONLY when listing 3+ distinct items, steps, or "
        "comparisons. Never bullet a single sentence.\n"
        "- Use **bold** sparingly for key terms or names.\n"
        "- Use ### headings ONLY when the answer has multiple distinct "
        "sections that benefit from being labelled.\n"
        "- Match the user's energy: 'hi' gets ONE short casual line, no bullets.\n"
        "- No filler openers ('Welcome back', 'Great question', 'Sure thing').\n"
        "- No filler closers ('Let me know if...', 'Feel free to ask').\n"
        "- Don't echo the student's message back.\n"
        "- Don't mention the map title unless asked about the map.\n"
        "- NEVER use em dashes (—) or en dashes (–). Use commas, colons, or periods.\n"
        "\nFORMAT EXAMPLE for a concept question:\n"
        "Vygotsky's **Zone of Proximal Development (ZPD)** is the gap between "
        "what a learner can do alone and what they can do with guidance from a "
        "more knowledgeable other.\n\n"
        "In teaching, this means identifying where a student gets stuck just "
        "beyond their independent ability, then providing **scaffolding**: "
        "hints, prompts, modelling, or worked examples. The support is "
        "gradually removed as the student gains skill.\n"
    )
    if tier_instruction:
        system_prompt += "\nSOURCE RULES:\n" + tier_instruction + "\n"
    if context_parts:
        system_prompt += "\n" + "\n".join(context_parts)
    if grounding_context:
        system_prompt += grounding_context

    # Build multi-turn message history.
    gemini_messages = []
    for m in messages[-10:]:
        role = "user" if m.get("role") == "user" else "model"
        text = m.get("text", "")
        if text:
            gemini_messages.append({"role": role, "parts": [text]})
    gemini_messages.append({"role": "user", "parts": [req.message]})

    try:
        response_raw = await chat_completion(
            gemini_messages,
            system_instruction=system_prompt,
            temperature=0.7,
        )

        # General-knowledge tier no longer emits citations; we strip any
        # stragglers (a leftover CITATIONS_JSON line or stray [Source N]
        # markers) so they never reach the student.
        response = response_raw
        if evidence_level == "general_knowledge":
            response = re.sub(r"CITATIONS_JSON:\s*\[.*?\]\s*$", "", response, flags=re.DOTALL).rstrip()
            response = re.sub(r"\s*\[Source\s+\d+\]", "", response)

        # ── Suggested actions: AI Study Materials CTAs (only for study questions) ──
        suggested_actions: list[dict] = []
        if is_study:
            topic = await _extract_topic(req.message)
            # Pick the most relevant course for the course tier; for online /
            # general_knowledge no course is attached (the materials page
            # groups them under their evidence tier).
            chosen_course = sources[0]["course_id"] if (evidence_level == "course" and sources) else ""
            suggested_actions = [
                {"type": "flashcards", "topic": topic, "evidence_tier": evidence_level,
                 "course_id": chosen_course},
                {"type": "summary",    "topic": topic, "evidence_tier": evidence_level,
                 "course_id": chosen_course},
                {"type": "quiz",       "topic": topic, "evidence_tier": evidence_level,
                 "course_id": chosen_course},
            ]

        # Belt-and-braces dash strip — the style rule above tells the model
        # not to use em/en dashes, but Gemini still slips one in occasionally.
        # Replace em dash with ", " (the most natural fix for parenthetical
        # asides) and en dash with a hyphen (for ranges like 2020-2026).
        response = response.replace("—", ", ").replace("–", "-")

        # Save to memory.
        messages.append({"role": "user", "text": req.message, "ts": datetime.now(timezone.utc).isoformat()})
        messages.append({"role": "buddy", "text": response, "ts": datetime.now(timezone.utc).isoformat()})
        _save_memory(user["id"], memory_id, messages, preferences)

        return {
            "response": response,
            "evidence_level": evidence_level,
            "sources": sources,
            "suggested_actions": suggested_actions,
        }
    except Exception as e:
        logger.exception("chat failed")
        raise HTTPException(502, f"Chat failed: {str(e)}")


@router.get("/memory")
async def get_memory(user=Depends(get_current_user)):
    """Get the user's mindmap buddy memory (chat history + preferences)."""
    memory = _get_memory(user["id"])
    return {
        "messages": memory.get("messages", []),
        "preferences": memory.get("preferences", {}),
    }


@router.delete("/memory")
async def clear_memory(user=Depends(get_current_user)):
    """Clear the user's mindmap buddy memory."""
    memory = _get_memory(user["id"])
    if memory.get("id"):
        db.collection(models.AI_MINDMAP_BUDDY_MEMORY).document(memory["id"]).delete()
    return {"ok": True}


@router.patch("/preferences")
async def update_preferences(prefs: dict, user=Depends(get_current_user)):
    """Update the user's mindmap buddy preferences."""
    memory = _get_memory(user["id"])
    memory_id = memory.get("id")
    messages = memory.get("messages", [])
    existing_prefs = memory.get("preferences", {})
    existing_prefs.update(prefs)
    _save_memory(user["id"], memory_id, messages, existing_prefs)
    return {"ok": True, "preferences": existing_prefs}
