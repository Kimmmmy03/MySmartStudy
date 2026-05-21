"""
Pattern 2 — Graph-RAG using LangChain.

Mirrors backend/app/knowledge_graph_service.py.
Uses LLMGraphTransformer to extract entities + relations from your lecture,
stores them in an in-memory NetworkX graph (no Neo4j needed), and does
BFS-depth-2 traversal to find related concepts.

How to run:
    cd langchain_integration
    python 02_graph_rag.py
"""

import os
import json
from collections import deque
from dotenv import load_dotenv

import networkx as nx
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import TextLoader
from langchain_experimental.graph_transformers import LLMGraphTransformer

load_dotenv()

# ─── 1. Load the lecture (same source as Pattern 1) ───
loader = TextLoader("data/db_lecture.txt", encoding="utf-8")
documents = loader.load()

# ─── 2. LLM-driven graph extraction (same concept extraction your service.py does) ───
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.2,
)

# Constrain the relation types — same vocabulary your real backend uses
graph_transformer = LLMGraphTransformer(
    llm=llm,
    allowed_nodes=["Concept", "Fact", "Definition", "Example", "Process"],
    allowed_relationships=[
        "REQUIRES", "PART_OF", "RELATED_TO", "LEADS_TO", "CONTRASTS", "EXAMPLE_OF",
    ],
)

print("Extracting entities and relations... (calls Gemini)")
graph_documents = graph_transformer.convert_to_graph_documents(documents)
print(f"Extracted {len(graph_documents[0].nodes)} nodes, "
      f"{len(graph_documents[0].relationships)} relationships")

# ─── 3. Convert to your real backend's Firestore JSON shape ───
all_nodes = {}
all_edges = []
for gd in graph_documents:
    for n in gd.nodes:
        if n.id not in all_nodes:
            all_nodes[n.id] = {
                "label": n.id,
                "type": n.type.lower(),
                "sources": ["db_lecture_1"],
                "weight": 1,
            }
        else:
            all_nodes[n.id]["weight"] += 1
    for r in gd.relationships:
        all_edges.append({
            "source": r.source.id,
            "target": r.target.id,
            "relation": r.type.lower(),
        })

# Dedupe edges (same as your real backend)
seen = set()
unique_edges = []
for e in all_edges:
    key = (e["source"], e["target"], e["relation"])
    if key not in seen:
        seen.add(key)
        unique_edges.append(e)

# Final shape — identical to what knowledgeGraphs/{courseId} stores in Firestore
graph_doc = {
    "courseId": "db101",
    "nodes": all_nodes,
    "edges": unique_edges,
    "nodeCount": len(all_nodes),
    "edgeCount": len(unique_edges),
}

os.makedirs("./graph_storage", exist_ok=True)
with open("./graph_storage/firestore_shaped.json", "w") as f:
    json.dump(graph_doc, f, indent=2)
print("Saved graph in Firestore shape to ./graph_storage/firestore_shaped.json")

print("\nA few triplets the LLM extracted:")
for e in unique_edges[:8]:
    src = all_nodes[e["source"]]["label"]
    tgt = all_nodes[e["target"]]["label"]
    print(f"  {src}  --[{e['relation']}]-->  {tgt}")

# ─── 4. Also build a NetworkX graph for visualisation + alternative BFS ───
G = nx.DiGraph()
for nid, n in all_nodes.items():
    G.add_node(nid, label=n["label"], type=n["type"], weight=n["weight"])
for e in unique_edges:
    G.add_edge(e["source"], e["target"], relation=e["relation"])

# ─── 5. BFS query (mirrors knowledge_graph_service.query_related_concepts) ───
def query_related_concepts(graph_dict: dict, concepts: list[str], depth: int = 2) -> dict:
    """Pure-Python BFS — same algorithm as your real backend."""
    nodes_map = graph_dict["nodes"]
    edges = graph_dict["edges"]

    # Bidirectional adjacency for undirected traversal
    adjacency: dict[str, list[dict]] = {}
    for edge in edges:
        adjacency.setdefault(edge["source"], []).append(edge)
        adjacency.setdefault(edge["target"], []).append(
            {"source": edge["target"], "target": edge["source"], "relation": edge["relation"]}
        )

    concept_lower = [c.lower() for c in concepts]
    start_ids = {
        nid for nid, n in nodes_map.items()
        for cl in concept_lower
        if cl in n["label"].lower() or n["label"].lower() in cl
    }
    if not start_ids:
        return {"nodes": {}, "edges": []}

    visited = set(start_ids)
    queue = deque((sid, 0) for sid in start_ids)
    result_nodes, result_edges = {}, []
    while queue:
        node_id, d = queue.popleft()
        if node_id in nodes_map:
            result_nodes[node_id] = nodes_map[node_id]
        if d >= depth:
            continue
        for edge in adjacency.get(node_id, []):
            result_edges.append({
                "source": edge["source"], "target": edge["target"], "relation": edge["relation"]
            })
            if edge["target"] not in visited:
                visited.add(edge["target"])
                queue.append((edge["target"], d + 1))
    return {"nodes": result_nodes, "edges": result_edges}


print("\n--- BFS depth=2 starting from 'ER' ---")
subgraph = query_related_concepts(graph_doc, ["ER"], depth=2)
print(f"Subgraph: {len(subgraph['nodes'])} nodes, {len(subgraph['edges'])} edges")
for nid, n in subgraph["nodes"].items():
    print(f"  • {n['label']} ({n['type']})")
