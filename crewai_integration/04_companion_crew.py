"""
Pattern 4 — Multi-Agent Orchestration using CrewAI.

Mirrors backend/app/multi_agent.py + routers/ai_companion.py:_get_student_context.

CrewAI uses role-based agents. We model the 6 student-context agents from
your real backend as 6 CrewAI agents that work in parallel, then a 7th
"Synthesizer" agent that combines their findings into one reply.

How to run:
    cd crewai_integration
    python 04_companion_crew.py
"""

import os
from dotenv import load_dotenv
from crewai import Agent, Crew, Task, Process, LLM

load_dotenv()

# ─── 1. Configure the LLM (CrewAI uses LiteLLM under the hood for Gemini) ───
# Set GEMINI_API_KEY env var — LiteLLM reads it automatically
os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")

# SMART_MODEL — used by the synthesizer
smart_llm = LLM(model="gemini/gemini-2.5-flash", temperature=0.5)

# FAST_MODEL — used by the data-gathering agents (cheap, deterministic)
fast_llm = LLM(model="gemini/gemini-2.5-flash-lite", temperature=0.1)


# ─── 2. Define the 6 data-gathering agents ───
# Each one mirrors a _ctx_*() function in your real ai_companion.py.
# In a real integration, the `tools=` list would include a Firestore lookup tool.

courses_agent = Agent(
    role="Course Enrolment Researcher",
    goal="Identify all courses the student is currently enrolled in",
    backstory="You are an academic records specialist who quickly looks up "
              "which courses a student is registered for this semester.",
    llm=fast_llm,
    verbose=True,
    allow_delegation=False,
)

deadlines_agent = Agent(
    role="Deadline Tracker",
    goal="List all upcoming assignment and quiz deadlines",
    backstory="You watch over upcoming submission deadlines and quiz dates "
              "so the student never misses anything.",
    llm=fast_llm,
    verbose=True,
    allow_delegation=False,
)

performance_agent = Agent(
    role="Academic Performance Analyst",
    goal="Identify the student's weak topics from past quiz and assignment scores",
    backstory="You analyse quiz scores and assignment grades to spot topics "
              "where the student scored below 60% and needs reinforcement.",
    llm=fast_llm,
    verbose=True,
    allow_delegation=False,
)

timetable_agent = Agent(
    role="Schedule Planner",
    goal="Extract the student's class timetable for this week",
    backstory="You read the student's saved class timetable and identify "
              "free gaps suitable for study sessions.",
    llm=fast_llm,
    verbose=True,
    allow_delegation=False,
)

reminders_agent = Agent(
    role="Task Reminder",
    goal="Surface the student's pending to-do items",
    backstory="You retrieve the student's planner to find tasks they haven't "
              "completed yet.",
    llm=fast_llm,
    verbose=True,
    allow_delegation=False,
)

reflections_agent = Agent(
    role="Self-Reflection Reader",
    goal="Surface recent weekly self-reflection signals",
    backstory="You read the student's most recent weekly reflections to "
              "capture self-reported confidence and challenges.",
    llm=fast_llm,
    verbose=True,
    allow_delegation=False,
)

# ─── 3. The Synthesizer — uses all 6 outputs to write the final reply ───
synthesizer_agent = Agent(
    role="SmartBuddy Companion",
    goal="Give a warm, personalised study suggestion using the full student picture",
    backstory="You are SmartBuddy, a friendly AI study companion. You read "
              "the reports from six specialist researchers and craft one "
              "encouraging, concrete suggestion for the student.",
    llm=smart_llm,
    verbose=True,
    allow_delegation=False,
)


# ─── 4. Define the parallel tasks (the 6 agents fan out) ───
# In CrewAI you describe tasks; the framework picks which agent runs which one.
# Hard-coded student state for the demo — in your real backend each task
# would call a tool that queries Firestore.

