# MySmartStudy — Demo Presentation Script

## System Overview

Good morning/afternoon. Today I will be presenting MySmartStudy, an AI-powered smart learning management system designed specifically for Institut Pendidikan Guru (IPG) students and lecturers. This system integrates six distinct AI modules powered by Google Gemini 2.5 Flash, a Retrieval-Augmented Generation pipeline using ChromaDB, a Generation-Augmented Generation framework for structured artifact production, and a Knowledge Graph system for concept mapping and plagiarism detection — all working together to deliver a personalised and intelligent learning experience.

The system is built on three platforms: a Next.js 16 web frontend with a dark glassmorphism design system, a Flutter mobile application supporting both Android and iOS, and a FastAPI Python backend connected to Google Firestore as the primary database. Firebase Authentication handles user management with JWT-based session tokens. The entire AI layer communicates through Google's Gemini 2.5 Flash model via the google-genai SDK.

Let me walk you through every module and explain exactly how each AI system works under the hood.

---

## PART 1: The RAG Pipeline — Retrieval-Augmented Generation

### What is RAG and Why Do We Need It?

Before I show you the AI features, let me explain the foundation that powers all of them — our RAG pipeline. RAG stands for Retrieval-Augmented Generation. The core problem it solves is this: large language models like Gemini have general knowledge, but they do not know anything about the specific course materials, lecture notes, assignments, or discussions happening in our system. Without RAG, if a student asks "What did Dr. Siti cover in Week 3?", the AI would have no idea.

RAG solves this by retrieving relevant documents from our database first, then providing those documents as context to the AI before it generates a response. This grounds the AI's answers in actual course content rather than hallucinated information.

### How the RAG Pipeline Works Step by Step

**Step 1 — Content Ingestion and Chunking:**

When a lecturer uploads course materials — whether it is a PDF document, an announcement, a discussion thread, quiz questions, assignment descriptions, or even student mind maps — our system processes and indexes all of this content. The indexing happens automatically and incrementally.

First, the system extracts text from each content source. For PDF files, we use PyPDF2 to extract text from every page. For announcements, we combine the title and content. For discussions, we batch messages in groups of 10 to create meaningful chunks. For mind maps, we extract all node text. For quizzes, we combine question text with their answer options. For assignments, we combine the title and description.

Next, the extracted text is split into chunks. We use a chunking strategy of 500 tokens per chunk with a 50-token overlap. The overlap ensures that if a concept spans a chunk boundary, it still appears in both chunks so that meaning is preserved. We approximate token count using a ratio of 1.3 words per token. Any chunk smaller than 30 characters is discarded as too small to be useful.

**Step 2 — Embedding Generation:**

Each text chunk is converted into a numerical vector — called an embedding — using Google's `text-embedding-004` model. This embedding is a high-dimensional vector that captures the semantic meaning of the text. Similar concepts produce vectors that are close together in this vector space, while unrelated concepts produce vectors that are far apart.

We generate embeddings in batches of up to 100 texts per API call for efficiency. If an embedding call fails for a particular text, we assign a zero vector as a fallback so that the indexing process does not crash.

**Step 3 — Vector Storage in ChromaDB:**

The embeddings are stored in ChromaDB, a persistent vector database. We create one ChromaDB collection per course, so each course has its own isolated search space. Each vector is stored alongside metadata including the document ID, document type (PDF, announcement, discussion, etc.), title, course ID, chunk index, and total number of chunks for that document.

We also maintain an index state tracking system in Firestore's `ragIndexState` collection. For each document, we store a SHA-256 hash of the content. Before re-indexing a document, we check if the hash has changed. If the content is unchanged, we skip it entirely. If it has changed, we delete the old chunks and insert the new ones. This makes the indexing incremental and efficient.

**Step 4 — Semantic Retrieval:**

When any AI feature needs course-related context — whether it is the AI companion answering a question, the study guide generating recommendations, or the grading system evaluating a submission — it calls the RAG retrieval function with a query text.

The query is embedded using the same `text-embedding-004` model, and ChromaDB performs a cosine similarity search against all stored chunks for the relevant courses. The system returns the top-k most similar chunks (default 5), each with a relevance score calculated as `1.0 minus the cosine distance`.

