# GAG Pipeline Flow

## Overview
Generation-Augmented Generation (GAG) service produces structured JSON artifacts beyond simple text responses. Takes RAG-retrieved context and generates study plans, grading reports, graph suggestions, and plagiarism network reports.

## Flowchart

```mermaid
flowchart TD
    subgraph GAG Overview
        INPUT([Structured input data]) --> SELECT{Which artifact to generate?}
        SELECT -->|Study Plan| STUDY_PLAN[generate_study_plan_artifact]
        SELECT -->|Grading Report| GRADING[generate_grading_report]
        SELECT -->|Graph Suggestions| GRAPH[generate_graph_suggestions]
        SELECT -->|Plagiarism Report| PLAGIARISM[generate_plagiarism_network_report]
    end

    subgraph Study Plan Artifact
        STUDY_PLAN --> SP_INPUT[Inputs: student_context, rag_chunks, deadlines, exam_info]

        SP_INPUT --> SP_PERF[Build performance string from quiz scores + assignment grades]
        SP_PERF --> SP_WEAK[List weak areas - scored below 60 percent]
        SP_WEAK --> SP_TT[Build timetable string from all saved timetables]
        SP_TT --> SP_RAG[Format RAG context + citations from chunks]
        SP_RAG --> SP_DEADLINES[Format upcoming deadlines with status]

        SP_DEADLINES --> SP_PROMPT[Assemble prompt]
        SP_PROMPT --> SP_RULES["Scheduling rules: fit study in free gaps, never overlap classes, AM/PM format, chronological order"]
        SP_RULES --> SP_SCHEMA["JSON schema: recommendations with course, topic, priority, suggested_time, reason, estimated_time, difficulty_rating, resource_links, suggested_activities + daily_schedule_summary + motivational_message"]
        SP_SCHEMA --> SP_GEMINI[Gemini: generate_json with study_plan knowledge base]
        SP_GEMINI --> SP_ENRICH[Enrich empty resource_links from RAG sources]
        SP_ENRICH --> SP_RETURN[Return structured study plan]
    end

    subgraph Grading Report
        GRADING --> GR_INPUT[Inputs: submission_content, rubric, rag_chunks, assignment_info]

        GR_INPUT --> GR_RAG[Format RAG context from similar submissions]
        GR_RAG --> GR_RUBRIC[Format rubric criteria with max points]
        GR_RUBRIC --> GR_STATS[Format class statistics: mean, median, count]

        GR_STATS --> GR_PROMPT[Assemble grading prompt]
        GR_PROMPT --> GR_SCHEMA["JSON schema: recommended_grade, criterion_scores, justification, confidence, comparative_analysis, improvement_suggestions with resource_links"]
        GR_SCHEMA --> GR_GEMINI[Gemini: generate_json with grading knowledge base]
        GR_GEMINI --> GR_ENRICH[Ensure improvement suggestions have resource links]
        GR_ENRICH --> GR_RETURN[Return structured grading report]
    end

    subgraph Graph Suggestions for Mind Maps
        GRAPH --> GS_INPUT[Inputs: map_nodes, map_edges, rag_chunks, concept_subgraph, map_title]

        GS_INPUT --> GS_LABELS[Extract existing node labels]
        GS_LABELS --> GS_RAG[Format RAG context from course materials]
        GS_RAG --> GS_KG[Format knowledge graph: concept nodes + relationship edges]

        GS_KG --> GS_PROMPT[Assemble suggestion prompt]
        GS_PROMPT --> GS_SCHEMA["JSON schema: suggestions with label, description, parent_label, source, graph_connections + related_concepts_graph with nodes + edges"]
        GS_SCHEMA --> GS_GEMINI[Gemini: generate_json with mindmap knowledge base]
        GS_GEMINI --> GS_ENRICH[Ensure suggestions have source attribution from RAG]
        GS_ENRICH --> GS_RETURN[Return graph suggestions]
    end

    subgraph Plagiarism Network Report
        PLAGIARISM --> PL_INPUT[Inputs: similarity_graph, clusters, submission_contents]

        PL_INPUT --> PL_CLUSTERS[Format cluster descriptions with submission excerpts]
        PL_CLUSTERS --> PL_PAIRS[Format high-similarity pairs with scores]

        PL_PAIRS --> PL_PROMPT[Assemble analysis prompt]
        PL_PROMPT --> PL_ANALYZE["Analyze per cluster: shared content, intentional vs coincidental, severity level"]
        PL_ANALYZE --> PL_SCHEMA["JSON schema: flagged_clusters with students + max_similarity + analysis + summary"]
        PL_SCHEMA --> PL_GEMINI[Gemini: generate_json with plagiarism knowledge base]
        PL_GEMINI --> PL_ATTACH[Attach original network_graph for visualization]
        PL_ATTACH --> PL_RETURN[Return plagiarism network report]
    end

    subgraph Common Pattern
        SP_GEMINI --> COMMON
        GR_GEMINI --> COMMON
        GS_GEMINI --> COMMON
        PL_GEMINI --> COMMON

        COMMON[All GAG calls follow same pattern]
        COMMON --> C1[1. Gather structured inputs]
        C1 --> C2[2. Format RAG context as grounding]
        C2 --> C3[3. Build domain-specific prompt with JSON schema]
        C3 --> C4[4. Call Gemini generate_json with knowledge base]
        C4 --> C5[5. Enrich result with RAG source metadata]
        C5 --> C6[6. Return structured JSON artifact]
    end
```

## Key Files
- `backend/app/gag_service.py` — All 4 GAG generation functions
- `backend/app/ai_service.py` — generate_json(), get_knowledge_base()
- `backend/app/rag_service.py` — format_context(), format_citations()
