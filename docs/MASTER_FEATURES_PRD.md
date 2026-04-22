# MySmartStudy: Master Feature Implementation Specification

## Role & Execution Protocol
You are a Lead Full-Stack Engineer. Your task is to implement the comprehensive feature set for "MySmartStudy" across the `/frontend-web` (Next.js/React) and `/backend` (FastAPI/Python) directories. 

**STRICT EXECUTION RULE:** Do NOT attempt to build everything at once. You must execute this document epic-by-epic. After completing an Epic, you must stop, run a test, and ask for my approval before moving to the next Epic.

## Global Architectural Constraints
1. **UI/UX Standard:** All frontend components must utilize modern, animated, high-contrast designs inspired by `reactbits.dev`. Use Tailwind CSS and Framer Motion for smooth transitions.
2. **Backend Mandate:** EVERY feature listed below must have a dedicated FastAPI route in `/backend`. No mock data is allowed on the frontend.
3. **Database & Mobile Sync:** Firebase Firestore is the single source of truth. Data must be structured to support a "View-Only" Flutter mobile app (e.g., Mindmap data is saved as lightweight JSON, images are stored in Firebase Storage and linked via URL).

---

## EPIC 1: Core System & Role-Based Access Control (RBAC)
**Goal:** Establish secure routing and user distinction.
- **RBAC Middleware:** Implement strict checks in both Next.js middleware and FastAPI dependencies. Roles: `Student`, `Lecturer`, `Admin`. Block unauthorized access (e.g., Students trying to view `/lecturer/dashboard`).
- **Audit Logging:** Create a background utility in FastAPI that logs every Create, Update, and Delete action with a `Timestamp` and `UserID` to a specific Firestore `AuditLogs` collection.

---

## EPIC 2: The Student Command Center
**Goal:** Build the Student Dashboard (`/frontend-web/app/dashboard`) to reduce "time-to-study".
- **Recent Thinking Maps:** Build a horizontal carousel. Connect to FastAPI endpoint that queries Firestore: `where('ownerId', '==', uid).orderBy('lastModified', 'desc').limit(5)`. Ensure the payload includes a lightweight `thumbnailUrl` for mobile optimization.
- **Activity Feed:** Create a chronological timeline component showing interactions (e.g., "You edited Biology Map 2 hours ago").
- **Gamification Engine (Backend):** Create FastAPI logic that listens to user actions. If triggers are met (e.g., `map_created_count == 10`), award a badge with proper string naming (e.g., "Map Master") and trigger a frontend confetti animation.
- **Learning Stats:** Implement `recharts` to show "Active Study Days" and compare current vs. past month map creation.
- **Notification Dropdown:** Integrate Firebase Cloud Messaging (FCM) to show alerts, differentiating visually between "Urgent" (Assignments) and "Informational".

---

## EPIC 3: The Thinking Map Engine (Core Module)
**Goal:** Build the infinite canvas editor using `reactflow` and enable real-time collaboration.
- **The Canvas:** Implement an infinite panning/zooming workspace with a toolbar for shapes (nodes), connectors (edges), and text. Include Undo/Redo state management.
- **AI Recommendation Assistant:** Build a sidebar that reads the user's input (e.g., "Differences between...") and suggests the appropriate map template (e.g., "Double Bubble Map").
- **Real-Time Collaboration (Firestore Rooms):** - Sync node movements in milliseconds using Firestore Snapshot Listeners. 
  - Implement visual presence: Highlight the specific node another user is editing with their name tag.
  - Apply "Last-Write-Wins" or node-locking to prevent simultaneous edit conflicts.
- **Auto-Save & Offline Persistence:** Update local React state instantly on keystroke/drag, but debounce the Firestore write by 1.5 seconds. **Crucial:** Enable `offlinePersistence` in the Firebase Web SDK so students can work without Wi-Fi.

---

## EPIC 4: Virtual Learning Environment (VLE) & Assignments
**Goal:** Build the academic workflow for both Students and Lecturers.
- **Class Management:** Lecturers generate a 6-digit alphanumeric code. Students use this to instantly enroll. Show a roster with "last active login" timestamps.
- **CMS Builder:** A drag-and-drop interface for Lecturers to organize Courses -> Chapters -> Topics, and upload files.
- **File Submissions:** Build a secure file upload system. The FastAPI backend MUST validate file headers (magic numbers), not just file extensions, to prevent malicious uploads.
- **Assignment Linking:** When a student submits an assignment, open a modal showing their MySmartStudy map library. They click a map, and the system links that Map ID to the assignment payload.
- **Grades & Feedback:** Build a gradebook. Students click a grade to see the lecturer's specific notes.
- **Lecturer Annotation Mode:** When viewing a student's map, the Lecturer can use a "Red Pen" tool or drop "Sticky Notes." **Rule:** These annotations must be saved as an *overlay* layer in the JSON data, completely separate from the student's original map data so it does not alter their work.

