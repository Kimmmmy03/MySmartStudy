"""
GAG (Generation-Augmented Generation) Service.

Takes RAG-retrieved context and produces structured artifacts beyond
simple text responses — study plans with linked resources, grading
reports with comparative analysis, graph-structured node suggestions,
and plagiarism network reports.
"""

import logging
from .ai_service import generate_json, get_knowledge_base, safe_truncate

logger = logging.getLogger(__name__)


async def generate_study_plan_artifact(
    student_context: dict,
    rag_chunks: list[dict],
    deadlines: list[dict],
    exam_info: list[dict] | None = None,
) -> dict:
    """RAG+GAG (Generation): Generate a structured study plan artifact.

    Produces per-topic difficulty ratings based on student performance,
    linked resource references from RAG chunks, and actionable study sessions.
    """
    # Dispatch to the LangChain implementation when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import gag_service_lc
        return await gag_service_lc.generate_study_plan_artifact(
            student_context, rag_chunks, deadlines, exam_info,
        )

    from . import rag_service

    # Build context strings
    performance_str = ""
    if student_context.get("quiz_scores"):
        performance_str += "Quiz performance:\n"
        for qs in student_context["quiz_scores"]:
            # Defensive access — quiz-score dicts may come from several callers
            # with slightly different keys (quiz_title/title, percentage/score).
            q_title = qs.get("quiz_title") or qs.get("title") or qs.get("quizId", "Quiz")
            q_course = qs.get("course", "")
            q_pct = qs.get("percentage", qs.get("score", ""))
            performance_str += f"  - {q_title} ({q_course}): {q_pct}%\n"

    if student_context.get("assignment_grades"):
        performance_str += "Assignment grades:\n"
        for ag in student_context["assignment_grades"]:
            performance_str += f"  - {ag['title']} ({ag['course']}): {ag['grade']}/100\n"

    if student_context.get("weak_topics"):
        performance_str += f"Identified weak areas: {', '.join(student_context['weak_topics'])}\n"

    # Build timetable context (supports multiple saved timetables)
    timetable_str = ""
    timetables = student_context.get("timetables", [])
    if timetables:
        for tt in timetables:
            label = tt.get("semester_label", "Current")
            timetable_str += f"CLASS TIMETABLE ({label}):\n"
            for day_entry in tt.get("parsed_schedule", []):
                day = day_entry.get("day", "")
                for cls in day_entry.get("classes", []):
                    timetable_str += f"  - {day} {cls.get('time', '')} — {cls.get('subject', '')}"
                    if cls.get("location"):
                        timetable_str += f" ({cls['location']})"
                    timetable_str += "\n"
            study_times = tt.get("recommended_study_times", [])
            if study_times:
                timetable_str += "  Recommended study times:\n"
                for slot in study_times:
                    timetable_str += f"    - {slot.get('day', '')} {slot.get('time', '')} ({slot.get('duration_minutes', 0)} min): {slot.get('reason', '')}\n"

    rag_context = rag_service.format_context(rag_chunks)
    sources = rag_service.format_citations(rag_chunks)

    deadlines_str = ""
    for d in deadlines:
        deadlines_str += f"- {d.get('title', '')} ({d.get('course', '')}) due {d.get('deadline', '')} [{d.get('status', '')}]\n"

    today = student_context.get("today", "")

    prompt = f"""Based on the student's performance data, upcoming deadlines, class timetable, and course materials,
create a PERSONALISED study plan for today. Prioritise topics where the student is weakest.

IMPORTANT — SCHEDULING RULES:
- If the student has a class timetable, you MUST assign a specific "suggested_time" (e.g. "09:00-10:00") to each recommendation.
- Schedule study sessions in the FREE GAPS between classes and during the recommended study time slots.
- NEVER overlap with class times. Only use times when the student has no classes.
- Order recommendations chronologically by suggested_time so the student has a clear daily schedule.
- If no timetable is available, still suggest reasonable times spread across the day (morning, afternoon, evening).

TODAY: {today}
STUDENT: {student_context.get('name', 'Student')}

PERFORMANCE DATA:
{performance_str or 'No performance data available.'}

{timetable_str or 'No timetable uploaded yet.'}

UPCOMING DEADLINES:
{deadlines_str or 'No upcoming deadlines.'}

RETRIEVED COURSE MATERIALS:
{rag_context}

For each recommendation, assign a difficulty_rating (1-5) based on the student's past performance
in that topic area. Include specific resource references from the materials above.

Return JSON:
{{
  "recommendations": [
    {{
      "course": "<course name>",
      "topic": "<what to study>",
      "priority": "high" | "medium" | "low",
      "suggested_time": "<h:MM AM/PM - h:MM AM/PM, e.g. 9:00 AM - 10:00 AM>",
      "reason": "<why this should be studied today, referencing performance data>",
      "estimated_time": "<e.g. 30 mins, 1 hour>",
      "difficulty_rating": <1-5 based on student's past performance>,
      "resource_links": [
        {{"title": "<source title>", "doc_id": "<source doc_id>", "doc_type": "<source type>"}}
      ],
      "suggested_activities": ["<specific activity 1>", "<specific activity 2>"]
    }}
  ],
  "daily_schedule_summary": "<a short paragraph describing how the study sessions are arranged around the student's classes today>",
  "motivational_message": "<personalised encouraging message referencing their progress>"
}}"""

    result = await generate_json(prompt, system_instruction=get_knowledge_base("study_plan"))

    # Enrich resource_links with actual source data
    for rec in result.get("recommendations", []):
        if not rec.get("resource_links"):
            # Auto-link from RAG sources if generation didn't include them
            rec["resource_links"] = sources[:2] if sources else []

    return result