The retrieved chunks are formatted as numbered sources: `[Source 1: Nota BM101 Minggu 3 (pdf)]`, `[Source 2: Assignment description (assignment)]`, and so on. These formatted sources are then injected into the AI's prompt, giving it access to real course content.

### Demo: Let me show you

*[Open the backend logs or Swagger UI]*

When I trigger the AI companion, you can see in the logs that it first calls the RAG retrieval function, gets back 5 relevant chunks from the student's enrolled courses, and includes them in the system prompt. The AI then generates a response grounded in those actual course materials. You can see the `[Source N]` citations in the response, which point back to specific documents the AI used.

---

## PART 2: The GAG Framework — Generation-Augmented Generation

### What is GAG?

GAG stands for Generation-Augmented Generation. While RAG retrieves existing documents to inform the AI, GAG takes it a step further — it uses the RAG context plus student-specific data to generate structured JSON artifacts. These are not just text responses; they are structured data objects that our frontend can directly render into cards, charts, badges, and interactive elements.

Think of it this way: RAG answers the question "What information is relevant?", and GAG answers the question "What structured output should we produce from that information?"

### The Four GAG Functions

Our system has four GAG generation functions, each producing a different type of artifact:

**1. Study Plan Artifact** — Takes student performance data, deadlines, timetable information, and RAG-retrieved course content, then generates a JSON structure containing daily study recommendations with specific time slots, priority levels, estimated durations, suggested study times in AM/PM format, difficulty ratings, resource links pointing back to RAG sources, and a motivational message. The key constraint is that the generated schedule must respect the student's class timetable and only schedule study sessions in free gaps between classes.

**2. Grading Report Artifact** — Takes a student's submission content, the rubric criteria, class statistics (mean, median), and RAG-retrieved reference materials, then generates a JSON structure with a recommended grade, per-criterion scores with justifications, comparative analysis against class performance, improvement suggestions with links to specific learning resources, and a confidence score indicating how certain the AI is about its assessment.

**3. Mind Map Graph Suggestions** — Takes the current state of a student's mind map (nodes and edges), RAG-retrieved course content, and a concept subgraph from the Knowledge Graph, then generates suggested new nodes with descriptions, parent connections, source references, and graph connection recommendations. This uses a temperature of 0.5 to balance creativity with accuracy.

**4. Plagiarism Network Report** — Takes a similarity graph of all submissions for an assignment, detected high-similarity clusters, and content samples from each submission, then generates a detailed analysis of each flagged cluster including what content is shared, whether the similarity appears intentional, a severity level, and a summary narrative.

---

## PART 3: The Knowledge Graph System

### What is the Knowledge Graph?

The Knowledge Graph is a concept relationship map built for each course. It represents the key concepts taught in a course and how they relate to each other — for example, "Mitosis" is part of "Cell Division", "Binary Search" requires "Sorted Array", or "SELECT" is related to "SQL".

### How It Is Built

The Knowledge Graph is built from all RAG-indexed content for a course. The system retrieves the first 1500 characters of each indexed document from ChromaDB, then processes them in batches of 5 documents. For each batch, Gemini is prompted to extract 10-20 key concepts and their relationships.

Each concept has an ID, a human-readable label, a type (concept, fact, definition, example, or process), and a list of source document IDs. Each relationship has a source concept, target concept, and a relation type: "requires", "part_of", "related_to", "leads_to", "contrasts", or "example_of". Duplicate concepts are merged by combining their sources and incrementing a weight counter. Duplicate edges are deduplicated. The resulting graph is stored in Firestore's `knowledgeGraphs` collection.

### BFS Traversal for Related Concepts

When the AI Mind Map Buddy needs to suggest new nodes for a student's mind map, it queries the Knowledge Graph using BFS (Breadth-First Search) traversal. Given a set of concept labels from the student's map and a depth parameter, the system builds an adjacency list from the graph edges, finds starting nodes by matching concept labels (case-insensitive, with substring matching), then performs BFS up to the specified depth. The result is a subgraph of related concepts and their relationships, which the AI uses to make contextually relevant suggestions.

