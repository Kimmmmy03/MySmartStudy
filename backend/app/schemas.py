from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ── Auth ──
class SyncRequest(BaseModel):
    id_token: str
    display_name: Optional[str] = None
    role: Optional[str] = "student"
    class_name: Optional[str] = ""
    year: Optional[int] = None
    semester: Optional[int] = None
    department: Optional[str] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


# ── User ──
class NotificationPrefs(BaseModel):
    new_follower: bool = True
    map_like: bool = True
    map_comment: bool = True
    # Noisy channel — opt-in so feed posters don't spam every follower's inbox.
    followed_user_posts: bool = False


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    class_name: str
    photo_url: str
    year: Optional[int] = None
    semester: Optional[int] = None
    department: Optional[str] = None
    points: int = 0
    streak: int = 0
    badges: list[str] = []
    # Social graph (Phase 1 followers feature)
    bio: str = ""
    cover_photo_url: str = ""
    follower_count: int = 0
    following_count: int = 0
    notification_prefs: NotificationPrefs = NotificationPrefs()
    # Viewer-relative flag — only set when served from a profile endpoint that
    # knows who's asking. For anonymous lists (admin users list, etc.) stays None.
    is_followed_by_me: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    class_name: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    department: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    cover_photo_url: Optional[str] = None
    notification_prefs: Optional[NotificationPrefs] = None


# ── Maps ──
class MapCreate(BaseModel):
    title: str = "Untitled Map"
    graph_data: str = "{}"
    graph_format: str = "reactflow"
    nodes_text: str = ""
    thumbnail: str = ""
    # Visibility defaults to private so existing code paths stay safe — students
    # have to explicitly opt in to share to followers.
    visibility: str = "private"  # "private" | "unlisted" | "public"

class MapUpdate(BaseModel):
    title: Optional[str] = None
    graph_data: Optional[str] = None
    nodes_text: Optional[str] = None
    thumbnail: Optional[str] = None
    visibility: Optional[str] = None

class MapOut(BaseModel):
    id: str
    owner_id: str
    owner_email: str
    owner_name: str = ""
    owner_photo_url: Optional[str] = None
    title: str
    graph_data: str
    graph_format: str
    nodes_text: str
    thumbnail: str
    share_code: str
    collaborators: list[str] = []
    # Social / visibility (Phase 1)
    visibility: str = "private"
    like_count: int = 0
    comment_count: int = 0
    published_at: Optional[datetime] = None
    # Viewer-relative flags — set by endpoints that know who's asking.
    is_liked_by_me: Optional[bool] = None
    owner_is_followed_by_me: Optional[bool] = None
    last_modified: datetime

    class Config:
        from_attributes = True

# ── Social graph (Phase 1 followers feature) ──
class FollowOut(BaseModel):
    follower_id: str
    followed_id: str
    created_at: datetime


class PublicProfileOut(BaseModel):
    """Lean view of another user for profile + list displays. Mirrors UserOut
    but drops admin-ish fields (email, class_name, etc.) and includes a
    viewer-relative `is_followed_by_me` flag."""
    id: str
    display_name: str
    photo_url: str
    cover_photo_url: str = ""
    bio: str = ""
    role: str
    follower_count: int = 0
    following_count: int = 0
    is_followed_by_me: bool = False
    created_at: Optional[datetime] = None


class MapCommentCreate(BaseModel):
    text: str


class MapCommentOut(BaseModel):
    id: str
    map_id: str
    author_id: str
    author_name: str
    author_photo_url: Optional[str] = None
    text: str
    created_at: datetime


class MapHistoryOut(BaseModel):
    id: str
    map_id: str
    user_id: str
    user_email: str
    user_name: str
    action: str
    summary: str
    created_at: datetime


# ── Courses ──
class CourseCreate(BaseModel):
    course_name: str
    course_code: str
    semester: str = "1"
    year: Optional[int] = None
    academic_session: str = ""
    description: str = ""
    theme_color: str = ""
    pattern: str = ""

class CourseUpdate(BaseModel):
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    academic_session: Optional[str] = None
    description: Optional[str] = None
    theme_color: Optional[str] = None
    pattern: Optional[str] = None

class CourseOut(BaseModel):
    id: str
    lecturer_id: str
    lecturer_name: str
    course_name: str
    course_code: str
    semester: str
    year: Optional[int] = None
    academic_session: str = ""
    join_code: str
    description: str
    enrolled_count: int = 0
    theme_color: str = ""
    pattern: str = ""
    created_at: datetime

    class Config:
        from_attributes = True

class JoinCourseRequest(BaseModel):
    join_code: str


# ── Assignments ──
class AttachmentItem(BaseModel):
    name: str
    url: str
    type: str = "link"  # "link", "pdf", "image", "file"