async def generate_grading_report(
    submission_content: str,
    rubric: list[dict],
    rag_chunks: list[dict],
    assignment_info: dict,
) -> dict:
    """RAG+GAG (Generation): Generate a structured grading report.

    Includes per-criterion analysis, comparative analysis against class
    performance, and improvement suggestions with resource links.
    """
    # Dispatch to the CrewAI multi-agent grading crew when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import crew_service
        return await crew_service.generate_grading_report(
            submission_content, rubric, rag_chunks, assignment_info,
        )

    from . import rag_service

    rag_context = rag_service.format_context(rag_chunks)
    sources = rag_service.format_citations(rag_chunks)

    criteria_text = ""
    if rubric:
        criteria_text = "RUBRIC CRITERIA:\n"
        for c in rubric:
            criteria_text += f"- {c.get('name', '')}: {c.get('description', '')} (max {c.get('maxPoints', 10)} points)\n"
    else:
        criteria_text = "No rubric provided. Grade on overall quality out of 100."

    class_stats = assignment_info.get("class_stats", {})
    stats_text = ""
    if class_stats:
        stats_text = (
            f"\nCLASS STATISTICS:\n"
            f"  Mean: {class_stats.get('mean', 'N/A')}\n"
            f"  Median: {class_stats.get('median', 'N/A')}\n"
            f"  Total graded: {class_stats.get('count', 0)}\n"
        )

    prompt = f"""Grade this student tutorial submission with comparative analysis.

ASSIGNMENT: {assignment_info.get('title', '')}
DESCRIPTION: {assignment_info.get('description', '')}

{criteria_text}
{stats_text}

STUDENT SUBMISSION:
\"\"\"
{safe_truncate(submission_content)}
\"\"\"

SIMILAR PAST SUBMISSIONS FOR REFERENCE:
{rag_context}

Return JSON with this exact structure:
{{
  "recommended_grade": <float 0-100>,
  "criterion_scores": {{"<criterion_name>": <float score>, ...}},
  "justification": "<paragraph explaining the grade>",
  "confidence": <float 0-1 indicating how confident you are>,
  "comparative_analysis": "<paragraph comparing this submission to class performance and similar submissions>",
  "improvement_suggestions": [
    {{
      "criterion": "<which criterion to improve>",
      "suggestion": "<specific actionable suggestion>",
      "resource_link": {{"title": "<relevant source>", "doc_id": "<id>", "doc_type": "<type>"}}
    }}
  ]
}}"""

    result = await generate_json(prompt, system_instruction=get_knowledge_base("grading"))

    # Ensure improvement suggestions have resource links
    for sug in result.get("improvement_suggestions", []):
        if not sug.get("resource_link") and sources:
            sug["resource_link"] = sources[0]

    return result


