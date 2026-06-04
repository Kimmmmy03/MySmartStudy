"""
Knowledge Graph Service.

Builds per-course concept graphs from indexed content using Gemini
for concept extraction. Supports BFS traversal for related concepts
and pairwise cosine similarity for plagiarism detection.

Graphs are persisted in Firestore `knowledgeGraphs` collection.
"""

import asyncio
import logging
import os
from collections import deque
from typing import Optional

from . import models, rag_service
from .ai_service import generate_json
from .firestore import db

logger = logging.getLogger(__name__)


# ── Graph building ──

async def build_course_graph(course_id: str):
    """Extract concepts from all indexed content and build a knowledge graph.

    Uses Gemini to extract concepts and relationships from RAG-indexed
    content, then stores the graph in Firestore.
    """
    # Dispatch to the LangChain implementation when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import knowledge_graph_service_lc
        return await knowledge_graph_service_lc.build_course_graph(course_id)

    logger.info("Building knowledge graph for course %s", course_id)

    # Get all indexed documents for this course
    state_docs = db.collection(models.RAG_INDEX_STATE).where(
        "courseId", "==", course_id
    ).get()

    if not state_docs:
        logger.info("No indexed content for course %s, skipping graph build", course_id)
        return

    # Collect content samples from each indexed document type
    content_samples = []
    for sd in state_docs:
        data = sd.to_dict()
        doc_id = data.get("docId", "")
        doc_type = data.get("docType", "")
        title = data.get("title", "")

        # Retrieve the first chunk of each document from ChromaDB
        try:
            collection = rag_service._get_collection(course_id)
            chunk_id = f"{doc_id}_chunk_0"
            result = collection.get(ids=[chunk_id], include=["documents"])
            if result and result["documents"]:
                text = result["documents"][0][:1500]
                content_samples.append({
                    "doc_id": doc_id,
                    "doc_type": doc_type,
                    "title": title,
                    "text": text,
                })
        except Exception:
            pass

    if not content_samples:
        return

    # Process in batches of 5 documents to stay within prompt limits
    all_nodes = {}
    all_edges = []

    for i in range(0, len(content_samples), 5):
        batch = content_samples[i : i + 5]
        content_text = ""
        for sample in batch:
            content_text += f"\n--- {sample['title']} ({sample['doc_type']}) ---\n"
            content_text += sample["text"] + "\n"

        prompt = f"""Extract key concepts and their relationships from these course materials.

CONTENT:
{content_text[:6000]}

Return JSON:
{{
  "concepts": [
    {{
      "id": "<short_unique_id>",
      "label": "<concept name>",
      "type": "concept" | "fact" | "definition" | "example" | "process",
      "sources": ["<doc_id>"]
    }}
  ],
  "relationships": [
    {{
      "source": "<concept_id>",
      "target": "<concept_id>",
      "relation": "requires" | "part_of" | "related_to" | "leads_to" | "contrasts" | "example_of"
    }}
  ]
}}

Extract 10-20 key concepts and their most important relationships. Focus on educational concepts."""

        try:
            result = await generate_json(prompt, temperature=0.2)
            concepts = result.get("concepts", [])
            relationships = result.get("relationships", [])

            source_ids = [s["doc_id"] for s in batch]

            for c in concepts:
                cid = c.get("id", "")
                if not cid:
                    continue
                if cid in all_nodes:
                    # Merge sources
                    existing_sources = set(all_nodes[cid].get("sources", []))
                    existing_sources.update(c.get("sources", source_ids))
                    all_nodes[cid]["sources"] = list(existing_sources)
                    all_nodes[cid]["weight"] = all_nodes[cid].get("weight", 1) + 1
                else:
                    all_nodes[cid] = {
                        "label": c.get("label", cid),
                        "type": c.get("type", "concept"),
                        "sources": c.get("sources", source_ids),
                        "weight": 1,
                    }

            for r in relationships:
                src = r.get("source", "")
                tgt = r.get("target", "")
                if src and tgt and src in all_nodes and tgt in all_nodes:
                    all_edges.append({
                        "source": src,
                        "target": tgt,
                        "relation": r.get("relation", "related_to"),
                        "weight": 1,
                    })
        except Exception as e:
            logger.error("Concept extraction batch %d failed: %s", i, e)

    if not all_nodes:
        return

    # Deduplicate edges
    seen_edges = set()
    unique_edges = []
    for edge in all_edges:
        key = (edge["source"], edge["target"], edge["relation"])
        if key not in seen_edges:
            seen_edges.add(key)
            unique_edges.append(edge)

    # Store in Firestore
    from datetime import datetime, timezone

    graph_data = {
        "courseId": course_id,
        "nodes": all_nodes,
        "edges": unique_edges,
        "nodeCount": len(all_nodes),
        "edgeCount": len(unique_edges),
        "lastUpdatedAt": datetime.now(timezone.utc).isoformat(),
    }
    db.collection(models.KNOWLEDGE_GRAPHS).document(course_id).set(graph_data)

    logger.info(
        "Built knowledge graph for course %s: %d nodes, %d edges",
        course_id, len(all_nodes), len(unique_edges),
    )


