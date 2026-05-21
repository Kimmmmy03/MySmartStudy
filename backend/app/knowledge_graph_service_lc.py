"""
Graph-RAG via LangChain — the AI_BACKEND=framework implementation.

Reimplements ONLY the LLM-driven graph build using LangChain's
LLMGraphTransformer.  The output is converted back into the exact Firestore
shape the rest of the app expects:

    knowledgeGraphs/{courseId} = {
        courseId, nodes: {id: {label, type, sources, weight}},
        edges: [{source, target, relation}], nodeCount, edgeCount, lastUpdatedAt
    }

query_related_concepts (BFS) and the plagiarism similarity graph are pure
Python / maths — they are NOT reimplemented; the dispatcher keeps using the
legacy versions for those.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Relation vocabulary — same set the legacy concept-extraction prompt allows
_ALLOWED_NODES = ["Concept", "Fact", "Definition", "Example", "Process"]
_ALLOWED_RELATIONSHIPS = [
    "REQUIRES", "PART_OF", "RELATED_TO", "LEADS_TO", "CONTRASTS", "EXAMPLE_OF",
]


def _build_graph_sync(course_id: str, samples: list[dict]) -> dict | None:
    """Blocking graph build — run inside asyncio.to_thread."""
    from langchain_core.documents import Document
    from langchain_experimental.graph_transformers import LLMGraphTransformer

    from .ai_framework import get_chat_llm

    documents = [
        Document(
            page_content=s["text"],
            metadata={"doc_id": s["doc_id"], "doc_type": s["doc_type"], "title": s["title"]},
        )
        for s in samples
        if s.get("text")
    ]
    if not documents:
        return None

    transformer = LLMGraphTransformer(
        llm=get_chat_llm(fast=False, temperature=0.2),
        allowed_nodes=_ALLOWED_NODES,
        allowed_relationships=_ALLOWED_RELATIONSHIPS,
    )
    graph_documents = transformer.convert_to_graph_documents(documents)

    # Convert LangChain graph -> legacy Firestore shape
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    for gd in graph_documents:
        src_ids = [d.metadata.get("doc_id", "") for d in [gd.source]] if gd.source else []
        for n in gd.nodes:
            nid = str(n.id)
            if nid in nodes:
                nodes[nid]["weight"] += 1
            else:
                nodes[nid] = {
                    "label": str(n.id),
                    "type": (n.type or "concept").lower(),
                    "sources": list(src_ids),
                    "weight": 1,
                }
        for r in gd.relationships:
            s, t = str(r.source.id), str(r.target.id)
            if s in nodes and t in nodes:
                edges.append({
                    "source": s,
                    "target": t,
                    "relation": (r.type or "related_to").lower(),
                    "weight": 1,
                })

    if not nodes:
        return None

    # Dedupe edges — same logic as the legacy build
    seen = set()
    unique_edges = []
    for e in edges:
        key = (e["source"], e["target"], e["relation"])
        if key not in seen:
            seen.add(key)
            unique_edges.append(e)

    return {
        "courseId": course_id,
        "nodes": nodes,
        "edges": unique_edges,
        "nodeCount": len(nodes),
        "edgeCount": len(unique_edges),
        "lastUpdatedAt": datetime.now(timezone.utc).isoformat(),
    }


async def build_course_graph(course_id: str):
    """Build the per-course concept graph with LangChain and persist to Firestore.
    Same public behaviour as knowledge_graph_service.build_course_graph."""
    from . import ai_service, models, rag_service
    from .firestore import db

    logger.info("Framework: building knowledge graph for course %s", course_id)
    ai_service._enforce_ai_gate()

    # Collect first-chunk samples per indexed document (same as legacy)
    state_docs = (
        db.collection(models.RAG_INDEX_STATE)
        .where("courseId", "==", course_id)
        .get()
    )
    if not state_docs:
        logger.info("No indexed content for %s, skipping graph build", course_id)
        return

    samples: list[dict] = []
    collection = rag_service._get_collection(course_id)
    for sd in state_docs:
        data = sd.to_dict()
        doc_id = data.get("docId", "")
        try:
            result = collection.get(ids=[f"{doc_id}_chunk_0"], include=["documents"])
            if result and result["documents"]:
                samples.append({
                    "doc_id": doc_id,
                    "doc_type": data.get("docType", ""),
                    "title": data.get("title", ""),
                    "text": result["documents"][0][:1500],
                })
        except Exception:
            pass

    if not samples:
        return

    graph_data = await asyncio.to_thread(_build_graph_sync, course_id, samples)
    if not graph_data:
        return

    db.collection(models.KNOWLEDGE_GRAPHS).document(course_id).set(graph_data)
    logger.info(
        "Framework: built KG for course %s — %d nodes, %d edges",
        course_id, graph_data["nodeCount"], graph_data["edgeCount"],
    )