async def generate_graph_suggestions(
    map_nodes: list[dict],
    map_edges: list[dict],
    rag_chunks: list[dict],
    concept_subgraph: dict,
    map_title: str = "",
    task_description: str = "",
) -> dict:
    """RAG+GAG (Graph): Generate structured node/edge suggestions in graph format.

    Uses RAG-retrieved content and knowledge graph concepts to suggest
    nodes with source attribution and concept connections.
    """
    # Dispatch to the LangChain implementation when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import gag_service_lc
        return await gag_service_lc.generate_graph_suggestions(
            map_nodes, map_edges, rag_chunks, concept_subgraph,
            map_title, task_description,
        )

    from . import rag_service

    node_labels = [n.get("label", "") for n in map_nodes if n.get("label")]
    rag_context = rag_service.format_context(rag_chunks)
    sources = rag_service.format_citations(rag_chunks)

    # Build knowledge graph context
    kg_context = ""
    if concept_subgraph and concept_subgraph.get("nodes"):
        kg_nodes = concept_subgraph["nodes"]
        kg_edges = concept_subgraph.get("edges", [])
        kg_context = "RELATED CONCEPTS FROM KNOWLEDGE GRAPH:\n"
        for nid, node in kg_nodes.items():
            kg_context += f"  - {node.get('label', '')} (type: {node.get('type', 'concept')}, weight: {node.get('weight', 1)})\n"
        if kg_edges:
            kg_context += "CONCEPT RELATIONSHIPS:\n"
            for edge in kg_edges[:20]:
                src_label = kg_nodes.get(edge["source"], {}).get("label", edge["source"])
                tgt_label = kg_nodes.get(edge["target"], {}).get("label", edge["target"])
                kg_context += f"  - {src_label} --[{edge.get('relation', 'related_to')}]--> {tgt_label}\n"

    prompt = f"""A student is building a mind map titled "{map_title or 'Untitled'}".
Task: {task_description or 'General mind map'}

EXISTING NODES: {', '.join(node_labels[:40]) if node_labels else 'None yet'}

{kg_context}

RETRIEVED COURSE MATERIALS:
{rag_context}

Suggest 5-8 new nodes that would improve this mind map. Each suggestion should:
1. Be grounded in the course materials or knowledge graph
2. Include source attribution
3. Specify which existing node to connect to
4. Include concept connections to other suggestions where relevant

Return JSON:
{{
  "suggestions": [
    {{
      "label": "<new node label>",
      "description": "<why this adds value, referencing course material>",
      "parent_label": "<EXACT existing node label to connect to>",
      "source": {{"title": "<source material title>", "doc_id": "<source id>", "doc_type": "<type>"}},
      "graph_connections": ["<other related concept labels>"]
    }}
  ],
  "related_concepts_graph": {{
    "nodes": [{{"id": "<id>", "label": "<concept>", "type": "<concept/fact/example>"}}],
    "edges": [{{"source": "<node_id>", "target": "<node_id>", "relation": "<relation_type>"}}]
  }}
}}"""

    result = await generate_json(prompt, system_instruction=(
        "You are SmartBuddy for Mind Maps. You use retrieved course materials "
        "and knowledge graph data to suggest well-grounded, educational mind map nodes. "
        "Always cite your sources and show concept relationships."
    ), temperature=0.5)

    # Enrich suggestions with source data from RAG
    for sug in result.get("suggestions", []):
        if not sug.get("source") and sources:
            sug["source"] = sources[0]

    return result


async def generate_plagiarism_network_report(
    similarity_graph: dict,
    clusters: list[list[str]],
    submission_contents: dict,
) -> dict:
    """RAG+GAG (Graph): Generate a plagiarism network report.

    Analyzes submission clusters for plagiarism patterns and generates
    a narrative report with visualization-ready graph data.
    """
    # Dispatch to the LangChain implementation when AI_BACKEND=framework.
    from .ai_framework import framework_enabled
    if framework_enabled():
        from . import gag_service_lc
        return await gag_service_lc.generate_plagiarism_network_report(
            similarity_graph, clusters, submission_contents,
        )

    # Build cluster descriptions for the prompt
    cluster_text = ""
    for i, cluster in enumerate(clusters):
        cluster_text += f"\nCluster {i + 1}:\n"
        for student_id in cluster:
            content = submission_contents.get(student_id, "")
            cluster_text += f"  Student {student_id}: \"{content[:500]}...\"\n"

    edges = similarity_graph.get("edges", [])
    high_sim_pairs = [e for e in edges if e.get("similarity", 0) >= 0.7]
    pairs_text = ""
    for pair in high_sim_pairs[:20]:
        pairs_text += f"  {pair['source']} <-> {pair['target']}: {pair['similarity']:.2f}\n"

    prompt = f"""Analyse these submission clusters for plagiarism patterns.

FLAGGED CLUSTERS (high similarity groups):
{cluster_text or 'No clusters detected.'}

HIGH SIMILARITY PAIRS:
{pairs_text or 'No high similarity pairs.'}

For each cluster, analyse:
1. What specific content is shared/duplicated
2. Whether it appears to be coincidental or intentional
3. The severity level

Return JSON:
{{
  "flagged_clusters": [
    {{
      "students": [
        {{"id": "<student_id>", "name": "<student_name>", "similarity_to_cluster": <float 0-1>}}
      ],
      "max_similarity": <float>,
      "analysis": "<detailed explanation of what was found>"
    }}
  ],
  "summary": "<2-3 sentence overall assessment of the assignment's plagiarism situation>"
}}"""

    result = await generate_json(prompt, system_instruction=get_knowledge_base("plagiarism"))

    # Attach the network graph for visualization
    result["network_graph"] = similarity_graph

    return result