### Similarity Graph for Plagiarism Detection

The Knowledge Graph service also builds pairwise cosine similarity graphs for plagiarism detection. Given an assignment, it extracts the content of every submission (from mind map node text, PDF files, or comment text), embeds each submission using the same `text-embedding-004` model, then computes cosine similarity between every pair of submissions. Edges are created for pairs with similarity above 0.3. Clusters of high-similarity submissions (above 0.7 threshold) are detected using connected components via BFS. These clusters are then passed to the GAG plagiarism report generator for detailed analysis.

---

## PART 4: AI SmartBuddy — The Study Companion

### Demo Flow

*[Login as student1@mysmartstudy.com, navigate to AI Companion]*

This is SmartBuddy, our AI study companion. Let me show you what happens behind the scenes when a student opens this page and asks a question.

### How It Works

**Step 1 — Context Gathering:** When the student opens SmartBuddy, the system gathers comprehensive context about them:
- Their enrolled courses with course names and codes
- All upcoming assignment deadlines within the next 30 days
- All upcoming quiz deadlines
- Their quiz scores and assignment grades to identify weak areas (anything below 60%)
- Their saved timetables with class schedules and recommended study times
- Their pending reminders and tasks

**Step 2 — Learning Profile:** The system checks the student's VARK learning profile stored in the `learningProfiles` collection. This tells the AI whether the student is a visual, auditory, reading, or kinesthetic learner. The AI adapts its communication style accordingly — for visual learners, it might suggest diagrams; for kinesthetic learners, it might suggest hands-on exercises.

**Step 3 — VARK Assessment Gate:** If the student has not completed their VARK assessment yet, they are shown a 5-question quiz before they can access any AI features. The quiz presents scenarios and asks how the student would prefer to learn. Based on their answers, the system counts which style appears most frequently and stores the dominant style as their learning profile.

**Step 4 — RAG Retrieval:** When the student sends a message, the system retrieves the top 5 most relevant chunks from all their enrolled courses using the RAG pipeline. The student's message is used as the search query.

**Step 5 — System Prompt Construction:** The AI receives a carefully constructed system prompt that includes:
- The knowledge base prompt for the "rag_companion" domain, which instructs the AI to ground answers in source material and cite using `[Source N]` notation
- The student's name and learning style
- The current page context (what the student is looking at)
- The student's academic metadata (courses, grades, deadlines)
- The formatted RAG context with numbered sources

**Step 6 — Chat History:** The system maintains a conversation history of the last 20 messages in the `aiChatHistory` collection. This gives the AI context about previous questions in the same session, enabling multi-turn conversations.

**Step 7 — Response Generation:** The message is sent to Gemini 2.5 Flash using the `chat_completion()` function with temperature 0.7 (slightly creative for conversational tone). The response is returned to the frontend along with citation metadata.

*[Send a message like "Boleh terangkan konsep imbuhan dalam Bahasa Melayu?"]*

Notice how the response cites specific sources from the course materials. These citations link back to actual lecture notes and resources in the system.

---

## PART 5: AI Study Guide — Personalised Daily Study Plan

### Demo Flow

*[Navigate to AI Study Guide on mobile or web]*

This is the AI Study Guide. It generates a personalised daily study plan for each student based on their courses, performance, deadlines, and class timetable.

### How It Works

**Step 1 — Data Collection:** The system collects:
- All enrolled courses with their assignments and quizzes
- Assignment deadlines and the student's submission status for each
- Quiz deadlines and the student's attempt scores
- The student's overall performance to identify weak areas
- All saved timetables with class schedules

**Step 2 — Timetable Integration:** This is a key feature. The system loads all of the student's saved timetables and extracts their class schedule for today. It identifies free time slots between classes. For example, if a student has class from 8:00 AM to 10:00 AM and then from 2:00 PM to 4:00 PM, the system knows there is a free slot from 10:00 AM to 2:00 PM that can be used for studying.

