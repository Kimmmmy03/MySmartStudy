"""
Auto-badge engine: check and award badges based on user activity milestones.
Called after key actions (submit assignment, complete quiz, etc.).
Also checks custom badge definitions from Firestore.
"""
from google.cloud.firestore_v1 import ArrayUnion
from .. import models
from .notifications import create_notification
from google.cloud.firestore_v1.base_query import FieldFilter


# ── Built-in badge criteria (hardcoded defaults) ──
BADGE_CRITERIA = {
    "cartographer": {
        "name": "Cartographer",
        "condition_type": "maps_created",
        "condition_value": 1,
        "desc": "Create your first mind map",
    },
    "map_master": {
        "name": "Map Master",
        "condition_type": "maps_created",
        "condition_value": 5,
        "desc": "Create 5 mind maps",
    },
    "on_fire": {
        "name": "On Fire",
        "condition_type": "streak_days",
        "condition_value": 3,
        "desc": "Maintain a 3-day streak",
    },
    "unstoppable": {
        "name": "Unstoppable",
        "condition_type": "streak_days",
        "condition_value": 7,
        "desc": "Maintain a 7-day streak",
    },
    "top_marks": {
        "name": "Top Marks",
        "condition_type": "quiz_score",
        "condition_value": 90,
        "desc": "Score 90%+ on any assignment or quiz",
    },
    "early_bird": {
        "name": "Early Bird",
        "condition_type": "early_submissions",
        "condition_value": 1,
        "desc": "Submit an assignment 24+ hours before deadline",
    },
    "quiz_whiz": {
        "name": "Quiz Whiz",
        "condition_type": "quizzes_completed",
        "condition_value": 5,
        "desc": "Complete 5 quizzes",
    },
    "helper": {
        "name": "Helper",
        "condition_type": "peer_reviews",
        "condition_value": 3,
        "desc": "Write 3 peer reviews",
    },
    "completionist": {
        "name": "Completionist",
        "condition_type": "course_completed",
        "condition_value": 1,
        "desc": "Complete all activities in any course",
    },
    "explorer": {
        "name": "Explorer",
        "condition_type": "courses_joined",
        "condition_value": 1,
        "desc": "Join your first course",
    },
    "team_player": {
        "name": "Team Player",
        "condition_type": "collaborations",
        "condition_value": 3,
        "desc": "Collaborate on 3 mind maps",
    },
}


# ── Condition checkers by type ──

def _check_maps_created(db, user_id: str, value: int, course_id: str = None) -> bool:
    q = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", user_id))
    docs = list(q.limit(value).get())
    return len(docs) >= value


def _check_streak_days(db, user_id: str, value: int, course_id: str = None) -> bool:
    doc = db.collection(models.USERS).document(user_id).get()
    u = models.doc_to_dict(doc)
    return u and u.get("streak", 0) >= value


def _check_quiz_score(db, user_id: str, value: int, course_id: str = None) -> bool:
    # Check submissions for grade >= value
    sub_docs = list(db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("studentId", "==", user_id)).get())
    for s_doc in sub_docs:
        s = models.doc_to_dict(s_doc)
        if s and s.get("grade") is not None and s["grade"] >= value:
            return True
    # Check quiz attempts for percentage >= value
    att_docs = list(db.collection(models.QUIZ_ATTEMPTS).where(
        filter=FieldFilter("studentId", "==", user_id)).get())
    for a_doc in att_docs:
        a = models.doc_to_dict(a_doc)
        if a and a.get("percentage", 0) >= value:
            return True
    return False


def _check_quizzes_completed(db, user_id: str, value: int, course_id: str = None) -> bool:
    q = db.collection(models.QUIZ_ATTEMPTS).where(
        filter=FieldFilter("studentId", "==", user_id))
    if course_id:
        # Filter by course: get quiz IDs for this course first
        quiz_docs = list(db.collection(models.QUIZZES).where(
            filter=FieldFilter("courseId", "==", course_id)).get())
        quiz_ids = {models.doc_to_dict(d)["id"] for d in quiz_docs if d.exists}
        attempts = list(q.get())
        count = sum(1 for a in attempts
                    if models.doc_to_dict(a) and models.doc_to_dict(a).get("quizId") in quiz_ids)
        return count >= value
    docs = list(q.limit(value).get())
    return len(docs) >= value


def _check_assignments_submitted(db, user_id: str, value: int, course_id: str = None) -> bool:
    q = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("studentId", "==", user_id))
    if course_id:
        # Get assignment IDs for this course
        a_docs = list(db.collection(models.ASSIGNMENTS).where(
            filter=FieldFilter("courseId", "==", course_id)).get())
        a_ids = {models.doc_to_dict(d)["id"] for d in a_docs if d.exists}
        subs = list(q.get())
        count = sum(1 for s in subs
                    if models.doc_to_dict(s) and models.doc_to_dict(s).get("assignmentId") in a_ids)
        return count >= value
    docs = list(q.limit(value).get())
    return len(docs) >= value


def _check_peer_reviews(db, user_id: str, value: int, course_id: str = None) -> bool:
    docs = list(db.collection(models.PEER_REVIEWS).where(
        filter=FieldFilter("reviewerId", "==", user_id)).limit(value).get())
    return len(docs) >= value


def _check_early_submissions(db, user_id: str, value: int, course_id: str = None) -> bool:
    from datetime import timedelta, datetime
    sub_docs = list(db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("studentId", "==", user_id)).get())
    count = 0
    for s_doc in sub_docs:
        s = models.doc_to_dict(s_doc)
        if not s:
            continue
        aid = s.get("assignmentId")
        if not aid:
            continue
        a_doc = db.collection(models.ASSIGNMENTS).document(aid).get()
        a = models.doc_to_dict(a_doc)
        if not a or not a.get("deadline"):
            continue
        try:
            deadline = datetime.fromisoformat(a["deadline"].replace("Z", "+00:00").replace("Z", ""))
            submitted = s.get("submittedAt")
            if submitted and hasattr(submitted, 'timestamp'):
                if (deadline - submitted).total_seconds() > 86400:
                    count += 1
        except Exception:
            continue
    return count >= value


