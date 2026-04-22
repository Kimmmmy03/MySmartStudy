# Mind Map Workflow

## Overview
Covers mind map creation using React Flow editor, AI Buddy assistance with RAG + knowledge graph, sharing/collaboration, and lecturer review.

## Flowchart

```mermaid
flowchart TD
    subgraph Create Mind Map
        START([Student opens create-map page]) --> CHOOSE{New or load existing?}
        CHOOSE -->|New| TEMPLATE[Select template or blank canvas]
        CHOOSE -->|Existing| LOAD[GET /api/maps/id - Load saved map]
        TEMPLATE --> EDITOR[Open React Flow editor]
        LOAD --> EDITOR
    end

    subgraph Editor Features
        EDITOR --> ADD_NODE[Add nodes - rectangle, circle, diamond, etc.]
        EDITOR --> CONNECT[Draw edges between nodes]
        EDITOR --> STYLE[Customize: colors, fonts, sizes, shapes]
        EDITOR --> ARRANGE[Auto-layout / manual positioning]
        ADD_NODE --> AUTOSAVE
        CONNECT --> AUTOSAVE
        STYLE --> AUTOSAVE
        ARRANGE --> AUTOSAVE

        AUTOSAVE[Auto-save every 5 seconds]
        AUTOSAVE --> SAVE_API[PATCH /api/maps/id - Save graphData JSON]
        SAVE_API --> CHECK_FIRST{First map?}
        CHECK_FIRST -->|Yes| BADGE_MAP[Award cartographer badge]
        CHECK_FIRST -->|No| CHECK_FIVE{5 maps total?}
        CHECK_FIVE -->|Yes| BADGE_MASTER[Award map_master badge]
    end

    subgraph AI Buddy - MindMap Assistant
        EDITOR -->|Click AI Buddy| BUDDY_OPEN[Open MindMap Buddy panel]
        BUDDY_OPEN --> BUDDY_ANALYZE[POST /api/ai/mindmap-buddy/analyze]

        BUDDY_ANALYZE --> B_EXTRACT[Extract current nodes + edges]
        B_EXTRACT --> B_RAG[RAG: retrieve course materials related to map topic]
        B_RAG --> B_KG[Knowledge Graph: query related concepts]
        B_KG --> B_RATE[Rate map: structure, coverage, depth]
        B_RATE --> B_DISPLAY[Display analysis + rating]

        BUDDY_OPEN --> BUDDY_SUGGEST[POST /api/ai/mindmap-buddy/recommend-nodes]
        BUDDY_SUGGEST --> S_CONTEXT[Send current nodes + edges + course IDs]
        S_CONTEXT --> S_RAG[RAG: retrieve related materials]
        S_RAG --> S_KG[Knowledge Graph: get concept subgraph]
        S_KG --> S_GAG[GAG: generate_graph_suggestions]
        S_GAG --> S_RESULT[Return: 5-8 suggested nodes with parent connections + sources]
        S_RESULT --> S_SHOW[Display suggestions with source attribution]
        S_SHOW --> S_ACCEPT{Student accepts suggestion?}
        S_ACCEPT -->|Yes| S_ADD_NODE[Auto-add node to canvas at correct position]
        S_ACCEPT -->|No| S_SKIP[Skip suggestion]

        BUDDY_OPEN --> BUDDY_CHAT[POST /api/ai/mindmap-buddy/chat]
        BUDDY_CHAT --> BC_MEMORY[Load stateful conversation memory]
        BC_MEMORY --> BC_RAG[RAG: retrieve context for question]
        BC_RAG --> BC_GEMINI[Gemini: answer with map context]
        BC_GEMINI --> BC_SAVE_MEM[Save updated memory to Firestore]
        BC_GEMINI --> BC_RESPONSE[Display chat response]
    end

    subgraph Sharing and Collaboration
        EDITOR -->|Share| SHARE_MODAL[Open share modal]
        SHARE_MODAL --> SHARE_CODE[Show unique share code]
        SHARE_MODAL --> ADD_COLLAB[Add collaborator by email]
        ADD_COLLAB --> POST_COLLAB[POST /api/maps/id/collaborators]
        POST_COLLAB --> COLLAB_NOTIFY[Notify collaborator]

        COLLAB_ACCESS([Collaborator opens shared map]) --> COLLAB_EDIT[Can view and edit map]
        COLLAB_EDIT --> COLLAB_SAVE[Changes auto-saved, polling sync every 4s]
    end

    subgraph Export
        EDITOR -->|Export| EXPORT_CHOICE{Format?}
        EXPORT_CHOICE -->|PNG| EXPORT_PNG[html-to-image: capture canvas as PNG]
        EXPORT_CHOICE -->|PDF| EXPORT_PDF[jsPDF: convert canvas to PDF]
    end

    subgraph Lecturer Review
        L_REVIEW([Lecturer opens review-maps]) --> L_LIST[GET /api/maps/ - List student maps for course]
        L_LIST --> L_SELECT[Select student map]
        L_SELECT --> L_VIEW[View read-only map in viewer]
        L_VIEW --> L_FEEDBACK[Provide feedback or grade]
    end
```

## Key Files
- `frontend-web/src/app/(dashboard)/student/create-map/page.tsx` — Map editor page
- `frontend-web/src/components/map-editor/` — React Flow custom nodes, shape palette, properties panel
- `frontend-web/src/components/map-editor/mindmap-buddy.tsx` — AI Buddy widget
- `frontend-web/src/lib/export-map.ts` — PNG/PDF export utilities
- `frontend-mobile/lib/screens/mind_maps_screen.dart` — Mobile map list
- `frontend-mobile/lib/screens/mind_map_viewer.dart` — Mobile map viewer
- `backend/app/routers/maps.py` — Map CRUD, collaboration, search
- `backend/app/routers/ai_mindmap_buddy.py` — AI analysis, suggestions, chat
- `backend/app/knowledge_graph_service.py` — Concept graph queries