**Step 3 — RAG Retrieval for Weak Areas:** The system identifies courses where the student is performing below 60% and retrieves relevant RAG content for those areas. This ensures the AI can recommend specific topics and resources to study.

**Step 4 — GAG Study Plan Generation:** All of this data is passed to the GAG study plan artifact generator. The prompt includes strict scheduling rules:
- Study sessions must be scheduled in free gaps between classes
- Sessions must never overlap with scheduled classes
- Times must be in AM/PM format (e.g., "9:00 AM - 10:00 AM")
- Recommendations must be sorted chronologically by suggested time
- Each recommendation must include a difficulty rating (1-5) based on past performance
- Each recommendation must include resource links from RAG sources

**Step 5 — Frontend Display:** The JSON artifact is rendered as:
- A daily schedule summary banner showing the day's overview
- Individual recommendation cards sorted by time, each showing the course name, topic, suggested time slot (cyan badge), reason, estimated duration, and priority level (high/medium/low with color coding)
- A motivational message

*[Show the recommendation cards with time badges]*

Notice how each card shows a specific time like "10:00 AM - 12:00 PM" — this is scheduled around the student's actual class timetable. The cards are sorted chronologically so the student can follow them throughout the day.

---

## PART 6: AI Timetable Analysis and Calendar Integration

### Demo Flow

*[Navigate to the Timetable tab in AI Study Guide]*

### How It Works

**Step 1 — Input:** Students can either paste their timetable as text or upload a PDF of their class schedule.

**Step 2 — PDF Text Extraction:** For PDF uploads, the system uses PyPDF2 to extract text from every page of the document. The extracted text is limited to 5MB.

**Step 3 — AI Parsing:** The extracted text is sent to Gemini with a structured prompt that asks it to parse the timetable into a JSON format with:
- `parsed_schedule`: An array of day objects, each containing classes with time (in AM/PM format), subject name, and location
- `recommended_study_times`: Free slots between classes suitable for studying, with day, time, duration in minutes, and a reason explaining why it is a good study slot
- `issues`: Any problems detected in the timetable (e.g., overlapping classes)
- `amendments`: Suggested improvements
- `suggestions`: General study tips

**Step 4 — Save and Persist:** Students can save their parsed timetable with a semester label (e.g., "Semester 2 2025/2026"). The saved timetable is stored in Firestore's `savedTimetables` collection.

**Step 5 — Calendar Integration:** This is where it gets powerful. The Calendar/Planner page aggregates events from multiple sources:
- Assignment deadlines from enrolled courses
- Quiz deadlines from enrolled courses
- Personal reminders/tasks
- **Class events from saved timetables** (shown in green)
- **Recommended study times from saved timetables** (shown in cyan)

The backend's calendar endpoint reads all saved timetables for the student and generates recurring weekly events. For each day in the requested month, it matches the weekday (Monday, Tuesday, etc.) to the timetable schedule and creates individual event objects for each class and study slot. These events include the time, location, and course name. All events are sorted by date and then by time.

*[Navigate to Calendar and show class events in green and study time events in cyan]*

You can see the green "class" events and cyan "study time" events appearing on the calendar alongside assignment deadlines (amber) and quiz deadlines (purple). Each event shows the time slot and location.

---

## PART 7: AI Study Materials Generation

### Demo Flow

*[Navigate to AI Study Materials]*

### How It Works

This module generates three types of study materials from course content:

**Mode 1 — From a Specific Resource:**

When a student selects a specific resource (like a PDF lecture note) and chooses a generation type:

1. The system fetches the module item from Firestore
2. If it is a PDF, the text is extracted using PyPDF2 (limited to 10,000 characters)
3. If it is not a PDF, the title and URL are used as the source text
4. The text is sent to Gemini with a type-specific prompt

**Mode 2 — By Topic with RAG:**

When a student enters a topic and selects a course:

1. The RAG pipeline retrieves the top 8 chunks related to that topic from the course
2. If fewer than 2 relevant chunks are found, the system returns an error (not enough source material)
3. The RAG context is formatted and included in the generation prompt
4. The response includes `sources` metadata linking back to the original documents

**Three Generation Types:**

