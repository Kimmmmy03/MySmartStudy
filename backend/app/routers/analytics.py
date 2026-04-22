from fastapi import APIRouter, Depends
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from datetime import datetime, timedelta, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/", response_model=schemas.AnalyticsOut)
def get_analytics(user: dict = Depends(require_lecturer), db=Depends(get_db)):
    course_docs = db.collection(models.COURSES).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    courses = [models.doc_to_dict(d) for d in course_docs]

    total_students = 0
    for c in courses:
        total_students += len(c.get("enrolledStudents", []))

    assign_docs = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    assignments = [models.doc_to_dict(d) for d in assign_docs]

    stats = []
    total_subs = 0
    total_possible = 0

    for a in assignments:
        course = next((c for c in courses if c["id"] == a.get("courseId")), None)
        enrolled = len(course.get("enrolledStudents", [])) if course else 0
        sub_docs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", a["id"])).get()
        sub_count = len(list(sub_docs))
        stats.append({"title": a.get("title", ""), "submitted": sub_count, "total": enrolled})
        total_subs += sub_count
        total_possible += enrolled

    avg_rate = round((total_subs / total_possible * 100), 1) if total_possible > 0 else 0

    return schemas.AnalyticsOut(
        total_students=total_students,
        total_courses=len(courses),
        avg_submission_rate=avg_rate,
        assignment_stats=stats,
    )


@router.get("/map-type-popularity")
def map_type_popularity(user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Count maps by type across lecturer's students."""
    course_docs = db.collection(models.COURSES).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    student_ids = set()
    for d in course_docs:
        c = models.doc_to_dict(d)
        student_ids.update(c.get("enrolledStudents", []))

    type_counts: dict[str, int] = {}
    for sid in student_ids:
        maps = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", sid)).get()
        for m_doc in maps:
            m = m_doc.to_dict()
            fmt = m.get("graphFormat", "reactflow")
            type_counts[fmt] = type_counts.get(fmt, 0) + 1

    return [{"type": k, "count": v} for k, v in type_counts.items()]


@router.get("/engagement-heatmap")
def engagement_heatmap(user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """7x24 grid of activity counts (day-of-week x hour)."""
    course_docs = db.collection(models.COURSES).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    student_ids = set()
    for d in course_docs:
        c = models.doc_to_dict(d)
        student_ids.update(c.get("enrolledStudents", []))

    heatmap = [[0] * 24 for _ in range(7)]  # 7 days x 24 hours

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    for sid in list(student_ids)[:50]:  # Limit to avoid excessive reads
        activities = (
            db.collection(models.ACTIVITY_FEED)
            .where(filter=FieldFilter("userId", "==", sid))
            .where(filter=FieldFilter("createdAt", ">=", thirty_days_ago))
            .get()
        )
        for a_doc in activities:
            a = a_doc.to_dict()
            dt = a.get("createdAt")
            if dt and hasattr(dt, "weekday"):
                heatmap[dt.weekday()][dt.hour] += 1

    return {"data": heatmap, "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}


@router.get("/at-risk-students")
def at_risk_students(user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Students inactive for >7 days or with 0 submissions."""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    course_docs = db.collection(models.COURSES).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()

    at_risk = []
    seen = set()
    for d in course_docs:
        c = models.doc_to_dict(d)
        for sid in c.get("enrolledStudents", []):
            if sid in seen:
                continue
            seen.add(sid)
            u_doc = db.collection(models.USERS).document(sid).get()
            u = models.doc_to_dict(u_doc)
            if not u:
                continue

            last_active = u.get("lastActiveAt")
            inactive = True
            if last_active and hasattr(last_active, "timestamp"):
                inactive = last_active < seven_days_ago

            # Count submissions
            subs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("studentId", "==", sid)).limit(1).get()
            has_submissions = bool(list(subs))

            if inactive or not has_submissions:
                at_risk.append({
                    "id": u["id"],
                    "display_name": u.get("displayName", ""),
                    "email": u.get("email", ""),
                    "photo_url": u.get("photoURL", "") or None,
                    "last_active": str(last_active) if last_active else "Never",
                    "has_submissions": has_submissions,
                    "reason": "Inactive >7 days" if inactive else "No submissions",
                })

    return at_risk


@router.get("/submission-trends")
def submission_trends(user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Weekly submission counts over the past 8 weeks."""
    now = datetime.now(timezone.utc)
    weeks = []
    for i in range(7, -1, -1):
        start = now - timedelta(weeks=i + 1)
        end = now - timedelta(weeks=i)
        weeks.append({"start": start, "end": end, "label": start.strftime("%b %d")})

    assign_docs = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
    assignment_ids = [models.doc_to_dict(d)["id"] for d in assign_docs]

    results = []
    for week in weeks:
        count = 0
        for aid in assignment_ids:
            subs = (
                db.collection(models.SUBMISSIONS)
                .where(filter=FieldFilter("assignmentId", "==", aid))
                .where(filter=FieldFilter("submittedAt", ">=", week["start"]))
                .where(filter=FieldFilter("submittedAt", "<", week["end"]))
                .get()
            )
            count += len(list(subs))
        results.append({"week": week["label"], "submissions": count})

    return results
