from fastapi import APIRouter, Depends, Query
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from datetime import datetime, timedelta
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/progress", tags=["Progress"])


@router.get("/courses", response_model=list[schemas.CourseProgressOut])
def get_course_progress(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get completion progress for all enrolled courses."""
    course_docs = (
        db.collection(models.COURSES)
        .where(filter=FieldFilter("enrolledStudents", "array_contains", user["id"]))
        .get()
    )

    results = []
    for c_doc in course_docs:
        c = models.doc_to_dict(c_doc)
        if not c:
            continue
        cid = c["id"]

        # Assignments
        a_docs = list(db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("courseId", "==", cid)).get())
        total_a = len(a_docs)
        submitted_a = 0
        for a_doc in a_docs:
            a = models.doc_to_dict(a_doc)
            if not a:
                continue
            subs = list(
                db.collection(models.SUBMISSIONS)
                .where(filter=FieldFilter("assignmentId", "==", a["id"]))
                .where(filter=FieldFilter("studentId", "==", user["id"]))
                .limit(1)
                .get()
            )
            if subs:
                submitted_a += 1

        # Quizzes
        q_docs = list(db.collection(models.QUIZZES).where(filter=FieldFilter("courseId", "==", cid)).get())
        total_q = len(q_docs)
        completed_q = 0
        for q_doc in q_docs:
            q = models.doc_to_dict(q_doc)
            if not q:
                continue
            atts = list(
                db.collection(models.QUIZ_ATTEMPTS)
                .where(filter=FieldFilter("quizId", "==", q["id"]))
                .where(filter=FieldFilter("studentId", "==", user["id"]))
                .limit(1)
                .get()
            )
            if atts:
                completed_q += 1

        # Resources
        mod_docs = list(db.collection(models.COURSE_MODULES).where(filter=FieldFilter("courseId", "==", cid)).get())
        total_r = 0
        for m_doc in mod_docs:
            items = list(db.collection(models.MODULE_ITEMS).where(filter=FieldFilter("moduleId", "==", m_doc.id)).get())
            total_r += len(items)

        # Resource progress
        try:
            progress_docs = list(
                db.collection(models.RESOURCE_PROGRESS)
                .where(filter=FieldFilter("userId", "==", user["id"]))
                .where(filter=FieldFilter("courseId", "==", cid))
                .get()
            )
            opened_r = len(progress_docs)
        except Exception:
            opened_r = 0

        # Calculate overall
        total_items = total_a + total_q + total_r
        completed_items = submitted_a + completed_q + opened_r
        pct = (completed_items / total_items * 100) if total_items > 0 else 0

        results.append(schemas.CourseProgressOut(
            course_id=cid,
            course_name=c.get("courseName", ""),
            course_code=c.get("courseCode", ""),
            total_assignments=total_a,
            submitted_assignments=submitted_a,
            total_quizzes=total_q,
            completed_quizzes=completed_q,
            total_resources=total_r,
            opened_resources=opened_r,
            overall_percentage=round(pct, 1),
        ))

    return results


@router.get("/calendar", response_model=list[schemas.CalendarEventOut])
def get_calendar_events(
    month: str = Query(None, description="YYYY-MM format"),
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get all calendar events: assignment deadlines, quiz deadlines, and reminders."""
    events: list[schemas.CalendarEventOut] = []

    # Get enrolled courses
    course_docs = (
        db.collection(models.COURSES)
        .where(filter=FieldFilter("enrolledStudents", "array_contains", user["id"]))
        .get()
    )
    courses = {models.doc_to_dict(d)["id"]: models.doc_to_dict(d) for d in course_docs if models.doc_to_dict(d)}

    # Also include teaching courses for lecturers
    if user.get("role") == "lecturer":
        teach_docs = db.collection(models.COURSES).where(filter=FieldFilter("lecturerId", "==", user["id"])).get()
        for d in teach_docs:
            c = models.doc_to_dict(d)
            if c:
                courses[c["id"]] = c

    for cid, course in courses.items():
        course_name = course.get("courseName", "")

        # Assignment deadlines
        a_docs = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("courseId", "==", cid)).get()
        for a_doc in a_docs:
            a = models.doc_to_dict(a_doc)
            if not a or not a.get("deadline"):
                continue
            # Check if submitted
            submitted = False
            if user.get("role") == "student":
                subs = list(
                    db.collection(models.SUBMISSIONS)
                    .where(filter=FieldFilter("assignmentId", "==", a["id"]))
                    .where(filter=FieldFilter("studentId", "==", user["id"]))
                    .limit(1)
                    .get()
                )
                submitted = len(subs) > 0

            events.append(schemas.CalendarEventOut(
                id=a["id"],
                title=a.get("title", ""),
                date=a["deadline"][:10] if len(a["deadline"]) > 10 else a["deadline"],
                type="assignment",
                course_name=course_name,
                course_id=cid,
                is_completed=submitted,
            ))

        # Quiz deadlines
        q_docs = db.collection(models.QUIZZES).where(filter=FieldFilter("courseId", "==", cid)).get()
        for q_doc in q_docs:
            q = models.doc_to_dict(q_doc)
            if not q or not q.get("deadline"):
                continue
            completed = False
            if user.get("role") == "student":
                atts = list(
                    db.collection(models.QUIZ_ATTEMPTS)
                    .where(filter=FieldFilter("quizId", "==", q["id"]))
                    .where(filter=FieldFilter("studentId", "==", user["id"]))
                    .limit(1)
                    .get()
                )
                completed = len(atts) > 0

            events.append(schemas.CalendarEventOut(
                id=q["id"],
                title=q.get("title", ""),
                date=q["deadline"][:10] if len(q["deadline"]) > 10 else q["deadline"],
                type="quiz",
                course_name=course_name,
                course_id=cid,
                is_completed=completed,
            ))

    # User reminders
    reminder_docs = db.collection(models.REMINDERS).where(filter=FieldFilter("ownerId", "==", user["id"])).get()
    for r_doc in reminder_docs:
        r = models.doc_to_dict(r_doc)
        if not r:
            continue
        events.append(schemas.CalendarEventOut(
            id=r["id"],
            title=r.get("title", ""),
            date=r.get("date", ""),
            type="reminder",
            is_completed=r.get("isCompleted", False),
        ))

    # Saved timetable classes + recommended study times → recurring weekly events
    DAY_MAP = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }

    try:
        tt_docs = (
            db.collection(models.SAVED_TIMETABLES)
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .get()
        )

        # Determine the date range to populate (current month ± buffer)
        if month:
            base_year, base_month = int(month[:4]), int(month[5:7])
        else:
            now = datetime.utcnow()
            base_year, base_month = now.year, now.month

        # Build 5 weeks of dates starting from 1st of the month
        month_start = datetime(base_year, base_month, 1)
        month_end = datetime(base_year, base_month + 1, 1) if base_month < 12 else datetime(base_year + 1, 1, 1)
        # Extend to cover full calendar weeks
        start = month_start - timedelta(days=month_start.weekday())  # Monday before month
        end = month_end + timedelta(days=(6 - month_end.weekday()) % 7)  # Sunday after month

        for tt_doc in tt_docs:
            tt = tt_doc.to_dict()
            label = tt.get("semesterLabel", "")

            # Inject class events
            for day_entry in tt.get("parsed_schedule", []):
                day_name = day_entry.get("day", "").lower()
                day_idx = DAY_MAP.get(day_name)
                if day_idx is None:
                    continue

                for cls in day_entry.get("classes", []):
                    # Find all dates in range that match this weekday
                    # Python weekday: Monday=0 ... Sunday=6
                    d = start
                    while d <= end:
                        if d.weekday() == day_idx:
                            date_str = d.strftime("%Y-%m-%d")
                            events.append(schemas.CalendarEventOut(
                                id=f"tt-{tt_doc.id}-{day_name}-{cls.get('time', '')}",
                                title=cls.get("subject", "Class"),
                                date=date_str,
                                type="class",
                                time=cls.get("time", ""),
                                location=cls.get("location"),
                                course_name=f"{label}" if label else None,
                            ))
                        d += timedelta(days=1)

            # Inject recommended study time events
            for slot in tt.get("recommended_study_times", []):
                slot_day = slot.get("day", "").lower()
                slot_idx = DAY_MAP.get(slot_day)
                if slot_idx is None:
                    continue

                d = start
                while d <= end:
                    if d.weekday() == slot_idx:
                        date_str = d.strftime("%Y-%m-%d")
                        duration = slot.get("duration_minutes", 0)
                        reason = slot.get("reason", "Free gap")
                        events.append(schemas.CalendarEventOut(
                            id=f"st-{tt_doc.id}-{slot_day}-{slot.get('time', '')}",
                            title=f"Study Time ({duration} min)",
                            date=date_str,
                            type="study_time",
                            time=slot.get("time", ""),
                            course_name=reason if reason else None,
                        ))
                    d += timedelta(days=1)
    except Exception:
        pass  # Timetable data is optional

    # Exam plan study sessions
    try:
        plan_docs = (
            db.collection(models.AI_STUDY_PLANS)
            .where(filter=FieldFilter("userId", "==", user["id"]))
            .order_by("createdAt", direction="DESCENDING")
            .limit(10)
            .get()
        )
        for p_doc in plan_docs:
            p = p_doc.to_dict()
            if not p:
                continue
            plan_id = p_doc.id
            plan_exams = p.get("exams", [])
            exam_courses = ", ".join(e.get("course_name", "") for e in plan_exams) if plan_exams else "Exam"
            for day in p.get("plan", []):
                day_date = day.get("date", "")
                if not day_date:
                    continue
                for si, session in enumerate(day.get("sessions", [])):
                    duration = session.get("duration_minutes", 0)
                    events.append(schemas.CalendarEventOut(
                        id=f"ep-{plan_id}-{day_date}-{si}",
                        title=f"{session.get('topic', 'Study Session')}",
                        date=day_date,
                        type="study_plan",
                        course_name=session.get("course", exam_courses),
                        time=f"{duration} min" if duration else None,
                    ))
    except Exception:
        pass  # Exam plan data is optional

    # Sort by date, then by time
    events.sort(key=lambda e: (e.date, e.time or ""))
    return events