1. **Summary** — A concise markdown-formatted summary with key points, definitions, and examples. Generated as plain text.

2. **Flashcards** — A JSON array of 10-15 flashcard objects, each with a `front` (question/term) and `back` (answer/definition). Designed for spaced repetition study.

3. **Practice Quiz** — A JSON array of quiz questions with `question`, `type` (mcq or true_false), `options` (for MCQ), `correct_answer`, and `explanation`. Provides immediate feedback.

All generated materials are saved in the `generatedStudyMaterials` collection for later access. Students can view, regenerate, or delete their materials.

---

## PART 8: AI Grading System

### Demo Flow

*[Login as lecturer1@mysmartstudy.com, navigate to a submission]*

### How It Works

This is the AI-assisted grading system for lecturers. When a lecturer clicks "AI Grade Recommendation" on a student's submission:

**Step 1 — Caching Check:** The system first checks if a recommendation already exists in the `aiGradeRecommendations` collection. If it does, it returns the cached result immediately.

**Step 2 — Content Extraction:** The system extracts the submission content:
- If the submission type is "map" (mind map), it retrieves the map's `nodesText` field
- If there is a file path, it extracts text using PyPDF2
- Otherwise, it uses the student's comments or external link
- Content is limited to 8,000 characters

**Step 3 — Rubric Loading:** If a rubric exists for the assignment, the system loads the criteria (e.g., "Isi Kandungan: 40 points", "Persembahan: 20 points", "Bahasa: 20 points", "Kreativiti: 20 points").

**Step 4 — Class Statistics:** The system calculates the mean and median grades from all already-graded submissions for the same assignment. This gives the AI context about how other students performed.

**Step 5 — RAG Context:** The system retrieves the top 3 most similar past submissions from the same course for comparative analysis.

**Step 6 — GAG Report Generation:** All of this data is passed to the GAG grading report generator. The system prompt instructs the AI to act as an "educational assessment specialist" and evaluate objectively using the rubric.

**Step 7 — Output:** The result is a structured JSON containing:
- `recommended_grade`: A numerical grade (e.g., 78.5)
- `criterion_scores`: Per-criterion scores matching the rubric
- `justification`: A text explanation of why this grade was given
- `confidence`: A score from 0 to 1 indicating how certain the AI is
- `comparative_analysis`: How this submission compares to the class average
- `improvement_suggestions`: Specific suggestions for improvement, each with a link to a relevant learning resource from the RAG pipeline

The lecturer can then review this recommendation and either accept the suggested grade, adjust it, or override it entirely. The AI recommendation is a suggestion — the final grading decision always rests with the lecturer.

---

## PART 9: AI Plagiarism Detection

### Demo Flow

*[Navigate to a submission and click "Check Plagiarism", or show assignment-level network analysis]*

### How It Works

The plagiarism detection system operates at two levels:

**Level 1 — Individual Submission Analysis:**

When a lecturer checks an individual submission:
1. The submission content is extracted (same process as grading)
2. The content is sent to Gemini with the "plagiarism" knowledge base prompt, which instructs the AI to look for suspicious patterns: overly formal language, lack of personal voice, inconsistent terminology, known AI phrasing patterns, and content matching common sources
3. The AI returns a `plagiarism_percentage`, a list of `sources` (categorised as ai_generated, web, book, or article), and a narrative `summary`
4. The result is cached in the `aiPlagiarismReports` collection

**Level 2 — Assignment-Wide Network Analysis:**

This is the more sophisticated approach. When a lecturer runs network analysis for an entire assignment:

1. **Similarity Graph Construction:** The Knowledge Graph service extracts content from every submission for the assignment, embeds each one using `text-embedding-004`, and computes pairwise cosine similarity between all submissions. This creates a similarity graph where each node is a student and each edge represents how similar their submissions are.

2. **Cluster Detection:** The system identifies clusters of highly similar submissions using a connected components algorithm with a similarity threshold of 0.7 (70% similar). These clusters are detected using BFS traversal on the similarity graph, only following edges above the threshold.

