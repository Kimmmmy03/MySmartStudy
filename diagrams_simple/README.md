# MySmartStudy — Simple Diagrams

Plain-English versions of the 6 most "how does it work?" diagrams, written for non-technical audiences (supervisors, viva committee, dean, marketing, parents). No jargon, real-world analogies, larger fonts.

Open any `.drawio` file at <https://app.diagrams.net> or in VS Code's "Draw.io Integration" extension.

| # | File | Plain-English question it answers |
|---|------|-----------------------------------|
| 1 | `1_system_architecture_simple.drawio` | *"What is MySmartStudy actually made of?"*  — three layers: the people who use it, the brain that does the work, and where information is stored. |
| 2 | `2_rag_diagram_simple.drawio` | *"How does the AI read course materials?"*  — like a librarian who reads every book first, then answers using the real pages so it never makes things up. |
| 3 | `3_rag_graph_diagram_simple.drawio` | *"How does the AI see how topics connect, and how does it catch copied submissions?"*  — a mind-map of every course + a similarity map of every submission. |
| 4 | `4_gag_diagram_simple.drawio` | *"Why don't AI answers look like a chat reply?"*  — instead of free text, the AI fills in a tidy form that the app can turn into charts, links and lists. |
| 5 | `5_multi_agent_diagram_simple.drawio` | *"Why is the AI so fast?"*  — instead of asking one question at a time, the AI sends out a whole team of helpers at once. ~5× faster than one-by-one. |
| 6 | `6_ai_features_interaction_simple.drawio` | *"How do all the AI features fit together?"*  — every AI button passes the same gate, uses the same brain, and the admin can switch any of it off in 30 seconds. |

## Reading order

If you're new to the project, read them in this order:

1. **System Architecture** — the lay of the land
2. **AI Features Interaction** — how the AI parts plug into the whole
3. **RAG** — how the AI reads materials
4. **Knowledge Graph** — how the AI sees topics + spots plagiarism
5. **Multi-Agent** — why it's fast
6. **GAG** — why AI suggestions look polished

## Colour key (consistent across all 6)

- **Blue** — students / general
- **Plum / purple** — lecturers / course things
- **Violet** — AI features
- **Cool slate** — data and infrastructure
- **Gray** — admin / governance / shared concerns
- **Light slate** — explanatory notes

## Related — technical version

For engineers and developers, see the full technical set in `../diagrams/` — same colour palette, same routing style, but with implementation detail (function names, API endpoints, env vars, file paths).
