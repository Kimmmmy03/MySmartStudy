# AI Plagiarism Detection Flow

## Overview
Plagiarism detection system using embedding-based similarity analysis, cluster detection, and GAG narrative report generation. Supports single submission checks and full assignment network analysis.

## Flowchart

```mermaid
flowchart TD
    subgraph Single Submission Check
        SINGLE_START([Lecturer clicks Check Plagiarism on submission]) --> SINGLE_API[POST /api/ai/plagiarism/analyze/submission_id]
        SINGLE_API --> SINGLE_CACHE{Cached report?}
        SINGLE_CACHE -->|Yes| SINGLE_RETURN[Return cached report]
        SINGLE_CACHE -->|No| SINGLE_EXTRACT[Extract submission content]
        SINGLE_EXTRACT --> SINGLE_EMBED[Embed content with Gemini text-embedding-004]
        SINGLE_EMBED --> SINGLE_SEARCH[Search all submissions in same assignment]
        SINGLE_SEARCH --> SINGLE_COMPARE[Compute cosine similarity with each]
        SINGLE_COMPARE --> SINGLE_FLAG[Flag matches above threshold]
        SINGLE_FLAG --> SINGLE_SAVE[Cache report in Firestore]
        SINGLE_SAVE --> SINGLE_RETURN
    end

    subgraph Assignment Network Analysis
        NET_START([Lecturer clicks Analyze Assignment Plagiarism]) --> NET_API[POST /api/ai/plagiarism/analyze-assignment/assignment_id]

        NET_API --> FETCH_SUBS[Fetch all submissions for assignment]
        FETCH_SUBS --> BUILD_GRAPH[Knowledge Graph: build_similarity_graph]

        subgraph Embedding Phase
            BUILD_GRAPH --> EXTRACT_ALL[Extract content from each submission]
            EXTRACT_ALL --> CONTENT_TYPE{Content type?}
            CONTENT_TYPE -->|Mind map| EXTRACT_NODES[Extract nodesText from map]
            CONTENT_TYPE -->|PDF| EXTRACT_PDF[PyPDF2 text extraction]
            CONTENT_TYPE -->|Text| EXTRACT_COMMENTS[Use comments field]
            EXTRACT_NODES --> BATCH_EMBED
            EXTRACT_PDF --> BATCH_EMBED
            EXTRACT_COMMENTS --> BATCH_EMBED
            BATCH_EMBED[Batch embed all submissions with Gemini]
        end

        subgraph Similarity Computation
            BATCH_EMBED --> PAIRWISE[Compute pairwise cosine similarity]
            PAIRWISE --> BUILD_EDGES[Create edges for similarity >= 0.3]
            BUILD_EDGES --> SIM_GRAPH[Build similarity graph: nodes + edges]
        end

        subgraph Cluster Detection
            SIM_GRAPH --> DETECT[detect_clusters with threshold=0.7]
            DETECT --> CONNECTED[Find connected components via BFS]
            CONNECTED --> CLUSTERS[List of flagged clusters: groups of student IDs]
        end

        CLUSTERS --> GAG_REPORT[GAG: generate_plagiarism_network_report]

        subgraph GAG Report Generation
            GAG_REPORT --> PLAG_PROMPT[Build prompt with cluster content + high-similarity pairs]
            PLAG_PROMPT --> PLAG_ANALYZE[Analyze: shared content, intentional vs coincidental, severity]
            PLAG_ANALYZE --> GEMINI[Gemini 2.5 Flash with plagiarism knowledge base]
            GEMINI --> PARSE_RESULT[Parse JSON response]
        end

        PARSE_RESULT --> RESULT_STRUCT[Structured result]

        subgraph Result Structure
            RESULT_STRUCT --> R_CLUSTERS[flagged_clusters: students, max_similarity, analysis]
            RESULT_STRUCT --> R_SUMMARY[summary: 2-3 sentence overall assessment]
            RESULT_STRUCT --> R_GRAPH[network_graph: nodes + edges for visualization]
        end

        RESULT_STRUCT --> RETURN_REPORT[Return complete report]
    end

    subgraph Display Report
        SINGLE_RETURN --> DISPLAY
        RETURN_REPORT --> DISPLAY

        DISPLAY[Render Plagiarism Report]
        DISPLAY --> NET_VIS[Network visualization: student nodes + similarity edges]
        NET_VIS --> CLUSTER_CARDS[Flagged cluster cards with analysis]
        CLUSTER_CARDS --> PAIR_TABLE[High-similarity pair table with percentages]
        PAIR_TABLE --> NARRATIVE[Overall narrative summary]
        NARRATIVE --> ACTIONS[Lecturer can: investigate further, take action]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/lecturer/course/[cid]/plagiarism/page.tsx` — Plagiarism detection page
- `frontend-web/src/components/ai-plagiarism-report.tsx` — Report visualization
- `frontend-web/src/lib/api.ts` — aiPlagiarismApi namespace
- `backend/app/routers/ai_plagiarism.py` — Analyze single, analyze assignment endpoints
- `backend/app/knowledge_graph_service.py` — build_similarity_graph(), detect_clusters()
- `backend/app/gag_service.py` — generate_plagiarism_network_report()