3. **GAG Report Generation:** If clusters are found, the system passes the similarity graph, detected clusters, and actual content samples to the GAG plagiarism network report generator. This produces a detailed analysis for each flagged cluster, including what specific content is shared, whether the similarity appears intentional (e.g., students working together vs. copying), a severity level, and a summary narrative.

4. **Network Visualization:** The frontend renders the similarity graph visually, showing nodes (students) connected by edges (similarity scores). Flagged clusters are highlighted. The lecturer can click on any cluster to see the detailed analysis.

---

## PART 10: AI Mind Map Buddy

### Demo Flow

*[Navigate to a mind map and open the AI Buddy panel]*

### How It Works

The AI Mind Map Buddy is an intelligent assistant embedded in the mind map editor. It provides four functions:

**Function 1 — Map Analysis:**

When a student clicks "Analyse my map", the system sends the map's title, all nodes (with labels), all edges (connections), the task description, and the map type to Gemini. The AI evaluates the map and returns:
- A rating from 1 to 10 with a descriptive label
- A list of strengths (what the student did well)
- A list of improvements (what could be better)
- Suggested new nodes to add
- A recommended map type (if the current type is unsuitable)
- Structural feedback on the overall organisation

The system also considers the student's preferences stored in the `aiMindmapBuddyMemory` collection, such as their preferred map type and experience level.

**Function 2 — Node Recommendations:**

When a student right-clicks a node and asks for child node suggestions:
1. RAG retrieves the top 3 chunks related to the node's label from the student's courses
2. The Knowledge Graph is queried for related concepts at depth 1 (immediate neighbors)
3. These two sources of context are combined with the node's label and its siblings
4. Gemini generates 5 child node suggestions, each with a label and description

**Function 3 — Full Map Suggestions (Suggest All):**

This is the most comprehensive suggestion function:
1. The system gets the student's enrolled courses
2. RAG retrieves top 5 chunks for the map title combined with existing node labels
3. The Knowledge Graph is queried for related concepts at depth 2 (two hops away)
4. If sufficient context is available, the GAG graph suggestions generator is called, which produces suggestions with labels, descriptions, parent connections, source references, and Knowledge Graph connections
5. If context is insufficient, a direct prompt fallback is used

**Function 4 — Chat:**

The AI Buddy also has a conversational chat interface:
- Maintains per-user conversation history (last 30 messages)
- Stores user preferences (map type, experience level)
- RAG retrieves top 3 chunks for each chat message
- Responses are conversational and educational, focused on helping the student improve their mind map

---

## PART 11: Gamification System

### Demo Flow

*[Navigate to Achievements page]*

### How It Works

The gamification system has 11 built-in badges that are automatically awarded based on student actions:

| Badge | Condition | Points |
|-------|-----------|--------|
| Cartographer | Create 1 mind map | 25 |
| Map Master | Create 5 mind maps | 25 |
| On Fire | 3-day login streak | 25 |
| Unstoppable | 7-day login streak | 25 |
| Top Marks | Score 90% or above on any quiz | 25 |
| Early Bird | Submit assignment 24 hours before deadline | 25 |
| Quiz Whiz | Complete 5 quizzes | 25 |
| Helper | Write 3 peer reviews | 25 |
| Completionist | Complete all activities in a course | 25 |
| Explorer | Join your first course | 25 |
| Team Player | Collaborate on 3 mind maps | 25 |

**Auto-Award Process:**

The `check_and_award_badges()` function runs after key student actions (submitting assignments, completing quizzes, etc.):

1. It checks only students (skips admin and lecturer roles)
2. For each of the 11 built-in badges, it checks if the student already has it
3. If not, it runs the specific condition checker:
   - `maps_created`: Counts documents in MAPS collection owned by the student
   - `streak_days`: Checks the user's streak field in their profile
   - `quiz_score`: Checks QUIZ_ATTEMPTS for any attempt with percentage >= 90
   - `quizzes_completed`: Counts unique quiz attempts
   - `assignments_submitted`: Counts submissions by the student
   - `peer_reviews`: Counts peer reviews authored by the student
   - `early_submissions`: Checks if `deadline - submitted_at > 86400 seconds` (24 hours)
   - `course_completed`: Verifies all assignments AND quizzes in a course are done
   - `collaborations`: Counts MAPS where the student appears in the collaborators array
   - `courses_joined`: Counts courses where the student is in enrolledStudents