---

## EPIC 5: Analytics, Reminders & System-Wide Features
**Goal:** Implement automated tracking and background jobs.
- **The Cron Engine (FastAPI):** Set up a background task scheduler (e.g., `APScheduler`) in Python.
  - *Study Reminders:* If a map is unedited for >3 days, push an FCM alert.
  - *Assignment Alerts:* Push FCM alerts 24hrs and 2hrs before deadlines.
  - *Data Structure:* Send these as "Data Messages" via FCM so the Mobile App can receive them silently in the background.
- **Lecturer Analytics Dashboard:** Aggregate data to show which map types are most popular and identify "at-risk" students based on inactivity. Use heatmaps and bar charts.
- **Academic Integrity Check:** Create a basic algorithm in FastAPI that compares text node strings across submitted maps to flag high similarity percentages.

---

## EPIC 6: Mobile Scalability Lockdown
**Goal:** Ensure the backend perfectly supports the view-only Flutter app.
- **Security Rules:** Write strict Firestore Security Rules. Ensure the mobile app uses a token that grants "Read-Only" access to map node coordinates, preventing the mobile app from accidentally mutating complex map layouts.
- **Storage Structure:** Enforce a strict file path in Firebase Storage: `/{CourseID}/{SubjectID}/{AssignmentID}/files`. This prepares the backend for future mobile photo-scanning uploads.

very all features below has been added:features to be added:
Student Dashboard Page
1.1 Purpose The Student Dashboard serves as the "Command Center" for the application. Upon logging in, the student is not overwhelmed with menus but is presented with immediate, actionable data. Its primary goal is to reduce the "time-to-study" by offering one-click access to current projects and a summarized view of academic health.
1.2 Dashboard Overview Features A. Recent Thinking Maps
•	Detailed Workflow: A horizontal carousel or grid displaying the 3-5 most recently active Thinking Maps. Instead of navigating deep into folders, the student sees their current work immediately.
•	Technical Implementation:
o	Query: Firestore performs a query on the maps collection: where('ownerId', '==', uid).orderBy('lastModified', 'desc').limit(5).
o	[FUTURE PROOFING]: The database stores a thumbnailUrl (a small preview image) for each map. This ensures that when the Mobile App loads this list later, it doesn't need to download the heavy map data, just the lightweight preview image.
B. Activity Overview
•	Detailed Workflow: A chronological feed of events. It shows not just creation, but interaction: "You edited 'Biology Map' 2 hours ago" or "Ali commented on 'Group Project'".
•	Educational Value: This promotes metacognition (thinking about thinking). By seeing their activity history, students can visually track their engagement levels.
1.3 Progress Tracking System A. Badges & Milestones
•	Detailed Workflow: A gamification engine that runs in the background. It listens for specific triggers (e.g., map_created_count == 10). When a trigger is hit, a visual celebration (confetti animation) appears, and the badge is permanently added to their profile.
•	Examples: “Map Master” (Awarded for creating different types of maps), “7-Day Study Streak” (Awarded for consecutive logins).
B. Learning Statistics
•	Detailed Workflow: Visual graphs (bar or line charts) showing data points like "Maps created this month" vs. "Last month."
•	Purpose: Provides intrinsic motivation. Seeing the "Active Study Days" graph go up encourages the student to maintain their habit.
1.4 Quick Start Options
•	Create Map: A primary Call-to-Action button that bypasses the menu to immediately launch the canvas.
•	Get Recommendation: Launches a wizard that asks, "What are you trying to learn?" (e.g., Define, Compare, Categorize) and opens the correct map template automatically.
1.5 Notification Tab
•	Detailed Workflow: A dropdown list containing alerts. Differentiates between "Urgent" (Assignment due) and "Informational" (New resource added).
•	Tech Integration: Uses Firebase Cloud Messaging (FCM). When a lecturer posts an assignment, a cloud function triggers a notification to all enrolled students.


