# RAG Pipeline Flow

## Overview
Retrieval-Augmented Generation pipeline: indexes course content into ChromaDB vector store, embeds queries, retrieves relevant chunks, and formats context for AI generation. Used by SmartBuddy, Daily Guide, AI Grading, Plagiarism, and MindMap Buddy.

## Flowchart

```mermaid
flowchart TD
    subgraph Content Indexing - index_course_content
        INDEX_START([Trigger: content created/updated or manual reindex]) --> GET_COURSE[Load course ID]
        GET_COURSE --> FETCH_CONTENT[Fetch all indexable content for course]

        FETCH_CONTENT --> IDX_MODULES[Module Items]
        FETCH_CONTENT --> IDX_ANNOUNCE[Announcements]
        FETCH_CONTENT --> IDX_DISCUSS[Discussions]
        FETCH_CONTENT --> IDX_MAPS[Student Mind Maps]
        FETCH_CONTENT --> IDX_QUIZZES[Quiz Questions]
        FETCH_CONTENT --> IDX_ASSIGN[Assignments]

        subgraph Process Module Items
            IDX_MODULES --> MOD_LOOP[For each module item]
            MOD_LOOP --> MOD_TYPE{Item type?}
            MOD_TYPE -->|PDF| MOD_PDF[PyPDF2: extract text from PDF]
            MOD_TYPE -->|Link| MOD_LINK[Use title + URL as text]
            MOD_TYPE -->|Video| MOD_VIDEO[Use title as text]
            MOD_PDF --> MOD_INDEX[Index document]
            MOD_LINK --> MOD_INDEX
            MOD_VIDEO --> MOD_INDEX
        end

        subgraph Process Announcements
            IDX_ANNOUNCE --> ANN_LOOP[For each announcement]
            ANN_LOOP --> ANN_TEXT[Combine title + content]
            ANN_TEXT --> ANN_INDEX[Index document]
        end

        subgraph Process Discussions
            IDX_DISCUSS --> DISC_BATCH[Batch every 10 messages]
            DISC_BATCH --> DISC_TEXT[Combine sender + text for batch]
            DISC_TEXT --> DISC_INDEX[Index document]
        end

        subgraph Process Mind Maps
            IDX_MAPS --> MAP_SUBS[Get top 50 student submissions with mapId]
            MAP_SUBS --> MAP_LOAD[Load map graphData + nodesText]
            MAP_LOAD --> MAP_INDEX[Index document]
        end

        subgraph Process Quizzes
            IDX_QUIZZES --> QUIZ_LOOP[For each quiz]
            QUIZ_LOOP --> Q_QUESTIONS[Get all questions for quiz]
            Q_QUESTIONS --> Q_TEXT[Combine question text + options]
            Q_TEXT --> Q_INDEX[Index document]
        end

        subgraph Process Assignments
            IDX_ASSIGN --> ASSIGN_LOOP[For each assignment]
            ASSIGN_LOOP --> ASSIGN_TEXT[Combine title + description]
            ASSIGN_TEXT --> ASSIGN_INDEX[Index document]
        end
    end

    subgraph Index Document - index_document
        MOD_INDEX --> CHECK_HASH
        ANN_INDEX --> CHECK_HASH
        DISC_INDEX --> CHECK_HASH
        MAP_INDEX --> CHECK_HASH
        Q_INDEX --> CHECK_HASH
        ASSIGN_INDEX --> CHECK_HASH

        CHECK_HASH{Content hash changed?}
        CHECK_HASH -->|No change| SKIP[Skip - already indexed]
        CHECK_HASH -->|Changed/New| CHUNK[chunk_text: split into 500-token chunks with 50-token overlap]
        CHUNK --> EMBED_CHUNKS[embed_texts: batch embed chunks via Gemini text-embedding-004]

        subgraph Embedding
            EMBED_CHUNKS --> BATCH_LIMIT[Batch max 100 texts per API call]
            BATCH_LIMIT --> GEMINI_EMBED[Gemini text-embedding-004 - 768 dimensions]
            GEMINI_EMBED --> VECTORS[Return embedding vectors]
        end

        VECTORS --> UPSERT[Upsert into ChromaDB collection course_courseId]

        subgraph ChromaDB Storage
            UPSERT --> STORE_EMBED[Store: embedding vector]
            UPSERT --> STORE_META[Store metadata: doc_id, doc_type, title, course_id, chunk_index]
            UPSERT --> STORE_TEXT[Store: chunk text content]
        end

        STORE_EMBED --> UPDATE_STATE[Update ragIndexState in Firestore]
        UPDATE_STATE --> STATE_DATA[Save: docId, courseId, contentHash, lastIndexedAt, chunkCount, docType, title]
    end

    subgraph Retrieval - retrieve
        QUERY_START([AI feature needs context]) --> RECEIVE_QUERY[Receive: query text, course_ids, top_k]
        RECEIVE_QUERY --> EMBED_QUERY[Embed query with text-embedding-004]
        EMBED_QUERY --> SEARCH_LOOP[For each course_id]
        SEARCH_LOOP --> GET_COLLECTION[Get ChromaDB collection course_courseId]
        GET_COLLECTION --> VECTOR_SEARCH[Cosine similarity search with query embedding]
        VECTOR_SEARCH --> COLLECT_RESULTS[Collect top_k results across all courses]
        COLLECT_RESULTS --> RANK[Rank by similarity score]
        RANK --> RETURN_CHUNKS[Return top_k chunks with metadata]
    end

    subgraph Format for AI
        RETURN_CHUNKS --> FORMAT_CTX[format_context: build numbered source blocks]

        subgraph Context Format
            FORMAT_CTX --> CTX_BLOCK["Source 1 - title - type\ncontent chunk text\n---"]
            CTX_BLOCK --> CTX_ALL[Concatenate all source blocks]
        end

        RETURN_CHUNKS --> FORMAT_CITE[format_citations: extract source metadata]

        subgraph Citation Format
            FORMAT_CITE --> CITE_OBJ["title, doc_id, doc_type for each unique source"]
        end

        CTX_ALL --> TO_AI[Pass context string to AI prompt]
        CITE_OBJ --> TO_RESPONSE[Attach citations to API response]
    end

    subgraph Consumers
        TO_AI --> C_COMPANION[SmartBuddy Chat]
        TO_AI --> C_GUIDE[Daily Study Guide]
        TO_AI --> C_GRADING[AI Grading]
        TO_AI --> C_BUDDY[MindMap Buddy]
        TO_AI --> C_MATERIALS[Study Materials by Topic]
    end
```

## Key Files
- `backend/app/rag_service.py` — Core RAG implementation: init_chroma, index_document, index_course_content, retrieve, format_context, format_citations, chunk_text, embed_texts
- `backend/app/routers/rag_admin.py` — RAG admin endpoints for indexing status/triggers
- `backend/vector_store/` — ChromaDB persistent storage directory