4. If the condition is met, the badge ID is added to the user's `badges` array using Firestore's ArrayUnion operation
5. A notification is created to inform the student

**Custom Badges:**

Lecturers can also create custom badge definitions through the Manage Badges page. These custom badges are stored in the `badgeDefinitions` collection and are checked alongside the built-in badges during the auto-award process. Lecturers can also manually award or revoke badges.

**Streak System:**

The login streak is tracked by checking the `lastActiveAt` timestamp on the user's profile. If the student logs in on consecutive days, the streak counter increments. If there is a gap, the streak resets to 1. The streak is updated on every login.

---

## PART 12: Messaging System

### Demo Flow

*[Navigate to Messages]*

### How It Works

The messaging system supports private direct messaging between any two users — student-to-student or student-to-lecturer.

1. **User Search:** Students can search for other users by name using the `/api/messages/search-users` endpoint
2. **Conversation Creation:** When starting a new conversation, the system checks if a conversation between the two users already exists. If yes, it returns the existing one. If no, it creates a new conversation document with both participant IDs.
3. **Message Sending:** Each message stores the conversation ID, sender ID, sender name, text, a `readBy` array (initially containing only the sender), and a timestamp.
4. **Read Tracking:** When a user opens a conversation, their ID is added to the `readBy` array of unread messages. Unread messages are indicated by a dot on the conversation list.
5. **Polling:** The frontend polls for new messages every 5 seconds. While not true real-time, this provides a near-real-time experience.
6. **Notifications:** When a message is sent, a notification is created for the recipient.

---

## PART 13: Planner and Calendar

### Demo Flow

*[Navigate to Planner/Calendar]*

### How It Works

The Calendar aggregates five types of events into a unified monthly view:

1. **Assignment Deadlines** (blue dots) — Fetched from all enrolled courses, filtered by deadline in the selected month
2. **Quiz Deadlines** (purple dots) — Same approach as assignments
3. **Personal Reminders** (amber dots) — From the reminders collection for the current student
4. **Class Events** (green dots) — Generated from saved timetables, matched by weekday
5. **Study Time Slots** (cyan dots) — Recommended study times from saved timetables

The Task Management section allows students to:
- Create tasks with a title, type (study/assignment/exam/personal), priority (high/medium/low), and date
- Toggle task completion
- Delete tasks
- Filter tasks by priority or completion status

---

## PART 14: Attendance System

### Demo Flow

*[Login as lecturer, navigate to Attendance]*

### How It Works

1. **Lecturers** create attendance sessions for a specific date with a title (e.g., "Kelas Minggu 3")
2. When a session is created, attendance records are initialised for all enrolled students with a default status of "absent"
3. The lecturer can mark each student as present, absent, late, or excused
4. Bulk operations allow marking all students at once
5. **Students** can view their attendance history per course, including attendance percentage and status badges (green for present, red for absent, amber for late, blue for excused)

---

## PART 15: The Core AI Service Layer

### How Gemini Integration Works

All AI features in MySmartStudy communicate through a central `ai_service.py` module. This module provides three core functions:

1. **`generate_text()`** — For plain text generation. Used for summaries, chat responses, and study material text.

2. **`generate_json()`** — For structured JSON generation. Used by all GAG functions, timetable parsing, flashcard generation, and quiz generation. This function has built-in retry logic: if JSON parsing fails on the first attempt (due to Gemini returning markdown fences or malformed JSON), it strips code fences, attempts regex extraction of JSON objects, and retries once. This makes the system robust against formatting inconsistencies.

3. **`chat_completion()`** — For multi-turn conversations. Used by the AI companion and Mind Map Buddy chat. Supports conversation history with role-based message formatting.

**Model:** All three functions use Gemini 2.5 Flash by default.

**Temperature Tuning:**
- 0.2 — Knowledge Graph concept extraction (high accuracy needed)
- 0.3 — JSON generation defaults (structured, predictable)
- 0.5 — Mind map suggestions, grading (balanced)
- 0.7 — Chat conversations (natural, creative)