class AssignmentCreate(BaseModel):
    course_id: str
    title: str
    description: str = ""
    deadline: str
    allowed_map_types: list[str] = []
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    prerequisite_id: Optional[str] = None
    min_grade: Optional[float] = None
    assignment_type: str = "assignment"  # "assignment", "tutorial", "project"
    quiz_id: Optional[str] = None  # link to a quiz for quiz-type assignments
    attachments: list[AttachmentItem] = []
    peer_review_enabled: bool = False

class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[str] = None
    allowed_map_types: Optional[list[str]] = None
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    prerequisite_id: Optional[str] = None
    min_grade: Optional[float] = None
    assignment_type: Optional[str] = None
    quiz_id: Optional[str] = None
    attachments: Optional[list[AttachmentItem]] = None
    peer_review_enabled: Optional[bool] = None

class AssignmentOut(BaseModel):
    id: str
    lecturer_id: str
    course_id: str
    title: str
    description: str
    deadline: str
    allowed_map_types: list[str] = []
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    prerequisite_id: Optional[str] = None
    prerequisite_title: Optional[str] = None
    min_grade: Optional[float] = None
    assignment_type: str = "assignment"
    quiz_id: Optional[str] = None
    attachments: list[dict] = []
    peer_review_enabled: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ── Submissions ──
class SubmissionCreate(BaseModel):
    submission_type: str = "map"
    map_id: Optional[str] = None
    external_link: Optional[str] = None
    comments: str = ""

class SubmissionGrade(BaseModel):
    grade: float
    feedback: str = ""

class SubmissionOut(BaseModel):
    id: str
    assignment_id: str
    student_id: str
    student_name: str
    student_photo_url: Optional[str] = None
    submission_type: str
    map_id: Optional[str] = None
    external_link: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    comments: str
    grade: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


# ── Announcements ──
class AnnouncementCreate(BaseModel):
    title: str
    content: str

class AnnouncementOut(BaseModel):
    id: str
    course_id: str
    title: str
    content: str
    sender_name: str
    sender_id: str
    sender_photo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Discussions ──
class DiscussionCreate(BaseModel):
    text: str

class DiscussionOut(BaseModel):
    id: str
    course_id: str
    text: str
    sender_id: str
    sender_name: str
    sender_role: str
    sender_photo_url: Optional[str] = None
    edited: bool = False
    edited_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Resources ──
class ModuleCreate(BaseModel):
    title: str
    description: str = ""

class ModuleItemCreate(BaseModel):
    title: str
    type: str = "link"
    url: str = ""
    file_type: Optional[str] = None  # pdf, video, link, map_template
    unlock_date: Optional[datetime] = None

class ModuleOut(BaseModel):
    id: str
    course_id: str
    title: str
    description: str
    items: list["ModuleItemOut"] = []
    created_at: datetime

    class Config:
        from_attributes = True

class ModuleItemOut(BaseModel):
    id: str
    module_id: str
    title: str
    type: str
    url: str
    file_type: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    unlock_date: Optional[datetime] = None
    embed_url: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ResourceProgressIn(BaseModel):
    resource_id: str

class ResourceProgressOut(BaseModel):
    resource_id: str
    opened_at: datetime


# ── Reminders ──
class ReminderCreate(BaseModel):
    date: str
    title: str
    type: str = "Assignment"
    priority: str = "normal"

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None

class ReminderOut(BaseModel):
    id: str
    owner_id: str
    date: str
    title: str
    type: str
    priority: str
    is_completed: bool

    class Config:
        from_attributes = True


# ── Badges ──
class BadgeAction(BaseModel):
    student_id: str
    badge_id: str


class BadgeDefinitionCreate(BaseModel):
    name: str
    description: str
    icon: str  # emoji
    color: str  # tailwind gradient e.g. "from-blue-500 to-cyan-400"
    condition_type: str  # "maps_created" | "streak_days" | "quiz_score" | "quizzes_completed" | "assignments_submitted" | "peer_reviews" | "early_submissions" | "course_completed" | "custom"
    condition_value: int  # threshold value for the condition
    course_id: Optional[str] = None  # if set, badge is course-specific
    points_reward: int = 25
    lottie_size: Optional[int] = None  # custom render size for lottie icon (px)
    lottie_dpr: Optional[float] = None  # device pixel ratio for lottie rendering quality


class BadgeDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    condition_type: Optional[str] = None
    condition_value: Optional[int] = None
    course_id: Optional[str] = None
    points_reward: Optional[int] = None
    lottie_size: Optional[int] = None  # custom render size for lottie icon (px)
    lottie_dpr: Optional[float] = None  # device pixel ratio for lottie rendering quality


# ── Reflections ──
class ReflectionCreate(BaseModel):
    confidence: int  # 1-5
    notes: str = ""
    week_label: str = ""

