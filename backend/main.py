from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.firestore import db as _firestore_db  # noqa: F401 — ensures Firebase init on startup
from app.auth import get_current_user
from app.routers import auth, users, maps, courses, assignments, discussions, announcements, resources, reminders, badges, analytics, admin, activity, stats, notifications, participation, quizzes, gradebook, messaging, peer_review, progress, attendance, rubrics, certificates, groups, group_tasks, discussion_topics, completion, social
from app.routers import ai_plagiarism, ai_grading, ai_companion, ai_study_materials, ai_study_plan, ai_import, ai_images, ai_mindmap_buddy, rag_admin
from app.routers import site_import, clp
from app.scheduler import start_scheduler, stop_scheduler
from app.ai_service import configure_gemini
from app.rag_service import init_chroma
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_gemini()
    init_chroma()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="MySmartStudy API",
    description="Backend API for MySmartStudy collaborative learning platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Origins are configurable via the CORS_ORIGINS env var (comma-separated) so
# production can add the Firebase Hosting / custom domain URLs without a code
# change. The defaults cover local dev.
_cors_default = "http://localhost:3000,http://127.0.0.1:3000"
_cors_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _cors_default).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(maps.router)
app.include_router(courses.router)
app.include_router(assignments.router)
app.include_router(discussions.router)
app.include_router(announcements.router)
app.include_router(resources.router)
app.include_router(reminders.router)
app.include_router(badges.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(activity.router)
app.include_router(stats.router)
app.include_router(notifications.router)
app.include_router(participation.router)
app.include_router(quizzes.router)
app.include_router(gradebook.router)
app.include_router(messaging.router)
app.include_router(peer_review.router)
app.include_router(progress.router)
app.include_router(attendance.router)
app.include_router(rubrics.router)
app.include_router(certificates.router)
app.include_router(groups.router)
app.include_router(group_tasks.router)
app.include_router(discussion_topics.router)
app.include_router(completion.router)
app.include_router(social.router)

# AI feature routers
app.include_router(ai_plagiarism.router)
app.include_router(ai_grading.router)
app.include_router(ai_companion.router)
app.include_router(ai_study_materials.router)
app.include_router(ai_study_plan.router)
app.include_router(ai_import.router)
app.include_router(ai_images.router)
app.include_router(ai_mindmap_buddy.router)
app.include_router(rag_admin.router)
app.include_router(site_import.router)

# CLP (Course Learning Plan) router
app.include_router(clp.router)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def root():
    return {"message": "MySmartStudy API is running", "docs": "/docs"}


@app.get("/api/ai/status")
def ai_status(user: dict = Depends(get_current_user)):
    """Authenticated read of the AI gate so frontends can hide AI buttons.

    Returns the same view of aiConfig/global that the backend will enforce on
    the next Gemini call.
    """
    from app.ai_service import _load_ai_gate
    enabled, disabled = _load_ai_gate()
    return {"enabled": enabled, "disabled_features": sorted(disabled)}


@app.get("/api/homepage/content")
def public_homepage_content():
    """Public endpoint to get visible homepage content."""
    from app.firestore import db as firestore_db
    from app import models
    try:
        docs = firestore_db.collection(models.HOMEPAGE_CONTENT).order_by("order").get()
    except Exception:
        # Fallback: order_by may fail if index is missing or field is inconsistent
        docs = firestore_db.collection(models.HOMEPAGE_CONTENT).get()
    items = [models.doc_to_dict(d) for d in docs]
    visible = [i for i in items if i and i.get("visible", True)]
    # Sort by order field in Python as a fallback guarantee
    visible.sort(key=lambda x: x.get("order", 999))
    return visible


@app.get("/api/homepage/stats")
def public_homepage_stats():
    """Public endpoint returning real platform stats (counts only, no PII)."""
    from app.firestore import db as firestore_db
    from app import models
    from google.cloud.firestore_v1 import aggregation

    users_col = firestore_db.collection(models.USERS)
    maps_col = firestore_db.collection(models.MAPS)
    courses_col = firestore_db.collection(models.COURSES)

    # Count students
    student_q = users_col.where("role", "==", "student")
    student_count = 0
    for result in student_q.count().get():
        student_count = result[0].value

    # Count lecturers
    lecturer_q = users_col.where("role", "==", "lecturer")
    lecturer_count = 0
    for result in lecturer_q.count().get():
        lecturer_count = result[0].value

    # Count maps
    map_count = 0
    for result in maps_col.count().get():
        map_count = result[0].value

    # Count courses
    course_count = 0
    for result in courses_col.count().get():
        course_count = result[0].value

    return {
        "students": student_count,
        "lecturers": lecturer_count,
        "maps": map_count,
        "courses": course_count,
    }
