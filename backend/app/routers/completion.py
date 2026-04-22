from fastapi import APIRouter, Depends
from .. import models
from ..firestore import get_db
from ..auth import require_lecturer
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/completion", tags=["Course Completion"])


def _chunks(seq: list, size: int = 30):
    """Yield chunks of a list (Firestore `in` operator max 30 values)."""
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _prefetch_course_data(db, course_id: str):
    """Fetch everything needed to compute completion for every student in one go.

    Returns:
        assignment_ids, quiz_ids, resource_ids,
        submissions_by_assignment: {assignment_id: {student_id: submission_dict}},
        attempts_by_quiz:          {quiz_id: set(student_ids)},
        progress_by_resource:      {resource_id: set(user_ids)},
    """
    # Assignments
    assignment_docs = list(
        db.collection(models.ASSIGNMENTS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .get()
    )
    assignment_ids = [a.id for a in assignment_docs]

    # Quizzes
    quiz_docs = list(
        db.collection(models.QUIZZES)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .get()
    )
    quiz_ids = [q.id for q in quiz_docs]

    # Modules → items
    module_docs = list(
        db.collection(models.COURSE_MODULES)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .get()
    )
    module_ids = [m.id for m in module_docs]

    resource_ids: list[str] = []
    for chunk in _chunks(module_ids):
        if not chunk:
            continue
        item_docs = list(
            db.collection(models.MODULE_ITEMS)
            .where(filter=FieldFilter("moduleId", "in", chunk))
            .get()
        )
        resource_ids.extend(i.id for i in item_docs)

    # Submissions — group by assignmentId → studentId → submission
    submissions_by_assignment: dict[str, dict[str, dict]] = {}
    for chunk in _chunks(assignment_ids):
        if not chunk:
            continue
        sub_docs = list(
            db.collection(models.SUBMISSIONS)
            .where(filter=FieldFilter("assignmentId", "in", chunk))
            .get()
        )
        for s_doc in sub_docs:
            s = models.doc_to_dict(s_doc)
            if not s:
                continue
            aid = s.get("assignmentId", "")
            sid = s.get("studentId", "")
            if aid and sid:
                submissions_by_assignment.setdefault(aid, {})[sid] = s

    # Quiz attempts — group by quizId → set of studentIds (existence is all we need)
    attempts_by_quiz: dict[str, set[str]] = {}
    for chunk in _chunks(quiz_ids):
        if not chunk:
            continue
        att_docs = list(
            db.collection(models.QUIZ_ATTEMPTS)
            .where(filter=FieldFilter("quizId", "in", chunk))
            .get()
        )
        for a_doc in att_docs:
            a = models.doc_to_dict(a_doc)
            if not a:
                continue
            qid = a.get("quizId", "")
            sid = a.get("studentId", "")
            if qid and sid:
                attempts_by_quiz.setdefault(qid, set()).add(sid)

    # Resource progress — group by resourceId → set of userIds
    progress_by_resource: dict[str, set[str]] = {}
    for chunk in _chunks(resource_ids):
        if not chunk:
            continue
        prog_docs = list(
            db.collection(models.RESOURCE_PROGRESS)
            .where(filter=FieldFilter("resourceId", "in", chunk))
            .get()
        )
        for p_doc in prog_docs:
            p = models.doc_to_dict(p_doc)
            if not p:
                continue
            rid = p.get("resourceId", "")
            uid = p.get("userId", "")
            if rid and uid:
                progress_by_resource.setdefault(rid, set()).add(uid)

    return (
        assignment_ids,
        quiz_ids,
        resource_ids,
        submissions_by_assignment,
        attempts_by_quiz,
        progress_by_resource,
    )


def _completion_for_student(
    student_id: str,
    assignment_ids: list[str],
    quiz_ids: list[str],
    resource_ids: list[str],
    submissions_by_assignment: dict[str, dict[str, dict]],
    attempts_by_quiz: dict[str, set[str]],
    progress_by_resource: dict[str, set[str]],
) -> dict:
    total_assignments = len(assignment_ids)
    submitted_assignments = 0
    graded_assignments = 0
    for aid in assignment_ids:
        sub = submissions_by_assignment.get(aid, {}).get(student_id)
        if sub:
            submitted_assignments += 1
            if sub.get("grade") is not None:
                graded_assignments += 1

    total_quizzes = len(quiz_ids)
    completed_quizzes = sum(
        1 for qid in quiz_ids if student_id in attempts_by_quiz.get(qid, set())
    )

    total_resources = len(resource_ids)
    opened_resources = sum(
        1 for rid in resource_ids if student_id in progress_by_resource.get(rid, set())
    )

    total_items = total_assignments + total_quizzes + total_resources
    completed_items = submitted_assignments + completed_quizzes + opened_resources
    overall_pct = (
        round(completed_items / total_items * 100, 1) if total_items > 0 else 0
    )

    return {
        "total_assignments": total_assignments,
        "submitted_assignments": submitted_assignments,
        "graded_assignments": graded_assignments,
        "total_quizzes": total_quizzes,
        "completed_quizzes": completed_quizzes,
        "total_resources": total_resources,
        "opened_resources": opened_resources,
        "overall_percentage": overall_pct,
    }


@router.get("/course/{course_id}")
def get_course_completion(
    course_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Lecturer: get completion tracking for all students in a course."""
    doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(doc)
    if not course or course.get("lecturerId") != user["id"]:
        return []

    student_ids = course.get("enrolledStudents", [])
    if not student_ids:
        return []

    (
        assignment_ids,
        quiz_ids,
        resource_ids,
        submissions_by_assignment,
        attempts_by_quiz,
        progress_by_resource,
    ) = _prefetch_course_data(db, course_id)

    # Batch-fetch student user docs
    students: dict[str, dict] = {}
    for chunk in _chunks(student_ids):
        if not chunk:
            continue
        # Firestore has no native `documentId() in [...]` helper in python SDK;
        # fall back to parallel individual gets — still fast for <100 users.
        for sid in chunk:
            s_doc = db.collection(models.USERS).document(sid).get()
            s = models.doc_to_dict(s_doc)
            if s:
                students[sid] = s

    results = []
    for sid in student_ids:
        s = students.get(sid)
        if not s:
            continue
        completion = _completion_for_student(
            sid,
            assignment_ids,
            quiz_ids,
            resource_ids,
            submissions_by_assignment,
            attempts_by_quiz,
            progress_by_resource,
        )
        results.append({
            "student_id": sid,
            "student_name": s.get("displayName", ""),
            "student_email": s.get("email", ""),
            "student_photo_url": s.get("photoURL", "") or None,
            **completion,
        })

    results.sort(key=lambda x: x["overall_percentage"], reverse=True)
    return results


@router.get("/course/{course_id}/summary")
def get_course_completion_summary(
    course_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Lecturer: get aggregated completion summary for a course."""
    doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(doc)
    if not course or course.get("lecturerId") != user["id"]:
        return {}

    student_ids = course.get("enrolledStudents", [])
    if not student_ids:
        return {
            "total_students": 0,
            "avg_completion": 0,
            "fully_complete": 0,
            "at_risk": 0,
            "assignment_completion_rate": 0,
            "quiz_completion_rate": 0,
            "resource_completion_rate": 0,
        }

    (
        assignment_ids,
        quiz_ids,
        resource_ids,
        submissions_by_assignment,
        attempts_by_quiz,
        progress_by_resource,
    ) = _prefetch_course_data(db, course_id)

    completions: list[float] = []
    total_a_sub = 0
    total_q_done = 0
    total_r_open = 0

    for sid in student_ids:
        c = _completion_for_student(
            sid,
            assignment_ids,
            quiz_ids,
            resource_ids,
            submissions_by_assignment,
            attempts_by_quiz,
            progress_by_resource,
        )
        completions.append(c["overall_percentage"])
        total_a_sub += c["submitted_assignments"]
        total_q_done += c["completed_quizzes"]
        total_r_open += c["opened_resources"]

    total_a = len(assignment_ids) * len(student_ids)
    total_q = len(quiz_ids) * len(student_ids)
    total_r = len(resource_ids) * len(student_ids)

    avg = sum(completions) / len(completions) if completions else 0
    fully_complete = sum(1 for c in completions if c >= 100)
    at_risk = sum(1 for c in completions if c < 30)

    return {
        "total_students": len(student_ids),
        "avg_completion": round(avg, 1),
        "fully_complete": fully_complete,
        "at_risk": at_risk,
        "assignment_completion_rate": round(total_a_sub / total_a * 100, 1) if total_a > 0 else 0,
        "quiz_completion_rate": round(total_q_done / total_q * 100, 1) if total_q > 0 else 0,
        "resource_completion_rate": round(total_r_open / total_r * 100, 1) if total_r > 0 else 0,
    }