class ReflectionOut(BaseModel):
    id: str
    owner_id: str
    confidence: int
    notes: str
    week_label: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Analytics ──
class AnalyticsOut(BaseModel):
    total_students: int
    total_courses: int
    avg_submission_rate: float
    assignment_stats: list[dict]


# ── Homepage Content ──
class HomepageContentCreate(BaseModel):
    type: str = "news"  # "news" or "poster"
    title: str
    content: Optional[str] = ""
    image_url: Optional[str] = ""
    order: Optional[int] = None

class HomepageContentUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    order: Optional[int] = None
    visible: Optional[bool] = None


# ── Quizzes ──
class QuestionCreate(BaseModel):
    type: str  # mcq, true_false, short_answer
    text: str
    options: list[str] = []  # for mcq
    correct_answer: str  # index for mcq ("0","1",..), "true"/"false", or text
    points: float = 1.0

class QuestionOut(BaseModel):
    id: str
    type: str
    text: str
    options: list[str] = []
    correct_answer: Optional[str] = None  # hidden from students during quiz
    points: float = 1.0

class QuizCreate(BaseModel):
    course_id: str
    title: str
    description: str = ""
    time_limit_minutes: Optional[int] = None
    deadline: Optional[str] = None
    shuffle_questions: bool = False
    show_results: bool = True  # show results to student after submission
    questions: list[QuestionCreate] = []

class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    deadline: Optional[str] = None
    shuffle_questions: Optional[bool] = None
    show_results: Optional[bool] = None

class QuizOut(BaseModel):
    id: str
    course_id: str
    lecturer_id: str
    title: str
    description: str
    time_limit_minutes: Optional[int] = None
    deadline: Optional[str] = None
    shuffle_questions: bool = False
    show_results: bool = True
    question_count: int = 0
    total_points: float = 0
    created_at: datetime

class QuizAttemptCreate(BaseModel):
    answers: dict[str, str]  # question_id -> student answer

class QuizAttemptOut(BaseModel):
    id: str
    quiz_id: str
    student_id: str
    student_name: str
    student_photo_url: Optional[str] = None
    answers: dict[str, str]
    score: float
    total_points: float
    percentage: float
    started_at: datetime
    submitted_at: datetime

    class Config:
        from_attributes = True


# ── Gradebook ──
class GradebookEntry(BaseModel):
    item_type: str  # "assignment" or "quiz"
    item_id: str
    title: str
    grade: Optional[float] = None
    total_points: float = 100
    percentage: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None

class CourseGradebook(BaseModel):
    course_id: str
    course_name: str
    course_code: str
    entries: list[GradebookEntry] = []
    average: Optional[float] = None


# ── Private Messaging ──
class MessageCreate(BaseModel):
    text: str

class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_photo_url: Optional[str] = None
    text: str
    edited: bool = False
    edited_at: Optional[datetime] = None
    deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationOut(BaseModel):
    id: str
    participants: list[str]  # user IDs
    participant_names: list[str]
    participant_photos: list[str]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0


# ── Discussion Replies (Threaded) ──
class DiscussionReplyCreate(BaseModel):
    text: str

class DiscussionReplyOut(BaseModel):
    id: str
    parent_id: str
    course_id: str
    text: str
    sender_id: str
    sender_name: str
    sender_role: str
    sender_photo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Peer Reviews ──
class PeerReviewCreate(BaseModel):
    rating: int  # 1-5
    comment: str = ""

class PeerReviewOut(BaseModel):
    id: str
    submission_id: str
    reviewer_id: str
    reviewer_name: str
    reviewer_photo_url: Optional[str] = None
    rating: int
    comment: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Course Progress ──
class CourseProgressOut(BaseModel):
    course_id: str
    course_name: str
    course_code: str
    total_assignments: int = 0
    submitted_assignments: int = 0
    total_quizzes: int = 0
    completed_quizzes: int = 0
    total_resources: int = 0
    opened_resources: int = 0
    overall_percentage: float = 0


# ── Calendar Events ──
class CalendarEventOut(BaseModel):
    id: str
    title: str
    date: str
    type: str  # "assignment", "quiz", "reminder", "attendance", "class", "study_time", "study_plan"
    course_name: Optional[str] = None
    course_id: Optional[str] = None
    is_completed: bool = False
    time: Optional[str] = None  # e.g. "9:00 AM - 10:00 AM"
    location: Optional[str] = None


# ── Attendance ──
class AttendanceSessionCreate(BaseModel):
    date: str
    title: str = ""
    start_time: Optional[str] = None  # "HH:MM" 24-hour local time
    end_time: Optional[str] = None

class AttendanceRecordCreate(BaseModel):
    student_id: str
    status: str  # "present", "absent", "late", "excused"

class AttendanceCheckIn(BaseModel):
    token: str