# ── Graph retrieval ──

def get_course_graph(course_id: str) -> Optional[dict]:
    """Load the knowledge graph for a course from Firestore."""
    doc = db.collection(models.KNOWLEDGE_GRAPHS).document(course_id).get()
    if not doc.exists:
        return None
    return doc.to_dict()


def query_related_concepts(
    course_id: str,
    concepts: list[str],
    depth: int = 2,
) -> dict:
    """BFS traversal from the given concept labels to find related concepts.

    Returns a subgraph: {nodes: {id: node_data}, edges: [{source, target, relation}]}.
    """
    graph = get_course_graph(course_id)
    if not graph:
        return {"nodes": {}, "edges": []}

    all_nodes = graph.get("nodes", {})
    all_edges = graph.get("edges", [])

    # Build adjacency list
    adjacency: dict[str, list[dict]] = {}
    for edge in all_edges:
        src = edge["source"]
        tgt = edge["target"]
        adjacency.setdefault(src, []).append(edge)
        adjacency.setdefault(tgt, []).append({
            "source": tgt,
            "target": src,
            "relation": edge.get("relation", "related_to"),
            "weight": edge.get("weight", 1),
        })

    # Find starting node IDs by matching concept labels (case-insensitive)
    concept_labels_lower = [c.lower() for c in concepts]
    start_ids = set()
    for nid, node in all_nodes.items():
        label = node.get("label", "").lower()
        for cl in concept_labels_lower:
            if cl in label or label in cl:
                start_ids.add(nid)

    if not start_ids:
        return {"nodes": {}, "edges": []}

    # BFS
    visited = set()
    queue = deque()
    for sid in start_ids:
        queue.append((sid, 0))
        visited.add(sid)

    result_nodes = {}
    result_edges = []

    while queue:
        node_id, current_depth = queue.popleft()

        if node_id in all_nodes:
            result_nodes[node_id] = all_nodes[node_id]

        if current_depth >= depth:
            continue

        for edge in adjacency.get(node_id, []):
            target = edge["target"]
            result_edges.append({
                "source": edge["source"],
                "target": target,
                "relation": edge.get("relation", "related_to"),
            })
            if target not in visited:
                visited.add(target)
                queue.append((target, current_depth + 1))

    # Deduplicate edges in result
    seen = set()
    unique_result_edges = []
    for e in result_edges:
        key = (e["source"], e["target"])
        if key not in seen:
            seen.add(key)
            unique_result_edges.append(e)

    return {"nodes": result_nodes, "edges": unique_result_edges}


# ── Similarity graph (for plagiarism) ──

async def build_similarity_graph(assignment_id: str) -> dict:
    """Build a pairwise cosine similarity graph for all submissions of an assignment.

    Returns {nodes: [{id, name}], edges: [{source, target, similarity}]}.
    """
    from google.cloud.firestore_v1.base_query import FieldFilter

    sub_docs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()

    submissions = []
    contents = {}
    for sd in sub_docs:
        sub = sd.to_dict()
        student_id = sub.get("studentId", "")
        student_name = sub.get("studentName", student_id)

        # Extract content
        content = ""
        if sub.get("submissionType") == "map" and sub.get("mapId"):
            map_doc = db.collection(models.MAPS).document(sub["mapId"]).get()
            if map_doc.exists:
                content = map_doc.to_dict().get("nodesText", "")
        elif sub.get("filePath"):
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(sub["filePath"])
                content = "\n".join(page.extract_text() or "" for page in reader.pages)
            except Exception:
                content = sub.get("comments", "")
        else:
            content = sub.get("comments", "") or sub.get("externalLink", "")

        if content and len(content.strip()) >= 20:
            submissions.append({
                "id": student_id,
                "name": student_name,
                "content": content,
            })
            contents[student_id] = content

    if len(submissions) < 2:
        return {"nodes": [], "edges": [], "submission_contents": contents}

    # Embed all submissions
    texts = [s["content"][:3000] for s in submissions]
    embeddings = await rag_service.embed_texts(texts)

    # Compute pairwise cosine similarity
    edge_threshold = float(os.getenv("PLAGIARISM_EDGE_THRESHOLD", "0.3"))
    nodes = [{"id": s["id"], "name": s["name"]} for s in submissions]
    edges = []

    for i in range(len(submissions)):
        for j in range(i + 1, len(submissions)):
            sim = _cosine_similarity(embeddings[i], embeddings[j])
            if sim >= edge_threshold:  # Only include edges above a minimum threshold
                edges.append({
                    "source": submissions[i]["id"],
                    "target": submissions[j]["id"],
                    "similarity": round(sim, 4),
                })

    return {"nodes": nodes, "edges": edges, "submission_contents": contents}


