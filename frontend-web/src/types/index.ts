export interface AuthUser {
  id: string;
  uid: string; // alias for id — minimizes changes across pages that use user.uid
  email: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: "student" | "lecturer" | "admin";
  className: string;
  createdAt: string;
  photoURL?: string;
  streak?: number;
  points?: number;
  badges?: string[];
  enrolledIn?: string[];
  year?: number;
  semester?: number;
  department?: string;
}

export interface MindMap {
  id: string;
  ownerId: string;
  ownerEmail: string;
  title: string;
  graphData: string;
  graphFormat?: "reactflow" | "jointjs";
  nodes: string;
  thumbnail: string;
  shareCode: string;
  collaborators: string[];
  lastModified: string;
}

export interface Course {
  id: string;
  lecturerId: string;
  lecturerName?: string;
  courseName: string;
  courseCode: string;
  semester: string;
  year?: number | null;
  academicSession?: string;
  joinCode: string;
  enrolledCount: number;
  createdAt: string;
  description?: string;
}

export interface Assignment {
  id: string;
  lecturerId: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  submittedAt: string;
  studentId: string;
  studentName: string;
  submissionType: "map" | "link" | "file";
  mapId?: string;
  externalLink?: string;
  fileUrl?: string;
  fileName?: string;
  comments?: string;
  grade?: number;
  feedback?: string;
}

export interface DiscussionMessage {
  id: string;
  courseId: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: "student" | "lecturer";
  createdAt: string;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  content: string;
  senderName: string;
  senderId: string;
  createdAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  items: ModuleItem[];
  createdAt: string;
}

export interface ModuleItem {
  id: string;
  moduleId: string;
  title: string;
  type: string;
  url?: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  ownerId: string;
  date: string;
  title: string;
  type: "Assignment" | "Exam" | "Study" | "Personal";
  priority: "urgent" | "normal" | "low";
  isCompleted: boolean;
}
