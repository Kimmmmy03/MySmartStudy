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
from google.cloud.firestore_v1.base_query import FieldFilter
from datetime import datetime, timezone

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

    prompt = f"""A student is building a mind map about "{req.map_topic or 'a topic'}".
They have a node labeled "{req.node_label}".
Parent context: {', '.join(req.parent_labels) if req.parent_labels else 'This is a root/top-level node'}
Sibling nodes: {', '.join(req.sibling_labels) if req.sibling_labels else 'No siblings yet'}
{rag_context}{kg_context}

Suggest 5 child nodes that would be good branches from "{req.node_label}".
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


@router.post("/chat")
async def mindmap_chat(req: ChatRequest, user=Depends(get_current_user)):
    """Chat with Smart Buddy about mind map creation. Includes per-user memory."""
    set_tracking_context(user["id"], "mindmap_buddy")
    # Load memory
    memory = _get_memory(user["id"])
    memory_id = memory.get("id")
    messages = memory.get("messages", [])
    preferences = memory.get("preferences", {})

    # Build context snippets for the system prompt
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

    # RAG: retrieve relevant course content for the chat message
    rag_context = ""
    try:
        course_docs = db.collection(models.COURSES).where(
            filter=FieldFilter("enrolledStudents", "array_contains", user["id"])
        ).get()
        course_ids = [doc.id for doc in course_docs]
        if course_ids:
            chunks, _ = await rag_multistep.retrieve_multistep(req.message, course_ids, top_k=3)
            if chunks:
                rag_context = f"\n\nRELEVANT COURSE MATERIALS (use to ground your answer):\n{rag_service.format_context(chunks)}"
    except Exception:
        pass

    # Build system instruction with context
    system_prompt = (
        f"{MINDMAP_SYSTEM_PROMPT}\n\n"
        "IMPORTANT RULES:\n"
        "- NEVER repeat or echo the student's message back to them.\n"
        "- Always provide a helpful, original response with actionable advice.\n"
        "- Keep responses concise (2-4 sentences).\n"
        "- When relevant, reference course materials to give grounded suggestions.\n"
        "- If the student asks for mind map ideas, suggest specific topics and structure.\n"
    )
    if context_parts:
        system_prompt += "\n" + "\n".join(context_parts)
    if rag_context:
        system_prompt += rag_context

    # Build multi-turn message history for chat_completion
    gemini_messages = []
    for m in messages[-10:]:
        role = "user" if m.get("role") == "user" else "model"
        text = m.get("text", "")
        if text:
            gemini_messages.append({"role": role, "parts": [text]})
    # Add current user message
    gemini_messages.append({"role": "user", "parts": [req.message]})

    try:
        response = await chat_completion(
            gemini_messages,
            system_instruction=system_prompt,
            temperature=0.7,
        )

        # Save to memory
        messages.append({"role": "user", "text": req.message, "ts": datetime.now(timezone.utc).isoformat()})
        messages.append({"role": "buddy", "text": response, "ts": datetime.now(timezone.utc).isoformat()})
        _save_memory(user["id"], memory_id, messages, preferences)

        return {"response": response}
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