2. Create & Collaborate Thinking Map Page
(The Core "Editor" Module)
Core Features
•	Canvas Interaction: Infinite canvas allows users to scroll in any direction.
•	Tooling: A toolbar containing shapes (nodes), connectors (arrows), and text tools.
•	State Management: Features Undo/Redo stacks to prevent accidental data loss.
2.1 Recommendation Engine
•	Detailed Workflow: An intelligent assistant sidebar. If a student types "Differences between..." the engine detects the keyword "Differences" and suggests switching to a Double Bubble Map (used for comparison).
•	Benefit: Scaffolds the learning process for beginners who don't know which map to use.
2.2 Real-Time Collaboration
•	Detailed Workflow: Up to 4 students enter the same map via a shared link. The system uses a "Room" concept in Firestore.
•	Synchronization: Changes are synced within milliseconds. If User A moves a node, User B sees it move instantly.
2.3 Collaboration Controls
•	Permissions: The creator sets roles. Viewers can only watch; Editors can modify.
•	Presence Awareness:
o	Real-time Cursor/Highlight: Instead of a flying mouse cursor (which is hard to sync on mobile later), the system highlights the Node currently being edited by another user in a specific color (e.g., "Ali is editing this box").
o	Conflict Resolution: If two users edit the same text simultaneously, the system applies a "Last-Write-Wins" logic or locks the node while one person is typing.
2.4 Auto-Save & Data Persistence
•	Detailed Workflow: Every keystroke or drag event updates the local state immediately, then debounces (waits 1-2 seconds) before writing to Firestore to save reads/writes.
•	[CRITICAL FUTURE PROOFING]:
o	Offline Logic: You must enable offlinePersistence in the Web Firestore settings. This means if the Wi-Fi cuts out, the student can keep working. The Web App caches the data locally and syncs it automatically when the internet returns. This is mandatory logic for the future Mobile App.
2.5 Mobile Data Compatibility (Backend Requirement)
•	Detailed Workflow: The map data is saved as JSON (coordinates, text, shape type). Images inside the map are stored separately in Firebase Storage, and only the Link is stored in the map JSON.
•	Reason: When the future Mobile App views this map, it loads the lightweight JSON text instantly, while the heavy images load lazily in the background

3. My Maps Page
3.1 Assignment Submission Integration
•	Detailed Workflow: When a student clicks "Submit" on an assignment, they don't browse their computer files. A modal opens showing their MySmartStudy library. They select a map, and the system links that map ID to the assignment.
3.2 Live Chat & Lecturer Monitoring
•	Lecturer View: The lecturer sees a list of active groups. Clicking one opens a "Spectator Mode" where they watch the map evolve live.
•	Chat Overlay: A chat sidebar allows the lecturer to type guidance ("Check your definition in the second branch") without altering the map itself.
3.2 add more customization to the mind map 

7. Reminder Feature (System-Wide)
7.1 Purpose Combats procrastination. It acts as an external regulator for the student's study habits.
7.2 Reminder Logic
•	Study Reminders: If a map is left in "Draft" mode for >3 days, a gentle nudge is scheduled.
•	Assignment Reminders: Hard deadlines trigger alerts at 24 hours and 2 hours before due time.
•	Custom Reminders: Students set their own goals ("Remind me to review this map on Saturday").
7.3 Reminder Workflow & Data Structure
•	Workflow: Cron job (or scheduled function) runs every hour -> Checks Firestore for due reminders -> Pushes to FCM.
•	Data Structure:
7.4 Notification Delivery
•	Web: A toast notification (top right corner).
•	[FUTURE PROOFING]: The FCM payload is structured as a "Data Message". This means the future Mobile App can receive this silent data in the background and decide whether to show a pop-up or just update the app badge number.
8. Learning Planner & Study Schedule
•	Detailed Workflow: A drag-and-drop calendar. Students drag a "Thinking Map Task" onto "Tuesday."
•	Integration: It syncs with the Reminder system. Placing a task on the calendar automatically creates a backend reminder for that time.
9. Announcements & Discussions
•	Detailed Workflow: A forum-style module for each Class. Supports threaded replies.
•	Moderation: Lecturers have a "Delete/Hide" button for inappropriate content.
10. Course & Module Management (VLE)
•	Detailed Workflow: Organize content into hierarchical structures (Course -> Chapter -> Topic). Students navigate linearly through materials.
•	Content View: Includes Course Overview, Learning Outcomes, and Weekly Modules containing tasks and resources.
11. Grades & Feedback (VLE)
•	Detailed Workflow: A gradebook view. Clicking a grade reveals the specific feedback note left by the lecturer on that assignment.
•	Status Indicators: Shows "Submitted," "Reviewed," or "Graded" status.
12. Participation Tracking (VLE)
•	Algorithm: Calculates a "Participation Score" based on weighted actions: Forum Post (5pts), Map Creation (10pts), Reply (2pts).
•	View: Students can see their attendance history per course.
13. File Submission & Storage (VLE)
•	Function: Allows submission of non-map files (PDF, Word, Slides).
•	Validation: The upload handler checks file headers to ensure a file named .pdf is actually a PDF, preventing security risks.
•	History: Tracks submission versions and enforces deadlines with "Late" tagging.
14. Learning Analytics & Reflection (VLE)
•	Metacognition: A pop-up at the end of the week asks: "How confident do you feel about this week's topics?"
•	Reporting: This qualitative data is stored alongside quantitative grades and visualized in progress charts.
15. Accessibility Features (VLE)
•	Compliance: WCAG 2.1 standards.
•	Features: High contrast toggles for visually impaired users; ARIA labels for screen readers; Captioned tutorial videos; Font size adjustments.
16. Academic Integrity (VLE)
•	Similarity Check: A basic algorithm that compares text content within Thinking Map nodes against other students' maps to detect copying.
•	Guidance: Citation reminders and integrity guidelines displayed during submission.