class AttendanceSessionOut(BaseModel):
    id: str
    course_id: str
    date: str
    title: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    qr_token: Optional[str] = None
    created_at: datetime

class AttendanceRecordOut(BaseModel):
    student_id: str
    student_name: str
    status: str
    scanned_at: Optional[datetime] = None


# ── Grading Rubrics ──
class RubricCriterion(BaseModel):
    name: str
    description: str = ""
    max_points: float = 10

class RubricCreate(BaseModel):
    assignment_id: str
    title: str
    criteria: list[RubricCriterion]

class RubricOut(BaseModel):
    id: str
    assignment_id: str
    title: str
    criteria: list[dict]
    created_at: datetime

class RubricGradeCreate(BaseModel):
    """Grade a submission using a rubric — scores per criterion."""
    criterion_scores: dict[str, float]  # criterion_name -> score
    feedback: str = ""


# ── Certificates ──
class CertificateOut(BaseModel):
    id: str
    student_id: str
    student_name: str
    course_id: str
    course_name: str
    course_code: str
    lecturer_name: str
    completion_percentage: float
    issued_at: datetime
    certificate_number: str

    class Config:
        from_attributes = True


# ── Discussion Topics ──
class TopicCreate(BaseModel):
    title: str
    description: str = ""
    pinned: bool = False

class TopicOut(BaseModel):
    id: str
    course_id: str
    title: str
    description: str
    pinned: bool = False
    author_id: str
    author_name: str
    reply_count: int = 0
    last_activity: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Course Groups ──
class GroupCreate(BaseModel):
    name: str
    description: str = ""

class GroupAddMembers(BaseModel):
    student_ids: list[str]

class GroupOut(BaseModel):
    id: str
    course_id: str
    name: str
    description: str
    members: list[dict] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Group Tasks (task/project-scoped groups) ──
class GroupTaskCreate(BaseModel):
    title: str
    description: str = ""
    due_date: Optional[str] = None  # ISO date "YYYY-MM-DD"


class GroupTaskSummary(BaseModel):
    id: str
    course_id: str
    title: str
    description: str
    due_date: Optional[str] = None
    group_count: int = 0
    member_count: int = 0
    created_at: datetime


class GroupTaskDetail(BaseModel):
    id: str
    course_id: str
    title: str
    description: str
    due_date: Optional[str] = None
    groups: list[dict] = []
    created_at: datetime


class GroupInTaskCreate(BaseModel):
    name: str
    description: str = ""


class GroupInTaskAddMembers(BaseModel):
    student_ids: list[str]


# ── CLP (Course Learning Plan) ──
class CLPGroupAttendance(BaseModel):
    nama: str
    jumlah_pelajar: int = 23
    kehadiran: int = 23

class CLPWeekData(BaseModel):
    minggu: int
    tarikh: str = ""
    topik: str = ""
    jam: str = ""
    hpk: str = "HPK"
    catatan: str = ""
    hasil_pembelajaran: str = ""
    strategi_aktiviti: str = ""
    refleksi: str = ""
    refleksi_tutorial: str = ""
    refleksi_epembelajaran: str = ""

class CLPUploadMetadata(BaseModel):
    nama_kursus: str = ""
    kod_kursus: str = ""
    semester: str = ""
    tahun: str = ""
    pensyarah: str = ""
    jabatan: str = ""
    program: str = ""
    ambilan: str = ""
    jumlah_kredit: str = ""
    kumpulan_diajar: list[str] = []

class CLPSessionDraft(BaseModel):
    session_id: str
    owner_id: str = ""
    metadata: CLPUploadMetadata
    weeks: list[CLPWeekData] = []
    tarikh: str = ""
    kumpulan_list: list[CLPGroupAttendance] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CLPUploadResponse(BaseModel):
    session_id: str
    metadata: CLPUploadMetadata
    weeks: list[CLPWeekData]

class CLPGenerateRequest(BaseModel):
    session_id: str
    tarikh: str = ""
    kumpulan_list: list[CLPGroupAttendance] = []
    selected_weeks: list[int] = []
    nama_kursus: Optional[str] = None
    kod_kursus: Optional[str] = None
    pensyarah: Optional[str] = None
    weeks: Optional[list[CLPWeekData]] = None
    detail_level: str = "normal"

class CLPUpdateDraftRequest(BaseModel):
    weeks: list[CLPWeekData]
    tarikh: Optional[str] = None
    kumpulan_list: Optional[list[CLPGroupAttendance]] = None

class CLPDownloadRequest(BaseModel):
    session_id: str
    selected_weeks: list[int]
    format: str = "zip"
    include_input: bool = False

class CLPDraftListItem(BaseModel):
    session_id: str
    nama_kursus: str = ""
    kod_kursus: str = ""
    week_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
