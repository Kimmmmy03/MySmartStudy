# MySmartStudy: Class Management Implementation Spec

## Role & Objective
You are a Lead Full-Stack Engineer. Your task is to build out the "Class Management" module inside the `/frontend-web` (Next.js) and connect it to `/backend` (FastAPI). 
This module has 4 main tabs: Resources, Assignments, Announcements, and Class Chat. 
**Crucial Rule:** The UI and permissions must strictly adapt based on the user's role (`Lecturer` vs `Student`). 

---

## TAB 1: Resources (Course Materials)
**Objective:** A centralized repository for class materials and map templates.

### Lecturer View (The Creator)
- **UI Element:** A "+ Add Resource" primary button.
- **Upload Modal:** A drag-and-drop zone. Fields include Title, Description, Module/Week dropdown, and File Type (PDF, Video Link, or Map Template). 
- **Visibility Control:** A date-picker to set "Unlock Date" (e.g., hide Week 3 notes until Week 3 starts).
- **Backend/API:** `POST /api/classes/{class_id}/resources` -> Uploads file to Firebase Storage, saves metadata to Firestore.

### Student View (The Consumer)
- **UI Element:** A clean list/grid organized by Module/Week. Hidden items do not render.
- **Progress Tracking:** A visual indicator (e.g., a hollow circle that turns into a green checkmark) when a student clicks to open a resource.
- **Preview Modal:** Clicking a PDF opens a Next.js Lightbox/Modal to view the document without leaving the app.
- **The "Template" Action:** If the resource is a "Thinking Map Template", the button says "Use Template". Clicking this triggers `POST /api/resources/{resource_id}/clone`, which copies the map JSON to the student's personal account and redirects them to the React Flow editor.

---

## TAB 2: Assignments
**Objective:** Task management, submission portal, and grading center.

### Lecturer View (The Grader)
- **Dashboard UI:** A high-level list of active assignments showing progress bars (e.g., "15/30 Submitted").
- **Creation Modal:** - Inputs: Title, Rich-text Description, Deadline (Date/Time picker).
  - *Smart Feature:* A dropdown for "Required Map Type" (e.g., Must submit a Flow Map).
- **Grading Slide-Over Panel:** Clicking an assignment opens a list of students. Clicking a student slides a panel from the right:
  - *Left Side of Panel:* Displays the student's submitted Map (View-Only React Flow component) or PDF.
  - *Right Side of Panel:* A grading rubric, a number input for the Score, and a text area for Feedback.
  - *Action:* "Save Grade & Return" triggers `POST /api/submissions/{sub_id}/grade`.

### Student View (The Submitter)
- **Dashboard UI:** A Kanban board with 3 columns: "To Do" (Red), "Submitted" (Yellow), "Graded" (Green). 
- **Submission Modal:** Clicking a "To Do" assignment opens a modal with two tabs:
  - *Tab 1: Upload File* (Standard PDF/Doc upload).
  - *Tab 2: Attach Thinking Map.* Renders a visual grid of the student's personal maps. Clicking one selects it.
  - *Action:* "Submit Assignment" triggers `POST /api/assignments/{assign_id}/submit`.
- **Feedback Modal:** Clicking a "Graded" assignment pops up a modal showing their score and the specific feedback text from the lecturer.

---

## TAB 3: Announcements
**Objective:** Persistent, one-way broadcasts from the Lecturer to the class.

### Lecturer View (The Broadcaster)
- **UI Element:** A "New Announcement" text box at the top of the feed (similar to creating a social media post).
- **Creation Tools:** Rich-text support (bold, bullet points). 
- **The "Urgent" Toggle:** A switch labeled "Mark as Urgent / Send Push Notification".
  - *Backend Action:* If toggled, the FastAPI route `POST /api/announcements` must trigger a Firebase Cloud Messaging (FCM) payload to all students enrolled in the class, pinging their mobile devices.
- **Management:** 3-dot menu on their posts to "Edit" or "Delete".

### Student View (The Reader)
- **UI Element:** A chronological scrolling feed.
- **Visual Hierarchy:** "Urgent" announcements must have a distinct UI (e.g., a red border and a warning icon) and stick to the top of the feed until acknowledged.
- **Read Receipts:** Clicking "Acknowledge" on an urgent post triggers `POST /api/announcements/{id}/read` so the lecturer knows who saw it.

---

## TAB 4: Class Chat (Discussions)
**Objective:** Real-time peer support and Q&A.

### Lecturer View (The Moderator)
- **UI Element:** A Discord-like interface. A left sidebar with "Channels" (e.g., `#general`, `#assignment-help`).
- **Moderation Powers:** Lecturers have a "Delete" icon next to every student message to remove inappropriate content.
- **Channel Management:** A "+ Create Channel" button to organize topics.

### Student View (The Participant)
- **UI Element:** Same chat interface, but without channel creation or global delete powers (can only delete their own messages).
- **Real-Time Sync:** This tab relies heavily on Firebase Firestore `onSnapshot` listeners. Messages must appear instantly without page refreshes.
- **Smart Attachments:** A paperclip icon next to the chat input allows students to easily link one of their Thinking Maps into the chat for peer review.

---
**Execution Instructions:**
Please read this specification carefully. Start by building TAB 1 (Resources) for both roles, including the UI and the necessary FastAPI endpoints. Do not move to Tab 2 until I approve Tab 1.