**Safety Settings:** All categories (harassment, hate speech, sexually explicit, dangerous content) are set to `BLOCK_ONLY_HIGH` to allow educational content to flow through while blocking clearly harmful content.

---

## PART 16: System Architecture Summary

### Data Flow

```
Student/Lecturer Action
         |
         v
   Flutter Mobile / Next.js Web
         |
         v (HTTP + JWT Bearer Token)
   FastAPI Backend (Python)
         |
    +-----------+------------+-----------+
    |           |            |           |
    v           v            v           v
 Firestore   ChromaDB    Gemini     Knowledge
 (Database)  (Vectors)   2.5 Flash   Graph
    |           |            |           |
    +-----+-----+-----+-----+-----+-----+
          |           |           |
          v           v           v
       RAG Pipeline  GAG Framework  BFS Traversal
          |           |           |
          +-----+-----+-----+-----+
                      |
                      v
              AI Features Output
     (Study Guide, Grading, Plagiarism,
      Companion, Mind Map, Materials)
```

### Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Mobile Frontend | Flutter/Dart |
| Web Frontend | Next.js 16, TypeScript, Tailwind CSS v4, React Flow |
| Backend | FastAPI (Python), Uvicorn |
| Database | Google Firestore (NoSQL) |
| Authentication | Firebase Auth + JWT (HS256) |
| AI Model | Google Gemini 2.5 Flash (google-genai SDK) |
| Embeddings | Google text-embedding-004 |
| Vector Store | ChromaDB (persistent, cosine similarity) |
| PDF Processing | PyPDF2 |

### Key Numbers

| Metric | Value |
|--------|-------|
| AI Modules | 6 (Companion, Study Guide, Materials, Grading, Plagiarism, Mind Map Buddy) |
| RAG Chunk Size | 500 tokens with 50-token overlap |
| Embedding Dimensions | 768 (text-embedding-004) |
| ChromaDB Collections | 1 per course |
| GAG Artifact Types | 4 (Study Plan, Grading Report, Graph Suggestions, Plagiarism Report) |
| Knowledge Graph | Per-course, 10-20 concepts per batch, BFS traversal |
| Built-in Badges | 11 auto-awarded |
| Supported Platforms | Web (Next.js), Mobile (Flutter), API (FastAPI) |
| Default AI Temperature | 0.3 (JSON), 0.7 (chat) |

---

## Closing

MySmartStudy demonstrates how modern AI techniques — RAG, GAG, Knowledge Graphs, and gamification — can be integrated into a learning management system to create a truly personalised educational experience. Every AI feature is grounded in actual course content through the RAG pipeline, produces structured outputs through the GAG framework, and connects concepts through the Knowledge Graph. The system adapts to each student's learning style, class schedule, and academic performance to provide targeted, timely, and relevant study support.

Thank you. I am happy to take any questions.

---

## Quick Reference: Login Credentials for Demo

All accounts use password: `Test1234!`

| Account | Email | Role |
|---------|-------|------|
| Dr. Siti Aminah | lecturer1@mysmartstudy.com | Lecturer (BM) |
| Prof. Ahmad Razak | lecturer2@mysmartstudy.com | Lecturer (CS) |
| Dr. Lim Wei Shan | lecturer3@mysmartstudy.com | Lecturer (MT) |
| Dr. Kavitha Nair | lecturer4@mysmartstudy.com | Lecturer (SN) |
| Prof. Zulkifli Hassan | lecturer5@mysmartstudy.com | Lecturer (IT) |
| Nurul Aisyah | student1@mysmartstudy.com | Student (PISMP BM) |
| Muhammad Hafiz | student2@mysmartstudy.com | Student (PISMP SK) |
| Tan Mei Ling | student3@mysmartstudy.com | Student (PISMP MT) |
| Arun Prasad | student4@mysmartstudy.com | Student (PISMP SN) |
| Fatimah Zahra | student5@mysmartstudy.com | Student (PISMP IT) |
| Admin | admin@mysmartstudy.com | Admin |