def _check_courses_joined(db, user_id: str, value: int, course_id: str = None) -> bool:
    docs = list(
        db.collection(models.COURSES)
        .where(filter=FieldFilter("enrolledStudents", "array_contains", user_id))
        .limit(value).get()
    )
    return len(docs) >= value


def _check_collaborations(db, user_id: str, value: int, course_id: str = None) -> bool:
    docs = list(
        db.collection(models.MAPS)
        .where(filter=FieldFilter("collaborators", "array_contains", user_id))
        .limit(value).get()
    )
    return len(docs) >= value


def _check_course_completed(db, user_id: str, value: int, course_id: str = None) -> bool:
    """Check if user completed all activities in any enrolled course (or specific course)."""
    if course_id:
        course_ids = [course_id]
    else:
        course_docs = (
            db.collection(models.COURSES)
            .where(filter=FieldFilter("enrolledStudents", "array_contains", user_id))
            .get()
        )
        course_ids = [models.doc_to_dict(d)["id"] for d in course_docs if d.exists]

    for cid in course_ids:
        # Check assignments
        a_docs = list(db.collection(models.ASSIGNMENTS).where(
            filter=FieldFilter("courseId", "==", cid)).get())
        if not a_docs:
            continue
        all_done = True
        for a_doc in a_docs:
            a = models.doc_to_dict(a_doc)
            if not a:
                continue
            subs = list(
                db.collection(models.SUBMISSIONS)
                .where(filter=FieldFilter("assignmentId", "==", a["id"]))
                .where(filter=FieldFilter("studentId", "==", user_id))
                .limit(1).get()
            )
            if not subs:
                all_done = False
                break

        if not all_done:
            continue

        # Check quizzes
        q_docs = list(db.collection(models.QUIZZES).where(
            filter=FieldFilter("courseId", "==", cid)).get())
        for q_doc in q_docs:
            q = models.doc_to_dict(q_doc)
            if not q:
                continue
            atts = list(
                db.collection(models.QUIZ_ATTEMPTS)
                .where(filter=FieldFilter("quizId", "==", q["id"]))
                .where(filter=FieldFilter("studentId", "==", user_id))
                .limit(1).get()
            )
            if not atts:
                all_done = False
                break

        if all_done:
            return True

    return False


# Map condition_type to checker functions
_CONDITION_CHECKERS = {
    "maps_created": _check_maps_created,
    "streak_days": _check_streak_days,
    "quiz_score": _check_quiz_score,
    "quizzes_completed": _check_quizzes_completed,
    "assignments_submitted": _check_assignments_submitted,
    "peer_reviews": _check_peer_reviews,
    "early_submissions": _check_early_submissions,
    "course_completed": _check_course_completed,
    "courses_joined": _check_courses_joined,
    "collaborations": _check_collaborations,
}


def check_and_award_badges(db, user_id: str):
    """Check all badge criteria (built-in + custom) and award any newly earned badges.
    Both students and lecturers can earn badges — only admins are skipped."""
    user_doc = db.collection(models.USERS).document(user_id).get()
    u = models.doc_to_dict(user_doc)
    if not u:
        return []
    # Admins don't earn badges
    if u.get("role") == "admin":
        return []

    current_badges = set(u.get("badges", []))
    newly_awarded = []

    # Check built-in badges
    for badge_id, info in BADGE_CRITERIA.items():
        if badge_id in current_badges:
            continue
        checker = _CONDITION_CHECKERS.get(info["condition_type"])
        if not checker:
            continue
        try:
            if checker(db, user_id, info["condition_value"]):
                newly_awarded.append(badge_id)
        except Exception:
            continue

    # Check custom badge definitions from Firestore
    try:
        custom_docs = db.collection(models.BADGE_DEFINITIONS).stream()
        for doc in custom_docs:
            d = models.doc_to_dict(doc)
            if not d:
                continue
            badge_id = d["id"]
            if badge_id in current_badges:
                continue
            condition_type = d.get("condition_type")
            condition_value = d.get("condition_value", 1)
            course_id = d.get("course_id")
            checker = _CONDITION_CHECKERS.get(condition_type)
            if not checker:
                continue
            try:
                if checker(db, user_id, condition_value, course_id):
                    newly_awarded.append(badge_id)
            except Exception:
                continue
    except Exception:
        pass

    if newly_awarded:
        db.collection(models.USERS).document(user_id).update(
            {"badges": ArrayUnion(newly_awarded)}
        )
        # Add points for each badge
        for badge_id in newly_awarded:
            # Get badge name for notification
            if badge_id in BADGE_CRITERIA:
                name = BADGE_CRITERIA[badge_id]["name"]
                desc = BADGE_CRITERIA[badge_id]["desc"]
            else:
                # Custom badge — look up from Firestore
                try:
                    bdoc = db.collection(models.BADGE_DEFINITIONS).document(badge_id).get()
                    bd = models.doc_to_dict(bdoc)
                    name = bd.get("name", badge_id) if bd else badge_id
                    desc = bd.get("description", "") if bd else ""
                except Exception:
                    name = badge_id
                    desc = ""

            create_notification(
                db, user_id,
                f"Badge Earned: {name}!",
                f'You earned the "{name}" badge — {desc}',
                "badge",
            )

    return newly_awarded
