# Knowledge Graph Flow

## Overview
Per-course concept graphs extracted from indexed content via Gemini. Used for mind map suggestions (concept connections) and plagiarism detection (embedding-based similarity graphs with cluster detection).

## Flowchart

```mermaid
flowchart TD
    subgraph Build Course Concept Graph - build_course_graph
        BUILD_START([Trigger: manual or after RAG indexing]) --> GET_STATE[Get ragIndexState docs for course]
        GET_STATE --> BATCH[Batch 5 documents at a time]
        BATCH --> EXTRACT_LOOP[For each batch of documents]

        EXTRACT_LOOP --> LOAD_CONTENT[Load document content from ragIndexState]
        LOAD_CONTENT --> GEMINI_EXTRACT[Gemini: extract concepts and relationships from content]

        subgraph Concept Extraction Prompt
            GEMINI_EXTRACT --> PROMPT["Extract concepts as JSON: concepts with id, label, type, sources + relationships with source_id, target_id, relation"]
            PROMPT --> TYPES["Concept types: concept, fact, definition, example, process"]
            TYPES --> RELATIONS["Relation types: requires, part_of, related_to, leads_to, contrasts, example_of"]
        end

        GEMINI_EXTRACT --> PARSE[Parse JSON response]
        PARSE --> MERGE[Merge new concepts into graph]
        MERGE --> DEDUP[Deduplicate by label - case insensitive]
        DEDUP --> NEXT{More batches?}
        NEXT -->|Yes| EXTRACT_LOOP
        NEXT -->|No| PERSIST[Save graph to Firestore knowledgeGraphs collection]

        subgraph Graph Structure
            PERSIST --> STORE_NODES["nodes: {id: {label, type, weight, sources[]}}"]
            PERSIST --> STORE_EDGES["edges: [{source, target, relation, weight}]"]
            PERSIST --> STORE_META["courseId, updatedAt, nodeCount, edgeCount"]
        end
    end

    subgraph Query Related Concepts - query_related_concepts
        QUERY_START([Input: course_id, concept labels, depth]) --> LOAD_GRAPH[Load graph from Firestore]
        LOAD_GRAPH --> FIND_SEEDS[Find seed nodes by label match - case insensitive]
        FIND_SEEDS --> BFS[BFS traversal from seed nodes]

        subgraph BFS Traversal
            BFS --> LEVEL_0[Level 0: seed nodes]
            LEVEL_0 --> EXPAND_1[Expand: find all edges from current nodes]
            EXPAND_1 --> LEVEL_1[Level 1: directly connected concepts]
            LEVEL_1 --> DEPTH_CHECK{depth reached?}
            DEPTH_CHECK -->|No| EXPAND_2[Expand again: find edges from level 1 nodes]
            EXPAND_2 --> LEVEL_2[Level 2: second-degree connections]
            DEPTH_CHECK -->|Yes| COLLECT
        end

        COLLECT[Collect all discovered nodes + edges]
        COLLECT --> SUBGRAPH_RETURN[Return subgraph: result_nodes + result_edges]
    end

    subgraph Build Similarity Graph - build_similarity_graph
        SIM_START([Input: assignment_id]) --> FETCH_SUBS[Fetch all submissions for assignment]
        FETCH_SUBS --> EXTRACT_CONTENT[Extract content from each submission]

        subgraph Content Extraction
            EXTRACT_CONTENT --> SUB_TYPE{Submission type?}
            SUB_TYPE -->|Mind map| EXT_MAP[Load map nodesText]
            SUB_TYPE -->|PDF link| EXT_PDF[PyPDF2 text extraction]
            SUB_TYPE -->|Text| EXT_TEXT[Use comments field]
            EXT_MAP --> CONTENT_LIST
            EXT_PDF --> CONTENT_LIST
            EXT_TEXT --> CONTENT_LIST
            CONTENT_LIST[Collect all student contents]
        end

        CONTENT_LIST --> BATCH_EMBED[Batch embed all contents with Gemini text-embedding-004]
        BATCH_EMBED --> PAIRWISE[Compute pairwise cosine similarity]

        subgraph Similarity Matrix
            PAIRWISE --> FOR_EACH_PAIR[For each pair of students]
            FOR_EACH_PAIR --> COSINE[Cosine similarity = dot product / norms]
            COSINE --> THRESHOLD{similarity >= 0.3?}
            THRESHOLD -->|Yes| ADD_EDGE[Add edge: source, target, similarity score]
            THRESHOLD -->|No| SKIP_PAIR[Skip pair]
        end

        ADD_EDGE --> BUILD_SIM_GRAPH[Build graph: nodes=students, edges=similarities]
        BUILD_SIM_GRAPH --> RETURN_SIM[Return: nodes, edges, submission_contents]
    end

    subgraph Detect Clusters - detect_clusters
        CLUSTER_START([Input: similarity_graph, threshold=0.7]) --> FILTER_EDGES[Filter edges: similarity >= threshold]
        FILTER_EDGES --> ADJ_LIST[Build adjacency list from filtered edges]
        ADJ_LIST --> COMPONENTS[Find connected components via BFS]

        subgraph Connected Components BFS
            COMPONENTS --> VISITED[Track visited nodes]
            VISITED --> BFS_LOOP[For each unvisited node]
            BFS_LOOP --> BFS_EXPAND[BFS: explore all reachable nodes via filtered edges]
            BFS_EXPAND --> FORM_CLUSTER[Form cluster from all reachable nodes]
            FORM_CLUSTER --> SIZE_CHECK{Cluster size >= 2?}
            SIZE_CHECK -->|Yes| KEEP[Add to flagged clusters]
            SIZE_CHECK -->|No| DISCARD[Single node - not plagiarism]
        end

        KEEP --> RETURN_CLUSTERS[Return list of clusters: lists of student_ids]
    end

    subgraph Consumers
        SUBGRAPH_RETURN --> USE_BUDDY[MindMap Buddy: suggest nodes with concept connections]
        RETURN_SIM --> USE_PLAG[Plagiarism: GAG report + network visualization]
        RETURN_CLUSTERS --> USE_PLAG
    end
```

## Key Files
- `backend/app/knowledge_graph_service.py` — build_course_graph, query_related_concepts, build_similarity_graph, detect_clusters
- `backend/app/rag_service.py` — embed_texts() used for similarity embeddings
- `backend/app/routers/ai_mindmap_buddy.py` — Consumer: node suggestions
- `backend/app/routers/ai_plagiarism.py` — Consumer: plagiarism analysis