def detect_clusters(graph: dict, threshold: float = 0.7) -> list[list[str]]:
    """Detect clusters of high-similarity submissions using connected components.

    Returns list of clusters, where each cluster is a list of student IDs.
    """
    edges = graph.get("edges", [])

    # Build adjacency list for edges above threshold
    adjacency: dict[str, set[str]] = {}
    for edge in edges:
        if edge.get("similarity", 0) >= threshold:
            src = edge["source"]
            tgt = edge["target"]
            adjacency.setdefault(src, set()).add(tgt)
            adjacency.setdefault(tgt, set()).add(src)

    # Find connected components
    visited: set[str] = set()
    clusters: list[list[str]] = []

    for node in adjacency:
        if node in visited:
            continue
        # BFS to find connected component
        component = []
        queue = deque([node])
        visited.add(node)
        while queue:
            current = queue.popleft()
            component.append(current)
            for neighbor in adjacency.get(current, set()):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        if len(component) >= 2:
            clusters.append(component)

    return clusters


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _submission_content(sub: dict) -> str:
    """Extract comparable text from a submission (map nodes, PDF, comments, link)."""
    content = ""
    if sub.get("submissionType") == "map" and sub.get("mapId"):
        map_doc = db.collection(models.MAPS).document(sub["mapId"]).get()
        if map_doc.exists:
            content = map_doc.to_dict().get("nodesText", "")
    elif sub.get("filePath"):
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(sub["filePath"])
            content = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            content = sub.get("comments", "")
    else:
        content = sub.get("comments", "") or sub.get("externalLink", "")
    return content or ""


async def check_historical_corpus(assignment_id: str) -> dict:
    """Cross-assignment plagiarism check (semantic).

    Intra-assignment comparison cannot catch a student reusing work from a
    *different* assignment or a prior cohort. This embeds the current
    assignment's submissions and compares them (cosine similarity over Gemini
    embeddings) against submissions from every OTHER assignment in the same
    course, flagging high-similarity historical matches.

    Returns {historical_matches: [...], compared_against: <count>}; degrades to
    an empty result if embeddings are unavailable (no API key / quota).
    """
    from google.cloud.firestore_v1.base_query import FieldFilter

    a_doc = db.collection(models.ASSIGNMENTS).document(assignment_id).get()
    if not a_doc.exists:
        return {"historical_matches": [], "compared_against": 0}
    assignment = a_doc.to_dict()
    course_id = assignment.get("courseId", "")

    threshold = float(os.getenv("PLAGIARISM_HISTORICAL_THRESHOLD", "0.78"))

    # Current submissions
    cur_docs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()
    current = []
    for d in cur_docs:
        s = d.to_dict()
        text = _submission_content(s)
        if text and len(text.strip()) >= 20:
            current.append({
                "student_id": s.get("studentId", ""),
                "student_name": s.get("studentName", s.get("studentId", "")),
                "content": text,
            })
    if not current:
        return {"historical_matches": [], "compared_against": 0}

    # Archive = submissions from OTHER assignments in the same course
    other_assignments = db.collection(models.ASSIGNMENTS).where(
        filter=FieldFilter("courseId", "==", course_id)
    ).get()
    archive = []
    for ad in other_assignments:
        if ad.id == assignment_id:
            continue
        a = ad.to_dict()
        a_title = a.get("title", "Untitled")
        sub_docs = db.collection(models.SUBMISSIONS).where(
            filter=FieldFilter("assignmentId", "==", ad.id)
        ).get()
        for sd in sub_docs:
            s = sd.to_dict()
            text = _submission_content(s)
            if text and len(text.strip()) >= 20:
                archive.append({
                    "student_id": s.get("studentId", ""),
                    "student_name": s.get("studentName", s.get("studentId", "")),
                    "assignment_id": ad.id,
                    "assignment_title": a_title,
                    "content": text,
                })
    if not archive:
        return {"historical_matches": [], "compared_against": 0}

    # Embed everything in one batched pass (truncate long texts like the
    # intra-assignment graph does).
    cur_texts = [c["content"][:3000] for c in current]
    arc_texts = [a["content"][:3000] for a in archive]
    try:
        embeddings = await rag_service.embed_texts(cur_texts + arc_texts)
    except Exception as e:
        logger.warning("Historical corpus embedding failed: %s", e)
        return {"historical_matches": [], "compared_against": len(archive)}

    cur_emb = embeddings[: len(current)]
    arc_emb = embeddings[len(current):]

    matches = []
    for i, c in enumerate(current):
        best_sim = 0.0
        best_src = None
        for j, a in enumerate(archive):
            sim = _cosine_similarity(cur_emb[i], arc_emb[j])
            if sim > best_sim:
                best_sim = sim
                best_src = a
        if best_src and best_sim >= threshold:
            matches.append({
                "student_id": c["student_id"],
                "student_name": c["student_name"],
                "similarity": round(best_sim, 4),
                "source_assignment_id": best_src["assignment_id"],
                "source_assignment_title": best_src["assignment_title"],
                "source_student_name": best_src["student_name"],
            })

    matches.sort(key=lambda m: m["similarity"], reverse=True)
    return {"historical_matches": matches, "compared_against": len(archive)}