LECTURER FEATURES (WEB & VLE)
17. Lecturer Dashboard Page
•	Overview: A high-level summary. "You have 3 classes, 2 active assignments, and 15 pending submissions."
•	Action Required: A "To-Do" list for the lecturer (e.g., "Grade Group A's submission").
18. Class Management Page
•	Enrollment: Generates a unique 6-digit alphanumeric code (e.g., X7K-9P2). Students type this code to instantly join the class.
•	Roster: Lists all students with their last active login time, helping identify drop-outs.
19. Assignments Page
•	Creation Wizard: Lecturer sets Title, Description, Deadline, and Allowed Map Types (e.g., "Must use a Flow Map").
•	Digital Submission: Switches the assignment status to "Open."
20. Student Maps Review Page
•	Annotation Mode: When reviewing a student's map, the lecturer can use a "Red Pen" tool to circle areas or drop "Sticky Note" comments. These annotations are overlaid on the student's map but do not alter the student's original work.
•	Grading: Mark as reviewed and encourage improvements.
21. Analytics Page
•	Usage Stats: "Which map type is most popular?" (Helps lecturer know what students are comfortable with).
•	Weakness Detection: "80% of students struggled with the 'Causes' branch of the Multi-Flow map."
•	Adaptive Teaching: Helps identify weak learning areas to adjust teaching strategies.
22. Lecturer Resources Page
•	Content: Upload teaching materials, share sample maps, provide starter templates, and link external resources.
23. Profile & Settings Page (Lecturer)
•	Management: Edit profile, manage assigned courses, set notification preferences, and configure reminder alerts for grading and unreviewed submissions.
24. Course Content Management System (CMS) (VLE)
•	Builder: Drag-and-drop course module creator.
•	Uploads: Lecture notes, slides, videos.
•	Controls: Set content availability dates and control student access per module.
25. Engagement Dashboard (VLE)
•	Monitoring: Engagement heatmaps showing which days of the week students are most active.
•	Intervention: Identification of inactive or at-risk students with early intervention indicators.
26. Assessment & Evaluation Tools (VLE)
•	Methods: Continuous assessment tracking, peer assessment for group maps, self-assessment forms, and feedback templates.
27. Communication & Messaging Tools (VLE)
•	Direct Messaging: Secure Lecturer ↔ Student messaging.
•	Group Messaging: Class-wide announcements and scheduling.
•	Tracking: Read-receipt tracking to ensure messages are seen.
28. Lecturer Moderation & Control Tools (VLE)
•	Discipline: Approve or remove discussion posts.
•	Control: Lock or unlock maps, control collaboration permissions, and manage academic misconduct cases.

 SYSTEM-WIDE FEATURES
29. Role-Based Access Control (RBAC)
•	Logic: Middleware checks user.role before loading any page. If a Student tries to access /lecturer/dashboard, they are redirected.
•	Roles: Student, Lecturer, Admin.
30. System Administration Panel (Admin)
•	Functions: System-wide user reset, database backup triggers, storage quota monitoring, course lifecycle management.
31. Audit Logs & System Tracking
•	Compliance: Every "Create", "Update", "Delete" action is logged with a Timestamp and UserID for accountability and recovery.


35. MOBILE SCALABILITY 
This section defines how the Web Architecture protects the future Mobile rollout.
35.1 "View-Only" Architecture
•	Concept: The future Mobile App will act as a Review Companion, not a Creator Tool.
•	Web Backend Requirement: The API/Firestore security rules must support a "Read-Only" token. When the mobile app requests a map, the backend serves the data but rejects any write operations to the node coordinates. This simplifies the mobile build significantly (no complex drag-and-drop logic needed).
35.2 Companion Features Readiness
•	Scanning (Uploads): The file storage structure is organized by SubjectID/Type. This is crucial because mobile users will dump many photos (scanned notes) into these folders. The structure must remain organized from day one.
•	Real-Time Observation: The Firestore SnapshotListener used for Web Collaboration is the exact same technology the Mobile App will use to let a student "Watch" a group project live on their phone. No new code is needed; just a different UI implementation.
---
**END OF SPECIFICATION.**
Please confirm you have read this document. If confirmed, begin executing **EPIC 1**. Do not proceed to Epic 2 until Epic 1 is fully functional and I have approved it.