DEMO_STUDENT_STATE = """
Student: Alice (db101)
- Enrolled courses: Databases (CS201), Algorithms (CS202)
- Upcoming deadlines:
    * Quiz 2 (Databases) due 2026-05-26 [pending]
    * Assignment 1 (Algorithms) due 2026-05-30 [pending]
- Quiz scores:
    * ER Basics: 55%
    * SQL Basics: 78%
- Assignment grades:
    * Project A: 70/100
- Class timetable:
    * Mon 9:00-11:00 — Databases (DK-401)
    * Wed 14:00-16:00 — Algorithms (DK-202)
- Pending tasks: Read Chapter 4 on Normalisation, Practice JOIN queries
- Last weekly reflection: confidence 3/5, struggled with database normalisation
"""

courses_task = Task(
    description=f"Given this student state:\n{DEMO_STUDENT_STATE}\n\n"
                f"List the courses the student is enrolled in.",
    expected_output="A bulleted list of course names and codes.",
    agent=courses_agent,
)

deadlines_task = Task(
    description=f"Given this student state:\n{DEMO_STUDENT_STATE}\n\n"
                f"List all upcoming deadlines with their dates and current status.",
    expected_output="A bulleted list of deadlines, each with date and submission status.",
    agent=deadlines_agent,
)

performance_task = Task(
    description=f"Given this student state:\n{DEMO_STUDENT_STATE}\n\n"
                f"Identify weak topics (anything where the student scored below 60%).",
    expected_output="A list of weak topics with the source score.",
    agent=performance_agent,
)

timetable_task = Task(
    description=f"Given this student state:\n{DEMO_STUDENT_STATE}\n\n"
                f"Extract the class schedule and identify the longest free gaps.",
    expected_output="A list of classes and free gaps suitable for study sessions.",
    agent=timetable_agent,
)

reminders_task = Task(
    description=f"Given this student state:\n{DEMO_STUDENT_STATE}\n\n"
                f"List the pending tasks the student needs to complete.",
    expected_output="A bulleted list of pending tasks.",
    agent=reminders_agent,
)

reflections_task = Task(
    description=f"Given this student state:\n{DEMO_STUDENT_STATE}\n\n"
                f"Summarise the student's last weekly reflection: confidence + challenges.",
    expected_output="One sentence summarising confidence level and what they struggled with.",
    agent=reflections_agent,
)

# ─── 5. The synthesizer task — consumes the outputs of the 6 above ───
synthesize_task = Task(
    description=(
        "Using all the specialist reports above, answer the student's question:\n\n"
        "  'What should I focus on this week?'\n\n"
        "Be warm, concrete, and reference specific topics / time slots. "
        "Keep it to 3-4 short paragraphs."
    ),
    expected_output="A friendly, personalised study suggestion in 3-4 short paragraphs.",
    agent=synthesizer_agent,
    context=[
        courses_task, deadlines_task, performance_task,
        timetable_task, reminders_task, reflections_task,
    ],
)


# ─── 6. Build the Crew — Process.sequential runs tasks in order BUT ───
# CrewAI runs tasks with no explicit context dependency in parallel when async_execution=True.
# For maximum parallelism, set async_execution=True on the 6 agents:
for t in (courses_task, deadlines_task, performance_task,
          timetable_task, reminders_task, reflections_task):
    t.async_execution = True

crew = Crew(
    agents=[
        courses_agent, deadlines_agent, performance_agent,
        timetable_agent, reminders_agent, reflections_agent,
        synthesizer_agent,
    ],
    tasks=[
        courses_task, deadlines_task, performance_task,
        timetable_task, reminders_task, reflections_task,
        synthesize_task,
    ],
    process=Process.sequential,   # synthesizer waits for the 6 to complete
    verbose=True,
)

# ─── 7. Kick off the crew ───
if __name__ == "__main__":
    print("=" * 60)
    print("Running CrewAI companion crew")
    print("Same 6-agent fan-out as your real backend's _get_student_context")
    print("=" * 60)
    result = crew.kickoff()
    print("\n" + "=" * 60)
    print("FINAL ANSWER FROM SMARTBUDDY")
    print("=" * 60)
    print(result)
