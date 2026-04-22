import { auth } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ── Firebase token helper ──
async function getFirebaseToken(): Promise<string | null> {
  let user = auth.currentUser;
  if (!user) {
    // Auth state may not be resolved yet — wait briefly for it
    user = await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((u) => {
        unsubscribe();
        resolve(u);
      });
      // Don't wait forever — resolve null after 2s
      setTimeout(() => { unsubscribe(); resolve(null); }, 2000);
    });
  }
  if (!user) return null;
  return user.getIdToken();
}

// ── Generic request helper ──
async function request<T>(path: string, options?: RequestInit & { skipContentType?: boolean }): Promise<T> {
  const token = await getFirebaseToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!options?.skipContentType) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ── Public request helper (no auth, no 2s wait) ──
async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ── Types matching backend schemas (snake_case) ──
export interface UserOut {
  id: string;
  email: string;
  display_name: string;
  role: string;
  class_name: string;
  photo_url: string;
  year: number | null;
  semester: number | null;
  department: string | null;
  points: number;
  streak: number;
  badges: string[];
  created_at: string;
}

export interface MapOut {
  id: string;
  owner_id: string;
  owner_email: string;
  title: string;
  graph_data: string;
  graph_format: string;
  nodes_text: string;
  thumbnail: string;
  share_code: string;
  collaborators: string[];
  last_modified: string;
}

export interface CourseOut {
  id: string;
  lecturer_id: string;
  lecturer_name: string;
  course_name: string;
  course_code: string;
  semester: string;
  join_code: string;
  description: string;
  enrolled_count: number;
  theme_color: string;
  pattern: string;
  created_at: string;
}

export interface AssignmentOut {
  id: string;
  lecturer_id: string;
  course_id: string;
  title: string;
  description: string;
  deadline: string;
  allowed_map_types: string[];
  available_from: string | null;
  available_until: string | null;
  prerequisite_id: string | null;
  prerequisite_title: string | null;
  min_grade: number | null;
  assignment_type: string;
  quiz_id: string | null;
  attachments: { name: string; url: string; type: string }[];
  peer_review_enabled: boolean;
  created_at: string;
}

export interface AccessCheck {
  accessible: boolean;
  reasons: string[];
}

export interface SubmissionOut {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_photo_url?: string | null;
  submission_type: string;
  map_id: string | null;
  external_link: string | null;
  comments: string;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
}

export interface PlagiarismPair {
  student_a_id: string;
  student_a_name: string;
  student_a_type: string;
  student_b_id: string;
  student_b_name: string;
  student_b_type: string;
  similarity: number;
  severity: "high" | "medium" | "low";
}

export interface StudentRisk {
  student_id: string;
  student_name: string;
  submission_type: string;
  avg_similarity: number;
  max_similarity: number;
  flagged_pairs_count: number;
  risk_level: "clear" | "low" | "medium" | "high";
}

export interface FullPlagiarismReport {
  assignment_id: string;
  assignment_title: string;
  generated_at: string;
  total_submissions: number;
  analyzed_submissions: number;
  skipped_submissions: number;
  skipped_details: { student_id: string; student_name: string; reason: string }[];
  flagged_pairs: PlagiarismPair[];
  student_risks: StudentRisk[];
  overall_stats: {
    avg_similarity: number;
    max_similarity: number;
    flagged_count: number;
    high_severity_count: number;
    medium_severity_count: number;
    low_severity_count: number;
    students_at_risk: number;
  };
}

export interface DiscussionOut {
  id: string;
  course_id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_photo_url?: string | null;
  edited: boolean;
  edited_at: string | null;
  created_at: string;
}

export interface AnnouncementOut {
  id: string;
  course_id: string;
  title: string;
  content: string;
  sender_name: string;
  sender_id: string;
  sender_photo_url?: string | null;
  created_at: string;
}

export interface ModuleItemOut {
  id: string;
  module_id: string;
  title: string;
  type: string;
  url: string;
  file_type: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  unlock_date: string | null;
  embed_url: string | null;
  description: string | null;
  created_at: string;
}

export interface ResourceProgressOut {
  resource_id: string;
  opened_at: string;
}

export interface ModuleOut {
  id: string;
  course_id: string;
  title: string;
  description: string;
  items: ModuleItemOut[];
  created_at: string;
}

export interface ReminderOut {
  id: string;
  owner_id: string;
  date: string;
  title: string;
  type: string;
  priority: string;
  is_completed: boolean;
}

export interface AnalyticsOut {
  total_students: number;
  total_courses: number;
  avg_submission_rate: number;
  assignment_stats: { title: string; submitted: number; total: number }[];
}

