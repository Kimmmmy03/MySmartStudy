"""
Collection name constants and helpers for Firestore.

Field names in Firestore use camelCase to match the old system.
API responses use snake_case — the router _xxx_out() helpers do the mapping.
"""
import uuid
import random
import string

# ── Collection names (match old system) ──
USERS = "users"
MAPS = "maps"
COURSES = "courses"
ASSIGNMENTS = "assignments"
SUBMISSIONS = "submissions"
ANNOUNCEMENTS = "announcements"
DISCUSSIONS = "discussions"
COURSE_MODULES = "courseModules"
MODULE_ITEMS = "moduleItems"
REMINDERS = "reminders"
AUDIT_LOGS = "auditLogs"
ACTIVITY_FEED = "activityFeed"
NOTIFICATIONS = "notifications"
REFLECTIONS = "reflections"
FCM_TOKENS = "fcmTokens"
RESOURCE_PROGRESS = "resourceProgress"
HOMEPAGE_CONTENT = "homepageContent"
QUIZZES = "quizzes"
QUIZ_QUESTIONS = "quizQuestions"
QUIZ_ATTEMPTS = "quizAttempts"
MESSAGES = "messages"
CONVERSATIONS = "conversations"
PEER_REVIEWS = "peerReviews"
ATTENDANCE = "attendance"
ATTENDANCE_RECORDS = "attendanceRecords"
RUBRICS = "rubrics"
CERTIFICATES = "certificates"
COURSE_GROUPS = "courseGroups"
GROUP_TASKS = "groupTasks"
GRADE_SETTINGS = "gradeSettings"
DISCUSSION_TOPICS = "discussionTopics"
ADMIN_ANNOUNCEMENTS = "adminAnnouncements"  # admin-broadcast emails (subject, body, audience, recipientCount)
EMAIL_SETTINGS = "emailSettings"             # singleton "global" doc — admin SMTP master switch + per-type allow-list

# ── AI feature collections ──
AI_PLAGIARISM_REPORTS = "aiPlagiarismReports"
PLAGIARISM_REVIEWS = "plagiarismReviews"  # lecturer human-in-the-loop decisions on flagged pairs
GRADE_REVIEWS = "gradeReviews"  # lecturer accept/override decisions on AI grade recommendations (audit + QWK calibration)
AI_GRADE_RECOMMENDATIONS = "aiGradeRecommendations"
LEARNING_PROFILES = "learningProfiles"
AI_CHAT_HISTORY = "aiChatHistory"
GENERATED_STUDY_MATERIALS = "generatedStudyMaterials"
STUDY_QUIZ_ATTEMPTS = "studyQuizAttempts"
AI_STUDY_PLANS = "aiStudyPlans"
SAVED_TIMETABLES = "savedTimetables"
EXAM_SCHEDULES = "examSchedules"
AI_MINDMAP_BUDDY_MEMORY = "aiMindmapBuddyMemory"
MAP_HISTORY = "mapHistory"

# ── AI result cache collections (avoid re-burning API credits) ──
AI_DAILY_GUIDE_CACHE  = "aiDailyGuideCache"   # keyed by userId+date
AI_MAP_ANALYSIS_CACHE = "aiMapAnalysisCache"  # keyed by userId+contentHash
AI_NODE_RECS_CACHE    = "aiNodeRecsCache"     # keyed by cacheKey hash
AI_SUGGEST_ALL_CACHE  = "aiSuggestAllCache"   # keyed by userId+contentHash
AI_IMAGE_QUOTAS       = "aiImageQuotas"       # keyed by userId+date (1/day limit)
AI_IMAGE_CACHE        = "aiImageCache"        # keyed by promptHash (prompt dedup)
AI_EXAM_PLAN_CACHE    = "aiExamPlanCache"     # keyed by userId+examsHash (permanent)
AI_TIMETABLE_CACHE    = "aiTimetableCache"    # keyed by textHash (30-day TTL)
AI_IMPORT_CACHE       = "aiImportCache"       # keyed by urlHash (24-hour TTL)
AI_COMPANION_QUESTION_CACHE = "aiCompanionQuestionCache"  # global Q&A dedup, 7-day TTL
AI_ELABORATION_CACHE        = "aiElaborationCache"         # image prompt elaboration, 30-day TTL
AI_USAGE_SUMMARY            = "aiUsageSummary"             # keyed by userId — token usage aggregates
AI_USER_SETTINGS            = "aiUserSettings"             # keyed by userId — per-user overrides
AI_DAILY_USAGE              = "aiDailyUsage"               # keyed by userId_YYYY-MM-DD — daily token counter
AI_CONFIG                   = "aiConfig"                   # singleton "global" doc — default token limits

# ── User sessions + feature usage (admin analytics) ──
USER_SESSIONS = "userSessions"                       # keyed by userId_YYYY-MM-DD — daily time + feature visits
USER_ACTIVITY_AGGREGATE = "userActivityAggregate"    # keyed by userId — lifetime totals for fast top-users queries

# ── Course views (recently viewed tracking) ──
COURSE_VIEWS = "courseViews"

# ── Map views (recently viewed tracking for lecturers reviewing student maps) ──
MAP_VIEWS = "mapViews"

# ── Social graph (Phase 1 followers feature) ──
FOLLOWS = "follows"                # keyed by {followerId}_{followedId} — one doc per directed edge
MAP_LIKES = "mapLikes"             # keyed by {mapId}_{userId} — one doc per (map, liker) pair
MAP_COMMENTS = "mapComments"       # auto-id; fields: mapId, authorId, text, createdAt

# ── Badge definitions ──
BADGE_DEFINITIONS = "badgeDefinitions"

# ── RAG / Knowledge Graph collections ──
RAG_INDEX_STATE = "ragIndexState"
KNOWLEDGE_GRAPHS = "knowledgeGraphs"

# ── CLP (Course Learning Plan) collections ──
CLP_DRAFTS = "clpDrafts"
CLP_FILE_HASHES = "clpFileHashes"
CLP_FAILED_UPLOADS = "clpFailedUploads"
CLP_EXTRACTION_RESULTS = "clpExtractionResults"


def gen_id() -> str:
    return str(uuid.uuid4())


def gen_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def doc_to_dict(doc) -> dict | None:
    """Convert a Firestore DocumentSnapshot to a dict with 'id' included."""
    if not doc.exists:
        return None
    d = doc.to_dict()
    d["id"] = doc.id
    return d


def get_user_photo_urls(db, user_ids) -> dict:
    """Bulk-lookup photoURL for a set of user IDs. Returns {uid: photoURL or None}.
    Used by list endpoints that render avatars alongside names.
    """
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    refs = [db.collection(USERS).document(uid) for uid in ids]
    out: dict = {}
    try:
        docs = db.get_all(refs)
        for d in docs:
            data = d.to_dict() or {}
            out[d.id] = data.get("photoURL") or None
    except Exception:
        # Fallback: fetch one-by-one (e.g. emulator without get_all).
        for uid in ids:
            snap = db.collection(USERS).document(uid).get()
            data = snap.to_dict() or {}
            out[uid] = data.get("photoURL") or None
    for uid in ids:
        out.setdefault(uid, None)
    return out


def get_user_photo_url(db, user_id: str) -> str | None:
    """Single-user photoURL lookup. Returns None if the user doesn't exist."""
    if not user_id:
        return None
    snap = db.collection(USERS).document(user_id).get()
    if not snap.exists:
        return None
    return (snap.to_dict() or {}).get("photoURL") or None
