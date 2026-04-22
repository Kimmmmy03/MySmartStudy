"""Background scheduler for automated tasks."""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta, timezone
from . import models
from .firestore import db
from .routers.notifications import create_notification
from google.cloud.firestore_v1.base_query import FieldFilter

scheduler = BackgroundScheduler()


def _cleanup_presence():
    """Remove stale presence documents older than 60 seconds."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
    maps = db.collection(models.MAPS).get()
    for m_doc in maps:
        presence_docs = (
            m_doc.reference.collection("presence")
            .where(filter=FieldFilter("lastSeen", "<", cutoff))
            .get()
        )
        for p in presence_docs:
            p.reference.delete()


def _check_study_reminders():
    """Notify students whose maps haven't been edited in >3 days."""
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    users = db.collection(models.USERS).where(filter=FieldFilter("role", "==", "student")).get()
    for u_doc in users:
        u = models.doc_to_dict(u_doc)
        if not u:
            continue
        # Check if user has any recent map activity
        recent_maps = (
            db.collection(models.MAPS)
            .where(filter=FieldFilter("ownerId", "==", u["id"]))
            .where(filter=FieldFilter("lastModified", ">=", three_days_ago))
            .limit(1)
            .get()
        )
        if not list(recent_maps):
            # Check if we already notified recently
            recent_notifs = (
                db.collection(models.NOTIFICATIONS)
                .where(filter=FieldFilter("userId", "==", u["id"]))
                .where(filter=FieldFilter("title", "==", "Time to study!"))
                .order_by("createdAt", direction="DESCENDING")
                .limit(1)
                .get()
            )
            already_notified = False
            for n in recent_notifs:
                nd = n.to_dict()
                if nd.get("createdAt") and hasattr(nd["createdAt"], "timestamp"):
                    if (datetime.now(timezone.utc) - nd["createdAt"]).days < 3:
                        already_notified = True
            if not already_notified:
                create_notification(
                    db, u["id"],
                    "Time to study!",
                    "You haven't edited any maps in 3+ days. Keep your streak going!",
                    "info",
                )


def _check_assignment_deadlines():
    """Alert students about upcoming assignment deadlines (24h and 2h before)."""
    now = datetime.now(timezone.utc)
    h24 = now + timedelta(hours=24)
    h2 = now + timedelta(hours=2)

    assignments = db.collection(models.ASSIGNMENTS).get()
    for a_doc in assignments:
        a = models.doc_to_dict(a_doc)
        if not a:
            continue
        deadline_str = a.get("deadline", "")
        try:
            deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, AttributeError):
            continue

        course_doc = db.collection(models.COURSES).document(a.get("courseId", "")).get()
        course = models.doc_to_dict(course_doc)
        if not course:
            continue

        for student_id in course.get("enrolledStudents", []):
            # Check if already submitted
            subs = (
                db.collection(models.SUBMISSIONS)
                .where(filter=FieldFilter("assignmentId", "==", a["id"]))
                .where(filter=FieldFilter("studentId", "==", student_id))
                .limit(1)
                .get()
            )
            if list(subs):
                continue

            if h2 <= deadline <= h24:
                create_notification(
                    db, student_id,
                    f"Deadline approaching: {a.get('title', '')}",
                    f"Due in less than 24 hours",
                    "urgent",
                )


def _index_all_courses():
    """Periodically re-index all course content into ChromaDB vector store."""
    import asyncio
    from .rag_service import index_course_content

    try:
        courses = db.collection(models.COURSES).get()
        for doc in courses:
            try:
                asyncio.run(index_course_content(doc.id))
            except Exception as e:
                logger.error("Failed to index course %s: %s", doc.id, e)
    except Exception as e:
        logger.error("RAG indexing job failed: %s", e)


def _rebuild_knowledge_graphs():
    """Periodically rebuild concept graphs for all courses."""
    import asyncio
    try:
        from .knowledge_graph_service import build_course_graph
        courses = db.collection(models.COURSES).get()
        for doc in courses:
            try:
                asyncio.run(build_course_graph(doc.id))
            except Exception as e:
                logger.error("Failed to build graph for course %s: %s", doc.id, e)
    except ImportError:
        pass  # knowledge_graph_service not yet created
    except Exception as e:
        logger.error("Knowledge graph rebuild failed: %s", e)


logger = logging.getLogger(__name__)


def start_scheduler():
    """Start the background scheduler with all jobs."""
    scheduler.add_job(_cleanup_presence, "interval", minutes=2, id="cleanup_presence", replace_existing=True)
    scheduler.add_job(_check_study_reminders, "cron", hour=9, id="study_reminders", replace_existing=True)
    scheduler.add_job(_check_assignment_deadlines, "cron", hour="*/6", id="deadline_alerts", replace_existing=True)
    scheduler.add_job(_index_all_courses, "cron", hour=2, minute=0, id="rag_indexing", replace_existing=True)
    scheduler.add_job(_rebuild_knowledge_graphs, "cron", hour=3, id="knowledge_graphs", replace_existing=True)
    scheduler.start()


def stop_scheduler():
    """Shutdown the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