// ── Auth API ──
export const authApi = {
  sync: (body: {
    id_token: string;
    display_name?: string;
    role?: string;
    class_name?: string;
    year?: number | null;
    semester?: number | null;
    department?: string | null;
  }) => request<UserOut>("/auth/sync", { method: "POST", body: JSON.stringify(body) }),

  me: () => request<UserOut>("/auth/me"),

  sendWelcomeEmail: () => request<{ detail: string }>("/auth/welcome-email", { method: "POST" }).catch(() => {}),

  requestPasswordReset: (email: string) =>
    publicRequest<{ detail: string }>("/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};

// ── Users API ──
export const usersApi = {
  updateMe: (body: {
    display_name?: string; class_name?: string; year?: number | null;
    semester?: number | null; department?: string | null; photo_url?: string;
  }) => request<UserOut>("/users/me", { method: "PATCH", body: JSON.stringify(body) }),

  uploadAvatar: async (file: File): Promise<{ photo_url: string }> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/users/me/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  getUser: (userId: string) => request<UserOut>(`/users/${userId}`),
};

// ── Maps API ──
export const mapsApi = {
  list: (limit?: number) =>
    request<MapOut[]>(`/maps/${limit ? `?limit=${limit}` : ""}`),

  create: (body: {
    title?: string; graph_data?: string; graph_format?: string;
    nodes_text?: string; thumbnail?: string;
  }) => request<MapOut>("/maps/", { method: "POST", body: JSON.stringify(body) }),

  get: (mapId: string) => request<MapOut>(`/maps/${mapId}`),

  update: (mapId: string, body: {
    title?: string; graph_data?: string; nodes_text?: string; thumbnail?: string;
  }) => request<MapOut>(`/maps/${mapId}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (mapId: string) =>
    request<{ ok: boolean }>(`/maps/${mapId}`, { method: "DELETE" }),

  searchByCode: (code: string) =>
    request<MapOut[]>(`/maps/search/by-code?code=${encodeURIComponent(code)}`),

  searchByEmail: (email: string) =>
    request<MapOut[]>(`/maps/search/by-email?email=${encodeURIComponent(email)}`),

  searchByCourse: (courseId: string) =>
    request<MapOut[]>(`/maps/search/by-course/${courseId}`),

  searchStudents: (q: string) =>
    request<{ id: string; display_name: string; email: string; photo_url: string }[]>(
      `/maps/search/students?q=${encodeURIComponent(q)}`
    ),

  addCollaborator: (mapId: string, email: string) =>
    request<{ ok: boolean }>(`/maps/${mapId}/collaborators?email=${encodeURIComponent(email)}`, { method: "POST" }),

  removeCollaborator: (mapId: string, email: string) =>
    request<{ ok: boolean }>(`/maps/${mapId}/collaborators?email=${encodeURIComponent(email)}`, { method: "DELETE" }),

  // Recently viewed (synced across devices)
  markViewed: (mapId: string) =>
    request<{ ok: boolean }>(`/maps/${mapId}/view`, { method: "POST" }),

  getRecentlyViewed: () =>
    request<{
      id: string;
      title: string;
      owner_email: string;
      thumbnail: string;
      share_code: string;
      last_modified: string;
      viewed_at: string;
    }[]>(`/maps/views/recent`),

  // History
  getHistory: (mapId: string, limit?: number) =>
    request<{ id: string; map_id: string; user_id: string; user_email: string; user_name: string; action: string; summary: string; created_at: string }[]>(
      `/maps/${mapId}/history${limit ? `?limit=${limit}` : ""}`
    ),

  // Presence
  updatePresence: (mapId: string, body: { locked_node_id?: string | null; cursor_position?: { x: number; y: number } }) =>
    request<{ ok: boolean }>(`/maps/${mapId}/presence`, { method: "POST", body: JSON.stringify(body) }),

  getPresence: (mapId: string) =>
    request<{ id: string; userId: string; displayName: string; photoURL: string; lockedNodeId: string | null; lastSeen: string }[]>(`/maps/${mapId}/presence`),

  getVisitors: (mapId: string) =>
    request<{ user_id: string; user_email: string; user_name: string; last_visited: string; visit_count: number }[]>(`/maps/${mapId}/visitors`),

  // Annotations
  getAnnotations: (mapId: string) =>
    request<{ id: string; authorId: string; authorName: string; type: string; content: string; position: { x: number; y: number }; color: string; path?: string; createdAt: string }[]>(`/maps/${mapId}/annotations`),

  createAnnotation: (mapId: string, body: { type: string; content: string; position: { x: number; y: number }; color?: string; path?: string }) =>
    request<{ id: string }>(`/maps/${mapId}/annotations`, { method: "POST", body: JSON.stringify(body) }),

  updateAnnotation: (mapId: string, annId: string, body: { position?: { x: number; y: number }; content?: string; size?: { w: number; h: number } }) =>
    request<{ ok: boolean }>(`/maps/${mapId}/annotations/${annId}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteAnnotation: (mapId: string, annId: string) =>
    request<{ ok: boolean }>(`/maps/${mapId}/annotations/${annId}`, { method: "DELETE" }),

  uploadNodeImage: async (mapId: string, file: File): Promise<{ ok: boolean; image_url: string }> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/maps/${mapId}/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
};

// ── Courses API ──
export const coursesApi = {
  teaching: () => request<CourseOut[]>("/courses/teaching"),
  enrolled: () => request<CourseOut[]>("/courses/enrolled"),

  create: (body: { course_name: string; course_code: string; semester?: string; description?: string; theme_color?: string; pattern?: string }) =>
    request<CourseOut>("/courses/", { method: "POST", body: JSON.stringify(body) }),

  get: (courseId: string) => request<CourseOut>(`/courses/${courseId}`),

  update: (courseId: string, body: {
    course_name?: string; course_code?: string; semester?: string; description?: string; theme_color?: string; pattern?: string;
  }) => request<CourseOut>(`/courses/${courseId}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (courseId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}`, { method: "DELETE" }),

  join: (body: { join_code: string }) =>
    request<CourseOut>("/courses/join", { method: "POST", body: JSON.stringify(body) }),

  getStudents: (courseId: string) => request<UserOut[]>(`/courses/${courseId}/students`),

  searchStudents: (query: string) =>
    request<UserOut[]>(`/courses/search/students?q=${encodeURIComponent(query)}`),

  addStudent: (courseId: string, studentId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/add-student`, {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    }),

  markViewed: (courseId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/view`, { method: "POST" }),

  recentViews: () =>
    request<{ course_id: string; viewed_at: string }[]>("/courses/views/recent"),
};

// ── Assignments API ──
export const assignmentsApi = {
  list: (courseId: string) =>
    request<AssignmentOut[]>(`/assignments/?course_id=${encodeURIComponent(courseId)}`),

  myUpcoming: () =>
    request<(AssignmentOut & { course_name: string; submitted: boolean })[]>("/assignments/my-upcoming"),

  similarityReport: (aid: string) =>
    request<{ student_a: string; student_b: string; student_a_name: string; student_b_name: string; similarity: number }[]>(`/assignments/${aid}/similarity-report`),

  fullPlagiarismReport: (aid: string) =>
    request<FullPlagiarismReport>(`/assignments/${aid}/full-plagiarism-report`),

  pendingReviews: () =>
    request<{ assignment: AssignmentOut; ungraded_count: number; total_submissions: number }[]>("/assignments/pending-reviews"),

  byLecturer: () => request<AssignmentOut[]>("/assignments/by-lecturer"),

  create: (body: {
    course_id: string; title: string; description?: string; deadline: string;
    available_from?: string | null; available_until?: string | null;
    prerequisite_id?: string | null; min_grade?: number | null;
    assignment_type?: string; quiz_id?: string | null;
    attachments?: { name: string; url: string; type: string }[];
    peer_review_enabled?: boolean;
  }) => request<AssignmentOut>("/assignments/", { method: "POST", body: JSON.stringify(body) }),

  update: (aid: string, body: {
    title?: string; description?: string; deadline?: string;
    available_from?: string | null; available_until?: string | null;
    prerequisite_id?: string | null; min_grade?: number | null;
    assignment_type?: string; quiz_id?: string | null;
    attachments?: { name: string; url: string; type: string }[];
    peer_review_enabled?: boolean;
  }) => request<AssignmentOut>(`/assignments/${aid}`, { method: "PATCH", body: JSON.stringify(body) }),

  uploadAttachment: async (aid: string, file: File): Promise<{ ok: boolean; url: string; name: string; type: string }> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/assignments/${aid}/attachments/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  checkAccess: (aid: string) =>
    request<AccessCheck>(`/assignments/${aid}/access-check`),

  delete: (aid: string) =>
    request<{ ok: boolean }>(`/assignments/${aid}`, { method: "DELETE" }),

  getSubmissions: (aid: string) =>
    request<SubmissionOut[]>(`/assignments/${aid}/submissions`),

  getMySubmission: (aid: string) =>
    request<SubmissionOut | null>(`/assignments/${aid}/submissions/mine`),

  submit: (aid: string, body: {
    submission_type?: string; map_id?: string | null;
    external_link?: string | null; comments?: string;
  }) => request<SubmissionOut>(`/assignments/${aid}/submissions`, { method: "POST", body: JSON.stringify(body) }),

  grade: (aid: string, sid: string, body: { grade: number; feedback?: string }) =>
    request<SubmissionOut>(`/assignments/${aid}/submissions/${sid}/grade`, { method: "PATCH", body: JSON.stringify(body) }),

  uploadFile: async (aid: string, file: File): Promise<{ ok: boolean; file_url: string; submission_id: string }> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/assignments/${aid}/submissions/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
};

// ── Discussions API ──
export const discussionsApi = {
  list: (courseId: string) =>
    request<DiscussionOut[]>(`/courses/${courseId}/discussions/`),

  create: (courseId: string, body: { text: string }) =>
    request<DiscussionOut>(`/courses/${courseId}/discussions/`, { method: "POST", body: JSON.stringify(body) }),

  delete: (courseId: string, msgId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/discussions/${msgId}`, { method: "DELETE" }),

  getReplies: (courseId: string, msgId: string) =>
    request<DiscussionOut[]>(`/courses/${courseId}/discussions/${msgId}/replies`),

  reply: (courseId: string, msgId: string, body: { text: string }) =>
    request<DiscussionOut>(`/courses/${courseId}/discussions/${msgId}/replies`, { method: "POST", body: JSON.stringify(body) }),

  edit: (courseId: string, msgId: string, body: { text: string }) =>
    request<DiscussionOut>(`/courses/${courseId}/discussions/${msgId}`, { method: "PATCH", body: JSON.stringify(body) }),
};

// ── Announcements API ──
export const announcementsApi = {
  list: (courseId: string) =>
    request<AnnouncementOut[]>(`/courses/${courseId}/announcements/`),

  create: (courseId: string, body: { title: string; content: string }) =>
    request<AnnouncementOut>(`/courses/${courseId}/announcements/`, { method: "POST", body: JSON.stringify(body) }),

  delete: (courseId: string, annId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/announcements/${annId}`, { method: "DELETE" }),
};

// ── Modules (Resources) API ──
export const modulesApi = {
  list: (courseId: string) =>
    request<ModuleOut[]>(`/courses/${courseId}/modules/`),

  createModule: (courseId: string, body: { title: string; description?: string }) =>
    request<ModuleOut>(`/courses/${courseId}/modules/`, { method: "POST", body: JSON.stringify(body) }),

  deleteModule: (courseId: string, moduleId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/modules/${moduleId}`, { method: "DELETE" }),

  createItem: (courseId: string, moduleId: string, body: { title: string; type?: string; url?: string; file_type?: string; unlock_date?: string | null }) =>
    request<ModuleItemOut>(`/courses/${courseId}/modules/${moduleId}/items`, { method: "POST", body: JSON.stringify(body) }),

  deleteItem: (courseId: string, moduleId: string, itemId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/modules/${moduleId}/items/${itemId}`, { method: "DELETE" }),

  reorderModules: (courseId: string, order: string[]) =>
    request<{ ok: boolean }>(`/courses/${courseId}/modules/reorder`, { method: "PATCH", body: JSON.stringify({ order }) }),

  uploadItem: async (courseId: string, moduleId: string, formData: FormData): Promise<ModuleItemOut> => {
    const token = await getFirebaseToken();
    const res = await fetch(`${BASE}/courses/${courseId}/modules/${moduleId}/items/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  trackProgress: (courseId: string, moduleId: string, itemId: string) =>
    request<{ ok: boolean; already_tracked: boolean }>(`/courses/${courseId}/modules/${moduleId}/items/${itemId}/track`, { method: "POST" }),

  getProgress: (courseId: string) =>
    request<ResourceProgressOut[]>(`/courses/${courseId}/modules/progress`),

  cloneTemplate: (courseId: string, moduleId: string, itemId: string) =>
    request<{ ok: boolean; map_id: string; title: string }>(`/courses/${courseId}/modules/${moduleId}/items/${itemId}/clone`, { method: "POST" }),

  attachPdf: async (courseId: string, moduleId: string, itemId: string, file: File): Promise<ModuleItemOut> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/courses/${courseId}/modules/${moduleId}/items/${itemId}/attach-pdf`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Attach failed");
    }
    return res.json();
  },
};

// ── Reminders API ──
export const remindersApi = {
  list: (date: string) =>
    request<ReminderOut[]>(`/reminders/?date=${encodeURIComponent(date)}`),

  create: (body: { date: string; title: string; type?: string; priority?: string }) =>
    request<ReminderOut>("/reminders/", { method: "POST", body: JSON.stringify(body) }),

  update: (rid: string, body: { title?: string; type?: string; priority?: string; is_completed?: boolean }) =>
    request<ReminderOut>(`/reminders/${rid}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (rid: string) =>
    request<{ ok: boolean }>(`/reminders/${rid}`, { method: "DELETE" }),
};

// ── Badges API ──
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  condition_type: string;
  condition_value: number;
  course_id?: string;
  points_reward: number;
  is_default: boolean;
  created_by?: string;
  created_by_name?: string;
  lottie_url?: string;
  lottie_size?: number;
  lottie_dpr?: number;
}

export const badgesApi = {
  definitions: () =>
    request<BadgeDefinition[]>("/badges/definitions"),

  createDefinition: (body: Omit<BadgeDefinition, "id" | "is_default" | "created_by" | "created_by_name">) =>
    request<BadgeDefinition>("/badges/definitions", { method: "POST", body: JSON.stringify(body) }),

  updateDefinition: (id: string, body: Partial<BadgeDefinition>) =>
    request<BadgeDefinition>(`/badges/definitions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteDefinition: (id: string) =>
    request<{ ok: boolean }>(`/badges/definitions/${id}`, { method: "DELETE" }),

  award: (body: { student_id: string; badge_id: string }) =>
    request<{ ok: boolean }>("/badges/award", { method: "POST", body: JSON.stringify(body) }),

  revoke: (body: { student_id: string; badge_id: string }) =>
    request<{ ok: boolean }>("/badges/revoke", { method: "POST", body: JSON.stringify(body) }),

  checkMyBadges: () =>
    request<{ newly_awarded: string[] }>("/badges/check"),

  uploadLottie: async (badgeId: string, file: File): Promise<{ ok: boolean; lottie_url: string }> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/badges/definitions/${badgeId}/lottie`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
};

// ── Analytics API ──
export const analyticsApi = {
  get: () => request<AnalyticsOut>("/analytics/"),
  mapTypePopularity: () => request<{ type: string; count: number }[]>("/analytics/map-type-popularity"),
  engagementHeatmap: () => request<{ data: number[][]; days: string[] }>("/analytics/engagement-heatmap"),
  atRiskStudents: () => request<{ id: string; display_name: string; email: string; last_active: string; has_submissions: boolean; reason: string }[]>("/analytics/at-risk-students"),
  submissionTrends: () => request<{ week: string; submissions: number }[]>("/analytics/submission-trends"),
};

// ── Participation API ──
export const participationApi = {
  get: (courseId: string) =>
    request<{ student_id: string; display_name: string; email: string; discussions: number; maps: number; submissions: number; total_score: number; breakdown: { discussions: number; maps: number; submissions: number } }[]>(`/courses/${courseId}/participation/`),
};

// ── Reflections API ──
export interface ReflectionOut {
  id: string;
  owner_id: string;
  confidence: number;
  notes: string;
  week_label: string;
  created_at: string;
}

export const reflectionsApi = {
  create: (body: { confidence: number; notes?: string; week_label?: string }) =>
    request<ReflectionOut>("/activity/reflections", { method: "POST", body: JSON.stringify(body) }),

  list: (limit?: number) =>
    request<ReflectionOut[]>(`/activity/reflections?limit=${limit || 10}`),
};

// ── Activity Feed ──
export interface ActivityOut {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  title: string;
  createdAt: string;
}

export const activityApi = {
  list: (limit?: number) =>
    request<ActivityOut[]>(`/activity/?limit=${limit || 20}`),
};

// ── Notifications API ──
export interface NotificationOut {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (limit?: number) =>
    request<NotificationOut[]>(`/notifications/?limit=${limit || 20}`),

  markRead: (nid: string) =>
    request<{ ok: boolean }>(`/notifications/${nid}/read`, { method: "PATCH" }),

  markAllRead: () =>
    request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),

  deleteOne: (nid: string) =>
    request<{ ok: boolean }>(`/notifications/${nid}`, { method: "DELETE" }),

  clearAll: () =>
    request<{ ok: boolean }>("/notifications/", { method: "DELETE" }),

  registerToken: (token: string) =>
    request<{ ok: boolean }>("/notifications/register-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};

// ── Stats API ──
export interface StudyActivityDay {
  date: string;
  count: number;
}

export interface MonthlyComparison {
  current_month: { label: string; count: number };
  previous_month: { label: string; count: number };
}

export interface MapTypeDist {
  type: string;
  count: number;
}

export const statsApi = {
  studyActivity: () => request<StudyActivityDay[]>("/stats/study-activity"),
  monthlyComparison: () => request<MonthlyComparison>("/stats/monthly-comparison"),
  mapTypeDistribution: () => request<MapTypeDist[]>("/stats/map-type-distribution"),
};

// ── Quiz Types ──
export interface QuestionOut {
  id: string;
  type: string;
  text: string;
  options: string[];
  correct_answer: string | null;
  points: number;
}

export interface QuizOut {
  id: string;
  course_id: string;
  lecturer_id: string;
  title: string;
  description: string;
  time_limit_minutes: number | null;
  deadline: string | null;
  shuffle_questions: boolean;
  show_results: boolean;
  question_count: number;
  total_points: number;
  created_at: string;
}

export interface QuizAttemptOut {
  id: string;
  quiz_id: string;
  student_id: string;
  student_name: string;
  student_photo_url?: string | null;
  answers: Record<string, string>;
  score: number;
  total_points: number;
  percentage: number;
  started_at: string;
  submitted_at: string;
}

// ── Quizzes API ──
export const quizzesApi = {
  list: (courseId: string) =>
    request<QuizOut[]>(`/quizzes/?course_id=${encodeURIComponent(courseId)}`),

  get: (qid: string) => request<QuizOut>(`/quizzes/${qid}`),

  getQuestions: (qid: string) =>
    request<QuestionOut[]>(`/quizzes/${qid}/questions`),

  create: (body: {
    course_id: string;
    title: string;
    description?: string;
    time_limit_minutes?: number | null;
    deadline?: string | null;
    shuffle_questions?: boolean;
    show_results?: boolean;
    questions?: { type: string; text: string; options?: string[]; correct_answer: string; points?: number }[];
  }) => request<QuizOut>("/quizzes/", { method: "POST", body: JSON.stringify(body) }),

  update: (qid: string, body: {
    title?: string; description?: string; time_limit_minutes?: number | null;
    deadline?: string | null; shuffle_questions?: boolean; show_results?: boolean;
  }) => request<QuizOut>(`/quizzes/${qid}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (qid: string) =>
    request<{ ok: boolean }>(`/quizzes/${qid}`, { method: "DELETE" }),

  addQuestion: (qid: string, body: { type: string; text: string; options?: string[]; correct_answer: string; points?: number }) =>
    request<QuestionOut>(`/quizzes/${qid}/questions`, { method: "POST", body: JSON.stringify(body) }),

  deleteQuestion: (qid: string, questionId: string) =>
    request<{ ok: boolean }>(`/quizzes/${qid}/questions/${questionId}`, { method: "DELETE" }),

  submitAttempt: (qid: string, answers: Record<string, string>) =>
    request<QuizAttemptOut>(`/quizzes/${qid}/attempt`, { method: "POST", body: JSON.stringify({ answers }) }),

  getMyAttempt: (qid: string) =>
    request<QuizAttemptOut | null>(`/quizzes/${qid}/attempt/mine`),

  getAttempts: (qid: string) =>
    request<QuizAttemptOut[]>(`/quizzes/${qid}/attempts`),

  getResults: (qid: string) =>
    request<QuestionOut[]>(`/quizzes/${qid}/results`),
};

// ── Gradebook Types ──
export interface GradebookEntry {
  item_type: string;
  item_id: string;
  title: string;
  grade: number | null;
  total_points: number;
  percentage: number | null;
  feedback: string | null;
  submitted_at: string | null;
}

export interface CourseGradebook {
  course_id: string;
  course_name: string;
  course_code: string;
  entries: GradebookEntry[];
  average: number | null;
}

export interface LecturerGradebookRow extends CourseGradebook {
  student_id: string;
  student_name: string;
  student_email: string;
  student_photo_url?: string | null;
}

// ── Gradebook API ──
export const gradebookApi = {
  my: (courseId?: string) =>
    request<CourseGradebook[]>(`/gradebook/my${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ""}`),

  course: (courseId: string) =>
    request<LecturerGradebookRow[]>(`/gradebook/course/${courseId}`),

  exportCsv: (courseId: string) =>
    `${BASE}/gradebook/course/${courseId}/export`,

  getSettings: (courseId: string) =>
    request<{ assignment_weight: number; quiz_weight: number }>(`/gradebook/settings/${courseId}`),

  updateSettings: (courseId: string, assignmentWeight: number, quizWeight: number) =>
    request<{ ok: boolean }>(`/gradebook/settings/${courseId}?assignment_weight=${assignmentWeight}&quiz_weight=${quizWeight}`, { method: "POST" }),

  studentReport: (studentId: string, courseId: string) =>
    request<StudentReport>(`/gradebook/student/${studentId}/course/${courseId}`),
};

export interface StudentReport {
  student: {
    id: string;
    name: string;
    email: string;
    badges: string[];
    points: number;
    streak: number;
  };
  gradebook: CourseGradebook | null;
  attendance: {
    total_sessions: number;
    present: number;
    late: number;
    absent: number;
    percentage: number;
  };
  activity_count: number;
  reviews_given: number;
}

// ── Private Messaging Types ──
export interface ConversationOut {
  id: string;
  participants: string[];
  participant_names: string[];
  participant_photos: string[];
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface PrivateMessageOut {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_photo_url?: string | null;
  text: string;
  edited: boolean;
  edited_at: string | null;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  display_name: string;
  email: string;
  photo_url: string;
  role: string;
}

// ── Messaging API ──
export const messagingApi = {
  conversations: () =>
    request<ConversationOut[]>("/messages/conversations"),

  getOrCreate: (otherUserId: string) =>
    request<ConversationOut>(`/messages/conversations/${otherUserId}`, { method: "POST" }),

  getMessages: (convId: string, limit?: number) =>
    request<PrivateMessageOut[]>(`/messages/conversations/${convId}/messages?limit=${limit || 50}`),

  send: (convId: string, text: string) =>
    request<PrivateMessageOut>(`/messages/conversations/${convId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),

  edit: (convId: string, msgId: string, text: string) =>
    request<PrivateMessageOut>(`/messages/conversations/${convId}/messages/${msgId}`, { method: "PATCH", body: JSON.stringify({ text }) }),

  searchUsers: (q: string, role?: string) =>
    request<UserSearchResult[]>(`/messages/search-users?q=${encodeURIComponent(q)}${role ? `&role=${encodeURIComponent(role)}` : ""}`),
};

// ── Peer Review Types ──
export interface PeerReviewOut {
  id: string;
  submission_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_photo_url?: string | null;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ReviewableSubmission {
  submission_id: string;
  student_name: string;
  student_photo_url?: string | null;
  submission_type: string;
  map_id: string | null;
  external_link: string | null;
  comments: string;
  submitted_at: string;
  already_reviewed: boolean;
  review_count: number;
  avg_rating: number | null;
}

// ── Peer Review API ──
export const peerReviewApi = {
  getReviewable: (assignmentId: string) =>
    request<ReviewableSubmission[]>(`/peer-reviews/assignment/${assignmentId}`),

  submitReview: (submissionId: string, body: { rating: number; comment?: string }) =>
    request<PeerReviewOut>(`/peer-reviews/submission/${submissionId}`, { method: "POST", body: JSON.stringify(body) }),

  getReviews: (submissionId: string) =>
    request<PeerReviewOut[]>(`/peer-reviews/submission/${submissionId}`),

  myReviews: () =>
    request<PeerReviewOut[]>("/peer-reviews/my-reviews"),
};

// ── Progress & Calendar Types ──
export interface CourseProgressOut {
  course_id: string;
  course_name: string;
  course_code: string;
  total_assignments: number;
  submitted_assignments: number;
  total_quizzes: number;
  completed_quizzes: number;
  total_resources: number;
  opened_resources: number;
  overall_percentage: number;
}

export interface CalendarEventOut {
  id: string;
  title: string;
  date: string;
  type: string;
  course_name: string | null;
  course_id: string | null;
  is_completed: boolean;
  time?: string | null;
  location?: string | null;
}

// ── Progress API ──
export const progressApi = {
  courses: () => request<CourseProgressOut[]>("/progress/courses"),
  calendar: (month?: string) =>
    request<CalendarEventOut[]>(`/progress/calendar${month ? `?month=${month}` : ""}`),
};

// ── Attendance Types ──
export interface AttendanceSession {
  id: string;
  course_id: string;
  date: string;
  title: string;
  start_time?: string;
  end_time?: string;
  records: {
    student_id: string;
    student_name: string;
    student_photo?: string;
    status: string;
    scanned_at?: string | null;
  }[];
  present_count: number;
  total_count: number;
  qr_token: string;
  created_at: string;
}

export interface MyAttendance {
  course_id: string;
  course_name: string;
  course_code: string;
  total_sessions: number;
  present: number;
  late: number;
  absent: number;
  attendance_percentage: number;
}

// ── Attendance API ──
export const attendanceApi = {
  getSessions: (courseId: string) =>
    request<AttendanceSession[]>(`/attendance/course/${courseId}`),

  createSession: (
    courseId: string,
    body: { date: string; title?: string; start_time?: string; end_time?: string }
  ) =>
    request<{ id: string; date: string; title: string; start_time?: string; end_time?: string }>(
      `/attendance/course/${courseId}`,
      { method: "POST", body: JSON.stringify({ course_id: courseId, ...body }) }
    ),

  updateRecord: (sessionId: string, body: { student_id: string; status: string }) =>
    request<{ ok: boolean }>(`/attendance/session/${sessionId}/record`, { method: "PATCH", body: JSON.stringify(body) }),

  bulkUpdate: (sessionId: string, records: { student_id: string; status: string }[]) =>
    request<{ ok: boolean }>(`/attendance/session/${sessionId}/bulk`, { method: "PATCH", body: JSON.stringify(records) }),

  deleteSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/attendance/session/${sessionId}`, { method: "DELETE" }),

  getSession: (sessionId: string) =>
    request<AttendanceSession>(`/attendance/session/${sessionId}`),

  checkIn: (token: string) =>
    request<{ ok: boolean; session_title: string; course_id: string }>(
      `/attendance/check-in`,
      { method: "POST", body: JSON.stringify({ token }) }
    ),

  regenerateQr: (sessionId: string) =>
    request<{ qr_token: string }>(
      `/attendance/session/${sessionId}/regenerate-qr`,
      { method: "POST" }
    ),

  myAttendance: () =>
    request<MyAttendance[]>("/attendance/student/my"),
};

// ── Rubric Types ──
export interface RubricCriterion {
  name: string;
  description: string;
  max_points: number;
}

export interface RubricOut {
  id: string;
  assignment_id: string;
  title: string;
  criteria: RubricCriterion[];
  created_at: string;
}

// ── Rubrics API ──
export const rubricsApi = {
  get: (assignmentId: string) =>
    request<RubricOut | null>(`/rubrics/assignment/${assignmentId}`),

  create: (body: { assignment_id: string; title: string; criteria: { name: string; description?: string; max_points?: number }[] }) =>
    request<RubricOut>("/rubrics/", { method: "POST", body: JSON.stringify(body) }),

  delete: (rubricId: string) =>
    request<{ ok: boolean }>(`/rubrics/${rubricId}`, { method: "DELETE" }),

  gradeWithRubric: (assignmentId: string, submissionId: string, body: { criterion_scores: Record<string, number>; feedback?: string }) =>
    request<{ ok: boolean; grade: number; total_earned: number; total_possible: number; feedback: string }>(
      `/rubrics/grade/${assignmentId}/${submissionId}`, { method: "POST", body: JSON.stringify(body) }
    ),
};

// ── Certificate Types ──
export interface CertificateOut {
  id: string;
  student_id: string;
  student_name: string;
  course_id: string;
  course_name: string;
  course_code: string;
  lecturer_name: string;
  completion_percentage: number;
  issued_at: string;
  certificate_number: string;
}

// ── Certificates API ──
export const certificatesApi = {
  my: () => request<CertificateOut[]>("/certificates/my"),
  course: (courseId: string) => request<CertificateOut[]>(`/certificates/course/${courseId}`),
  claim: (courseId: string) => request<CertificateOut>(`/certificates/claim/${courseId}`, { method: "POST" }),
  verify: (certNumber: string) => request<CertificateOut>(`/certificates/verify/${certNumber}`),
};

// ── Course Groups Types ──
export interface GroupOut {
  id: string;
  course_id: string;
  name: string;
  description: string;
  members: { student_id: string; student_name: string }[];
  created_at: string;
}

// ── Course Groups API ──
export const groupsApi = {
  list: (courseId: string) =>
    request<GroupOut[]>(`/courses/${courseId}/groups/`),

  create: (courseId: string, body: { name: string; description?: string }) =>
    request<GroupOut>(`/courses/${courseId}/groups/`, { method: "POST", body: JSON.stringify(body) }),

  addMembers: (courseId: string, groupId: string, studentIds: string[]) =>
    request<{ ok: boolean }>(`/courses/${courseId}/groups/${groupId}/members`, {
      method: "POST", body: JSON.stringify({ student_ids: studentIds }),
    }),

  removeMember: (courseId: string, groupId: string, studentId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/groups/${groupId}/members/${studentId}`, { method: "DELETE" }),

  delete: (courseId: string, groupId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/groups/${groupId}`, { method: "DELETE" }),

  autoAssign: (courseId: string, groupCount?: number) =>
    request<GroupOut[]>(`/courses/${courseId}/groups/auto-assign?group_count=${groupCount || 4}`, { method: "POST" }),
};

// ── Group Tasks Types ──
export interface GroupTaskMember {
  student_id: string;
  student_name: string;
  student_email: string;
  student_photo: string;
}

export interface GroupInTask {
  id: string;
  task_id: string;
  name: string;
  description: string;
  members: GroupTaskMember[];
  created_at: string;
}

export interface GroupTaskSummary {
  id: string;
  course_id: string;
  title: string;
  description: string;
  due_date: string | null;
  group_count: number;
  member_count: number;
  created_at: string;
}

export interface GroupTaskDetail {
  id: string;
  course_id: string;
  title: string;
  description: string;
  due_date: string | null;
  groups: GroupInTask[];
  created_at: string;
}

// ── Group Tasks API ──
export const groupTasksApi = {
  list: (courseId: string) =>
    request<GroupTaskSummary[]>(`/courses/${courseId}/group-tasks/`),

  create: (courseId: string, body: { title: string; description?: string; due_date?: string | null }) =>
    request<GroupTaskSummary>(`/courses/${courseId}/group-tasks/`, { method: "POST", body: JSON.stringify(body) }),

  get: (courseId: string, taskId: string) =>
    request<GroupTaskDetail>(`/courses/${courseId}/group-tasks/${taskId}`),

  delete: (courseId: string, taskId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/group-tasks/${taskId}`, { method: "DELETE" }),

  createGroup: (courseId: string, taskId: string, body: { name: string; description?: string }) =>
    request<GroupInTask>(`/courses/${courseId}/group-tasks/${taskId}/groups`, {
      method: "POST", body: JSON.stringify(body),
    }),

  deleteGroup: (courseId: string, taskId: string, groupId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/group-tasks/${taskId}/groups/${groupId}`, { method: "DELETE" }),

  addMembers: (courseId: string, taskId: string, groupId: string, studentIds: string[]) =>
    request<{ ok: boolean }>(`/courses/${courseId}/group-tasks/${taskId}/groups/${groupId}/members`, {
      method: "POST", body: JSON.stringify({ student_ids: studentIds }),
    }),

  removeMember: (courseId: string, taskId: string, groupId: string, studentId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/group-tasks/${taskId}/groups/${groupId}/members/${studentId}`, { method: "DELETE" }),

  autoAssign: (courseId: string, taskId: string, groupCount?: number) =>
    request<GroupInTask[]>(`/courses/${courseId}/group-tasks/${taskId}/auto-assign?group_count=${groupCount || 4}`, { method: "POST" }),
};

// ── Audit Log Types ──
export interface AuditLogOut {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhoto?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  createdAt: string;
}

// ── Admin API ──
export const adminApi = {
  getAuditLogs: (params?: { limit?: number; resource_type?: string; user_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.resource_type) q.set("resource_type", params.resource_type);
    if (params?.user_id) q.set("user_id", params.user_id);
    return request<AuditLogOut[]>(`/admin/audit-logs?${q.toString()}`);
  },

  getUsers: (params?: { role?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.role) q.set("role", params.role);
    if (params?.limit) q.set("limit", String(params.limit));
    return request<UserOut[]>(`/admin/users?${q.toString()}`);
  },

  updateUserRole: (uid: string, role: string) =>
    request<{ ok: boolean; new_role: string }>(`/admin/users/${uid}/role?role=${encodeURIComponent(role)}`, { method: "PATCH" }),

  deleteUser: (uid: string) =>
    request<{ ok: boolean; uid: string }>(`/admin/users/${uid}`, { method: "DELETE" }),

  // Homepage content management
  getHomepageContent: () => request<HomepageContentOut[]>("/admin/homepage/content"),

  createHomepageContent: (body: { type: string; title: string; content?: string; image_url?: string; order?: number }) =>
    request<HomepageContentOut>("/admin/homepage/content", { method: "POST", body: JSON.stringify(body) }),

  updateHomepageContent: (id: string, body: { type?: string; title?: string; content?: string; image_url?: string; order?: number; visible?: boolean }) =>
    request<{ ok: boolean }>(`/admin/homepage/content/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteHomepageContent: (id: string) =>
    request<{ ok: boolean }>(`/admin/homepage/content/${id}`, { method: "DELETE" }),

  uploadHomepageImage: async (file: File): Promise<{ ok: boolean; image_url: string }> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/admin/homepage/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  // AI usage analytics
  getAiUsage: (params?: { limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    return request<{
      usage: AiUsageRecord[];
      summary: AiUsageSummary;
      global_token_limit: number;
      default_token_limit: number;
    }>(`/admin/ai-usage?${q.toString()}`);
  },

  // Per-user image quota override
  setUserImageQuota: (uid: string, limit: number | null) =>
    request<{ ok: boolean; uid: string; imageQuotaLimit: number | null }>(
      `/admin/users/${uid}/image-quota`,
      { method: "PATCH", body: JSON.stringify({ limit }) }
    ),

  // Global AI daily token limit
  getAiTokenLimit: () =>
    request<{ limit: number; default: number; updated_at: string | null; updated_by: string | null }>(
      "/admin/ai-token-limit"
    ),

  setAiTokenLimit: (limit: number) =>
    request<{ ok: boolean; limit: number }>(
      "/admin/ai-token-limit",
      { method: "PATCH", body: JSON.stringify({ limit }) }
    ),

  // Per-user token limit override (null = use global)
  setUserTokenLimit: (uid: string, limit: number | null) =>
    request<{ ok: boolean; uid: string; dailyTokenLimit: number | null }>(
      `/admin/users/${uid}/token-limit`,
      { method: "PATCH", body: JSON.stringify({ limit }) }
    ),
};

// ── AI Usage Types ──
export interface AiUsageRecord {
  userId: string;
  user: { displayName: string; email: string; photoURL: string; role: string };
  total_tokens: number;
  total_calls: number;
  features: Record<string, { tokens: number; calls: number }>;
  image_quota_limit: number | null;
  token_limit_override: number | null;
  tokens_today: number;
  updated_at: string;
}

export interface AiUsageSummary {
  total_tokens: number;
  total_calls: number;
  by_feature: Record<string, { tokens: number; calls: number; percentage: number }>;
}

// ── Discussion Topics Types ──
export interface TopicOut {
  id: string;
  course_id: string;
  title: string;
  description: string;
  pinned: boolean;
  author_id: string;
  author_name: string;
  reply_count: number;
  last_activity: string | null;
  created_at: string;
}

export interface TopicPost {
  id: string;
  topic_id: string;
  course_id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_photo_url?: string | null;
  created_at: string;
}

// ── Discussion Topics API ──
export const topicsApi = {
  list: (courseId: string) =>
    request<TopicOut[]>(`/courses/${courseId}/topics/`),

  create: (courseId: string, body: { title: string; description?: string; pinned?: boolean }) =>
    request<TopicOut>(`/courses/${courseId}/topics/`, { method: "POST", body: JSON.stringify(body) }),

  update: (courseId: string, topicId: string, body: { title: string; description?: string; pinned?: boolean }) =>
    request<TopicOut>(`/courses/${courseId}/topics/${topicId}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (courseId: string, topicId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/topics/${topicId}`, { method: "DELETE" }),

  togglePin: (courseId: string, topicId: string) =>
    request<{ ok: boolean; pinned: boolean }>(`/courses/${courseId}/topics/${topicId}/pin`, { method: "PATCH" }),

  getPosts: (courseId: string, topicId: string) =>
    request<TopicPost[]>(`/courses/${courseId}/topics/${topicId}/posts`),

  createPost: (courseId: string, topicId: string, body: { text: string }) =>
    request<TopicPost>(`/courses/${courseId}/topics/${topicId}/posts`, { method: "POST", body: JSON.stringify(body) }),

  deletePost: (courseId: string, topicId: string, postId: string) =>
    request<{ ok: boolean }>(`/courses/${courseId}/topics/${topicId}/posts/${postId}`, { method: "DELETE" }),
};

// ── Course Completion Types ──
export interface StudentCompletion {
  student_id: string;
  student_name: string;
  student_email: string;
  student_photo_url?: string | null;
  total_assignments: number;
  submitted_assignments: number;
  graded_assignments: number;
  total_quizzes: number;
  completed_quizzes: number;
  total_resources: number;
  opened_resources: number;
  overall_percentage: number;
}

export interface CompletionSummary {
  total_students: number;
  avg_completion: number;
  fully_complete: number;
  at_risk: number;
  assignment_completion_rate: number;
  quiz_completion_rate: number;
  resource_completion_rate: number;
}

// ── Course Completion API ──
export const completionApi = {
  course: (courseId: string) =>
    request<StudentCompletion[]>(`/completion/course/${courseId}`),

  summary: (courseId: string) =>
    request<CompletionSummary>(`/completion/course/${courseId}/summary`),
};

// ── Homepage Content Types ──
export interface HomepageContentOut {
  id: string;
  type: string;
  title: string;
  content: string;
  imageUrl: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Public Homepage API ──
export interface HomepageStats {
  students: number;
  lecturers: number;
  maps: number;
  courses: number;
}

export const homepageApi = {
  getContent: () => publicRequest<HomepageContentOut[]>("/homepage/content"),
  getStats: () => publicRequest<HomepageStats>("/homepage/stats"),
};


// ═══════════════════════════════════════════════════
// ── AI Feature APIs ──
// ═══════════════════════════════════════════════════

// ── AI Plagiarism Types ──
export interface PlagiarismSource {
  type: string; // "ai_generated" | "web" | "book" | "article"
  confidence: number;
  evidence: string;
}

export interface PlagiarismReport {
  id: string;
  submission_id: string;
  assignment_id: string;
  student_id: string;
  plagiarism_percentage: number;
  sources: PlagiarismSource[];
  summary: string;
  analyzed_at: string;
}

export interface PlagiarismNetworkCluster {
  students: { id: string; name?: string; similarity_to_cluster: number }[];
  max_similarity: number;
  analysis: string;
}

export interface PlagiarismNetworkReport {
  assignment_id: string;
  total_submissions: number;
  flagged_clusters: PlagiarismNetworkCluster[];
  network_graph: { nodes: { id: string; name: string }[]; edges: { source: string; target: string; similarity: number }[] };
  summary: string;
}

// ── AI Plagiarism API ──
export const aiPlagiarismApi = {
  analyze: (submissionId: string) =>
    request<PlagiarismReport>(`/ai/plagiarism/analyze/${submissionId}`, { method: "POST" }),

  getReport: (submissionId: string) =>
    request<PlagiarismReport | null>(`/ai/plagiarism/report/${submissionId}`),

  analyzeAssignment: (assignmentId: string) =>
    request<PlagiarismNetworkReport>(`/ai/plagiarism/analyze-assignment/${assignmentId}`, { method: "POST" }),
};

// ── AI Grading Types ──
export interface GradeRecommendation {
  id: string;
  submission_id: string;
  assignment_id: string;
  recommended_grade: number;
  criterion_scores: Record<string, number>;
  justification: string;
  confidence: number;
  comparative_analysis?: string;
  improvement_suggestions?: { criterion: string; suggestion: string; resource_link?: { title: string; doc_id: string; doc_type: string } }[];
  created_at: string;
}

// ── AI Grading API ──
export const aiGradingApi = {
  recommend: (submissionId: string) =>
    request<GradeRecommendation>(`/ai/grading/recommend/${submissionId}`, { method: "POST" }),

  getRecommendation: (submissionId: string) =>
    request<GradeRecommendation | null>(`/ai/grading/recommendation/${submissionId}`),
};

// ── AI Companion Types ──
export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface LearningProfile {
  id: string;
  learning_style: string;
  strengths: string[];
  weaknesses: string[];
}

export interface LearningStyleQuestion {
  id: string;
  text: string;
  options: { value: string; text: string }[];
}

export interface RAGSource {
  index: number;
  title: string;
  doc_type: string;
  doc_id: string;
  course_id: string;
  score?: number;
}

// ── AI Companion API ──
export const aiCompanionApi = {
  chat: (message: string, context?: { page?: string; course_id?: string }) =>
    request<{ response: string; sources?: RAGSource[] }>("/ai/companion/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),

  getHistory: () =>
    request<{ messages: ChatMessage[] }>("/ai/companion/history"),

  clearHistory: () =>
    request<{ ok: boolean }>("/ai/companion/history", { method: "DELETE" }),

  getLearningProfile: () =>
    request<LearningProfile | null>("/ai/companion/learning-profile"),

  updateLearningProfile: (body: { learning_style: string; strengths?: string[]; weaknesses?: string[] }) =>
    request<{ ok: boolean; learning_style: string }>("/ai/companion/learning-profile", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  assessStyle: () =>
    request<{ questions: LearningStyleQuestion[] }>("/ai/companion/assess-style", { method: "POST" }),
};

// ── AI Study Materials Types ──
export interface StudyMaterial {
  id: string;
  resource_id: string;
  course_id: string;
  type: string; // "summary" | "flashcards" | "quiz"
  title: string;
  content: string; // JSON string for flashcards/quiz, markdown for summary
  created_at: string;
}

// ── AI Study Materials API ──
export const aiStudyMaterialsApi = {
  generate: (body: { resource_id: string; course_id: string; type: string }) =>
    request<StudyMaterial>("/ai/study-materials/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  list: (params?: { resource_id?: string; course_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.resource_id) q.set("resource_id", params.resource_id);
    if (params?.course_id) q.set("course_id", params.course_id);
    return request<StudyMaterial[]>(`/ai/study-materials/?${q.toString()}`);
  },

  generateByTopic: (body: { topic: string; course_id: string; type: string }) =>
    request<StudyMaterial & { sources?: RAGSource[] }>("/ai/study-materials/generate-by-topic", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  delete: (materialId: string) =>
    request<{ ok: boolean }>(`/ai/study-materials/${materialId}`, { method: "DELETE" }),

  generateFromUpload: (file: File, type: string, title?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (title) fd.append("title", title);
    return request<StudyMaterial>("/ai/study-materials/generate-from-upload", {
      method: "POST",
      body: fd,
      skipContentType: true,
    });
  },

  saveQuizAttempt: (materialId: string, body: { score: number; total: number; percentage: number }) =>
    request<{ id: string; score: number; total: number; percentage: number; createdAt: string }>(
      `/ai/study-materials/${materialId}/quiz-attempts`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  listQuizAttempts: (materialId: string) =>
    request<{ id: string; score: number; total: number; percentage: number; createdAt: string }[]>(
      `/ai/study-materials/${materialId}/quiz-attempts`,
    ),
};

// ── AI Study Plan Types ──
export interface ResourceLink {
  title: string;
  doc_id: string;
  doc_type: string;
}

export interface StudyRecommendation {
  course: string;
  topic: string;
  priority: string;
  suggested_time?: string;
  reason: string;
  estimated_time: string;
  difficulty_rating?: number;
  resource_links?: ResourceLink[];
  suggested_activities?: string[];
}

export interface DailyGuide {
  recommendations: StudyRecommendation[];
  daily_schedule_summary?: string;
  motivational_message: string;
}

export interface ExamPlanSession {
  course: string;
  topic: string;
  activity: string;
  duration_minutes: number;
}

export interface ExamPlanDay {
  date: string;
  sessions: ExamPlanSession[];
}

export interface ExamPlan {
  id: string;
  exams: { course_id: string; course_name: string; exam_date: string; topics: string[] }[];
  plan: ExamPlanDay[];
  tips: string[];
  created_at?: string;
}

export interface TimetableAnalysis {
  parsed_schedule: { day: string; classes: { time: string; subject: string; location?: string }[] }[];
  recommended_study_times?: { day: string; time: string; duration_minutes: number; reason: string }[];
}

export interface SavedTimetable {
  id: string;
  semester_label: string;
  parsed_schedule: TimetableAnalysis["parsed_schedule"];
  recommended_study_times?: TimetableAnalysis["recommended_study_times"];
  created_at?: string;
}

// ── AI Study Plan API ──
export const aiStudyPlanApi = {
  dailyGuide: () =>
    request<DailyGuide>("/ai/study-plan/daily-guide"),

  createExamPlan: (exams: { course_id: string; course_name: string; exam_date: string; topics: string[] }[]) =>
    request<ExamPlan>("/ai/study-plan/exam-plan", {
      method: "POST",
      body: JSON.stringify({ exams }),
    }),

  getExamPlans: () =>
    request<ExamPlan[]>("/ai/study-plan/exam-plans"),

  deleteExamPlan: (planId: string) =>
    request<{ ok: boolean }>(`/ai/study-plan/${planId}`, { method: "DELETE" }),

  analyzeTimetable: (timetableText: string) =>
    request<TimetableAnalysis>("/ai/study-plan/timetable-analyze", {
      method: "POST",
      body: JSON.stringify({ timetable_text: timetableText }),
    }),

  uploadTimetablePdf: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<TimetableAnalysis>("/ai/study-plan/timetable-upload", {
      method: "POST",
      body: formData,
      skipContentType: true,
    });
  },

  saveTimetable: (data: { semester_label: string; parsed_schedule: TimetableAnalysis["parsed_schedule"]; recommended_study_times?: TimetableAnalysis["recommended_study_times"] }) =>
    request<SavedTimetable>("/ai/study-plan/timetables", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listTimetables: () =>
    request<SavedTimetable[]>("/ai/study-plan/timetables"),

  deleteTimetable: (id: string) =>
    request<{ ok: boolean }>(`/ai/study-plan/timetables/${id}`, { method: "DELETE" }),
};

// ── AI Import API ──
export interface ImportModule {
  title: string;
  description: string;
  items: { title: string; type: string; url: string }[];
}

export interface ImportPreview {
  modules: ImportModule[];
}

export interface ScrapeResult {
  course_name?: string;
  course_code?: string;
  modules: ImportModule[];
}

export const aiImportApi = {
  previewGoogleSites: (url: string, courseId: string) =>
    request<ImportPreview>("/ai/import/google-sites/preview", {
      method: "POST",
      body: JSON.stringify({ url, course_id: courseId }),
    }),

  importGoogleSites: (url: string, courseId: string) =>
    request<{ modules_created: number; items_created: number; modules: ImportPreview["modules"] }>("/ai/import/google-sites", {
      method: "POST",
      body: JSON.stringify({ url, course_id: courseId }),
    }),

  scrapeGoogleSites: (url: string) =>
    request<ScrapeResult>("/ai/import/google-sites/scrape", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  importEditedModules: (courseId: string, modules: ImportModule[]) =>
    request<{ modules_created: number; items_created: number }>("/ai/import/google-sites/import-edited", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, modules }),
    }),
};

// ── AI Images API ──
export interface ImageStylePreset {
  key: string;
  label: string;
  description: string;
}

export interface ImageQuota {
  used: number;
  limit: number;
  remaining: number;
  date: string;
  can_generate: boolean;
}

export const aiImagesApi = {
  generate: (prompt: string, style?: string, mapId?: string) =>
    request<{ image_url: string; cached: boolean; prompt_hash: string; quota?: ImageQuota }>("/ai/images/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, style: style || "", map_id: mapId || "" }),
    }),

  getStyles: () =>
    request<ImageStylePreset[]>("/ai/images/styles"),

  getQuota: () =>
    request<ImageQuota>("/ai/images/quota"),
};

// ── AI MindMap Buddy API ──
export interface MapAnalysis {
  rating: number;
  rating_label: string;
  strengths: string[];
  improvements: string[];
  suggested_nodes: string[];
  recommended_map_type: string;
  type_change_reason: string;
  structure_feedback: string;
}

export interface NodeSuggestion {
  label: string;
  description: string;
  parent_label?: string;
  source?: { title: string; doc_id: string; doc_type: string };
  graph_connections?: string[];
}

export const aiMindmapBuddyApi = {
  analyze: (data: { title: string; nodes: unknown[]; edges: unknown[]; task_description?: string; map_type?: string }) =>
    request<MapAnalysis>("/ai/mindmap-buddy/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  recommendNodes: (data: { node_id: string; node_label: string; parent_labels?: string[]; sibling_labels?: string[]; map_topic?: string }) =>
    request<{ suggestions: NodeSuggestion[] }>("/ai/mindmap-buddy/recommend-nodes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  suggestAll: (data: { title: string; nodes: unknown[]; edges: unknown[] }) =>
    request<{ suggestions: NodeSuggestion[] }>("/ai/mindmap-buddy/suggest-all", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  chat: (message: string, mapContext?: Record<string, unknown>) =>
    request<{ response: string }>("/ai/mindmap-buddy/chat", {
      method: "POST",
      body: JSON.stringify({ message, map_context: mapContext }),
    }),
};

// ── Site Import API ──

export interface SiteImportPreview {
  ok: boolean;
  preview: {
    course: { course_name: string; course_code: string; semester: string; description: string };
    groups: { name: string; description: string }[];
    modules_count: number;
    modules: {
      title: string;
      description: string;
      items_count: number;
      items_preview: { title: string; type: string; file_type: string | null; group_name: string | null }[];
    }[];
    assignments_count: number;
    assignments: { type: string; title: string; url?: string }[];
    attendance_sessions_count: number;
    total_items: number;
    pages_scraped: number;
    homepage_cards: { title: string; image_url: string; link: string }[];
    warnings: string[];
  };
  raw_data: Record<string, unknown>;
}

export interface SiteImportResult {
  ok: boolean;
  course_id: string;
  join_code: string;
  split_courses?: {
    course_id: string;
    join_code: string;
    course_name: string;
    items_created: number;
    modules_created: number;
  }[];
  summary: {
    course_name: string;
    course_code: string;
    groups_created: number;
    courses_created?: number;
    modules_created: number;
    items_created: number;
    assignments_created: number;
  };
  warnings?: string[];
}

export const siteImportApi = {
  preview: (url: string, maxPages = 80) =>
    request<SiteImportPreview>("/import/google-site/preview", {
      method: "POST",
      body: JSON.stringify({ url, max_pages: maxPages }),
    }),

  execute: (url: string, maxPages = 80) =>
    request<SiteImportResult>("/import/google-site/execute", {
      method: "POST",
      body: JSON.stringify({ url, max_pages: maxPages }),
    }),

  previewStream: async (url: string, maxPages = 80, onProgress?: (evt: Record<string, unknown>) => void) => {
    const token = await getFirebaseToken();
    return new Promise<SiteImportPreview>((resolve, reject) => {
      fetch(`${BASE}/import/google-site/preview-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url, max_pages: maxPages }),
      }).then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text();
          reject(new Error(text || `HTTP ${resp.status}`));
          return;
        }
        const reader = resp.body?.getReader();
        if (!reader) { reject(new Error("No response body")); return; }
        const decoder = new TextDecoder();
        let buffer = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "complete" && evt.result) {
                  resolve(evt.result as SiteImportPreview);
                  return;
                } else if (evt.type === "error") {
                  reject(new Error(evt.detail || "Stream error"));
                  return;
                } else if (evt.type === "progress" && onProgress) {
                  onProgress(evt);
                }
              } catch { /* skip parse errors */ }
            }
          }
        }
        reject(new Error("Stream ended without result"));
      }).catch(reject);
    });
  },

  importFromData: (rawData: Record<string, unknown>, splitByGroups = false, selectedGroups?: string[]) =>
    request<SiteImportResult>("/import/google-site/from-data", {
      method: "POST",
      body: JSON.stringify({
        raw_data: rawData,
        split_by_groups: splitByGroups,
        selected_groups: selectedGroups,
      }),
    }),
};

// ── CLP (Course Learning Plan) Types ──
export interface CLPGroupAttendance {
  nama: string;
  jumlah_pelajar: number;
  kehadiran: number;
}

export interface CLPWeekData {
  minggu: number;
  tarikh: string;
  topik: string;
  jam: string;
  hpk: string;
  catatan: string;
  hasil_pembelajaran: string;
  strategi_aktiviti: string;
  refleksi: string;
  refleksi_tutorial: string;
  refleksi_epembelajaran: string;
}

export interface CLPUploadMetadata {
  nama_kursus: string;
  kod_kursus: string;
  semester: string;
  tahun: string;
  pensyarah: string;
  jabatan: string;
  program: string;
  ambilan: string;
  jumlah_kredit: string;
  kumpulan_diajar: string[];
}

export interface CLPSessionDraft {
  session_id: string;
  owner_id: string;
  metadata: CLPUploadMetadata;
  weeks: CLPWeekData[];
  tarikh: string;
  kumpulan_list: CLPGroupAttendance[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CLPUploadResponse {
  session_id: string;
  metadata: CLPUploadMetadata;
  weeks: CLPWeekData[];
}

export interface CLPDraftListItem {
  session_id: string;
  nama_kursus: string;
  kod_kursus: string;
  week_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CLPGenerateProgress {
  current: number;
  total: number;
  minggu: number;
  topik: string;
}

// ── CLP API ──
export const clpApi = {
  upload: async (file: File): Promise<CLPUploadResponse> => {
    const token = await getFirebaseToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/clp/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  generate: async (
    body: {
      session_id: string;
      tarikh?: string;
      kumpulan_list?: CLPGroupAttendance[];
      selected_weeks?: number[];
      nama_kursus?: string;
      kod_kursus?: string;
      pensyarah?: string;
      weeks?: CLPWeekData[];
      detail_level?: string;
    },
    onProgress?: (data: CLPGenerateProgress) => void,
    onDone?: (data: CLPSessionDraft) => void,
    onError?: (error: string) => void,
  ): Promise<void> => {
    const token = await getFirebaseToken();
    const res = await fetch(`${BASE}/clp/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Generate failed");
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("event: progress")) continue;
        if (line.startsWith("event: done")) continue;
        if (line.startsWith("event: error")) continue;
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              onError?.(data.error);
            } else if (data.session_id && data.weeks) {
              onDone?.(data as CLPSessionDraft);
            } else if (data.current !== undefined) {
              onProgress?.(data as CLPGenerateProgress);
            }
          } catch { /* skip parse errors */ }
        }
      }
    }
  },

  listDrafts: () => request<CLPDraftListItem[]>("/clp/drafts"),

  getDraft: (sessionId: string) => request<CLPSessionDraft>(`/clp/drafts/${sessionId}`),

  updateDraft: (sessionId: string, body: {
    weeks: CLPWeekData[];
    tarikh?: string;
    kumpulan_list?: CLPGroupAttendance[];
  }) => request<CLPSessionDraft>(`/clp/drafts/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }),

  deleteDraft: (sessionId: string) => request<{ ok: boolean }>(`/clp/drafts/${sessionId}`, { method: "DELETE" }),

  download: async (body: {
    session_id: string;
    selected_weeks: number[];
    format?: string;
    include_input?: boolean;
  }): Promise<Blob> => {
    const token = await getFirebaseToken();
    const res = await fetch(`${BASE}/clp/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Download failed");
    }
    return res.blob();
  },
};
