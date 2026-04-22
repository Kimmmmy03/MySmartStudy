from fastapi import APIRouter, Depends, HTTPException, Query
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from ..audit import audit_log
from .activity import log_activity
from datetime import datetime, timezone
import random
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])


def _quiz_out(q: dict, question_count: int = 0, total_points: float = 0) -> schemas.QuizOut:
    return schemas.QuizOut(
        id=q["id"],
        course_id=q.get("courseId", ""),
        lecturer_id=q.get("lecturerId", ""),
        title=q.get("title", ""),
        description=q.get("description", ""),
        time_limit_minutes=q.get("timeLimitMinutes"),
        deadline=q.get("deadline"),
        shuffle_questions=q.get("shuffleQuestions", False),
        show_results=q.get("showResults", True),
        question_count=question_count,
        total_points=total_points,
        created_at=q.get("createdAt", datetime.now(timezone.utc)),
    )


def _question_out(q: dict, include_answer: bool = False) -> schemas.QuestionOut:
    return schemas.QuestionOut(
        id=q["id"],
        type=q.get("type", "mcq"),
        text=q.get("text", ""),
        options=q.get("options", []),
        correct_answer=q.get("correctAnswer") if include_answer else None,
        points=q.get("points", 1.0),
    )


def _attempt_out(a: dict, photo_url: str | None = None) -> schemas.QuizAttemptOut:
    return schemas.QuizAttemptOut(
        id=a["id"],
        quiz_id=a.get("quizId", ""),
        student_id=a.get("studentId", ""),
        student_name=a.get("studentName", ""),
        student_photo_url=photo_url if photo_url is not None else a.get("studentPhotoUrl"),
        answers=a.get("answers", {}),
        score=a.get("score", 0),
        total_points=a.get("totalPoints", 0),
        percentage=a.get("percentage", 0),
        started_at=a.get("startedAt", datetime.now(timezone.utc)),
        submitted_at=a.get("submittedAt", datetime.now(timezone.utc)),
    )


def _get_quiz_questions(db, quiz_id: str) -> list[dict]:
    """Get all questions for a quiz."""
    docs = (
        db.collection(models.QUIZ_QUESTIONS)
        .where(filter=FieldFilter("quizId", "==", quiz_id))
        .order_by("order")
        .get()
    )
    return [models.doc_to_dict(d) for d in docs]


# ── Quiz CRUD ──

@router.get("/", response_model=list[schemas.QuizOut])
def list_quizzes(course_id: str = Query(...), user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.QUIZZES)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .order_by("createdAt", direction="DESCENDING")
        .get()
    )
    results = []
    for d in docs:
        q = models.doc_to_dict(d)
        questions = _get_quiz_questions(db, q["id"])
        total_pts = sum(qq.get("points", 1.0) for qq in questions)
        results.append(_quiz_out(q, len(questions), total_pts))
    return results


@router.get("/{qid}")
def get_quiz(qid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.QUIZZES).document(qid).get()
    q = models.doc_to_dict(doc)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = _get_quiz_questions(db, qid)
    total_pts = sum(qq.get("points", 1.0) for qq in questions)
    out = _quiz_out(q, len(questions), total_pts).model_dump()
    return out


@router.get("/{qid}/questions")
def get_quiz_questions(qid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get questions for a quiz. Lecturers see correct answers, students don't."""
    doc = db.collection(models.QUIZZES).document(qid).get()
    q = models.doc_to_dict(doc)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    is_lecturer = user.get("role") == "lecturer" and q.get("lecturerId") == user["id"]
    questions = _get_quiz_questions(db, qid)

    if q.get("shuffleQuestions") and not is_lecturer:
        random.shuffle(questions)

    return [_question_out(qq, include_answer=is_lecturer).model_dump() for qq in questions]


@router.post("/", status_code=201)
def create_quiz(req: schemas.QuizCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    qid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": req.course_id,
        "lecturerId": user["id"],
        "title": req.title,
        "description": req.description,
        "timeLimitMinutes": req.time_limit_minutes,
        "deadline": req.deadline,
        "shuffleQuestions": req.shuffle_questions,
        "showResults": req.show_results,
        "createdAt": now,
    }
    db.collection(models.QUIZZES).document(qid).set(data)
    data["id"] = qid

    # Create questions
    total_pts = 0
    for i, question in enumerate(req.questions):
        question_id = models.gen_id()
        q_data = {
            "quizId": qid,
            "type": question.type,
            "text": question.text,
            "options": question.options,
            "correctAnswer": question.correct_answer,
            "points": question.points,
            "order": i,
        }
        db.collection(models.QUIZ_QUESTIONS).document(question_id).set(q_data)
        total_pts += question.points

    audit_log(db, user["id"], "create", "quiz", qid, f"Created quiz: {req.title}")
    return _quiz_out(data, len(req.questions), total_pts).model_dump()


@router.patch("/{qid}")
def update_quiz(qid: str, req: schemas.QuizUpdate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc_ref = db.collection(models.QUIZZES).document(qid)
    doc = doc_ref.get()
    q = models.doc_to_dict(doc)
    if not q or q.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    field_map = {
        "title": "title",
        "description": "description",
        "time_limit_minutes": "timeLimitMinutes",
        "deadline": "deadline",
        "shuffle_questions": "shuffleQuestions",
        "show_results": "showResults",
    }
    updates = req.model_dump(exclude_unset=True)
    fs_updates = {field_map.get(k, k): v for k, v in updates.items()}
    if fs_updates:
        doc_ref.update(fs_updates)
        q.update(fs_updates)

    questions = _get_quiz_questions(db, qid)
    total_pts = sum(qq.get("points", 1.0) for qq in questions)
    return _quiz_out(q, len(questions), total_pts).model_dump()


@router.delete("/{qid}")
def delete_quiz(qid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.QUIZZES).document(qid).get()
    q = models.doc_to_dict(doc)
    if not q or q.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")
    # Delete questions
    for qq in db.collection(models.QUIZ_QUESTIONS).where(filter=FieldFilter("quizId", "==", qid)).get():
        qq.reference.delete()
    # Delete attempts
    for a in db.collection(models.QUIZ_ATTEMPTS).where(filter=FieldFilter("quizId", "==", qid)).get():
        a.reference.delete()
    db.collection(models.QUIZZES).document(qid).delete()
    audit_log(db, user["id"], "delete", "quiz", qid)
    return {"ok": True}


# ── Questions management ──

@router.post("/{qid}/questions")
def add_question(qid: str, req: schemas.QuestionCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.QUIZZES).document(qid).get()
    q = models.doc_to_dict(doc)
    if not q or q.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    existing = _get_quiz_questions(db, qid)
    order = len(existing)

    question_id = models.gen_id()
    q_data = {
        "quizId": qid,
        "type": req.type,
        "text": req.text,
        "options": req.options,
        "correctAnswer": req.correct_answer,
        "points": req.points,
        "order": order,
    }
    db.collection(models.QUIZ_QUESTIONS).document(question_id).set(q_data)
    q_data["id"] = question_id
    return _question_out(q_data, include_answer=True).model_dump()


@router.delete("/{qid}/questions/{question_id}")
def delete_question(qid: str, question_id: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.QUIZZES).document(qid).get()
    q = models.doc_to_dict(doc)
    if not q or q.get("lecturerId") != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.collection(models.QUIZ_QUESTIONS).document(question_id).delete()
    return {"ok": True}


# ── Quiz Attempts (Student) ──

@router.post("/{qid}/attempt", status_code=201)
def submit_attempt(qid: str, req: schemas.QuizAttemptCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Student submits quiz answers. Auto-graded for mcq/true_false, manual for short_answer."""
    quiz_doc = db.collection(models.QUIZZES).document(qid).get()
    quiz = models.doc_to_dict(quiz_doc)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check deadline
    deadline = quiz.get("deadline")
    if deadline and datetime.now(timezone.utc).isoformat() > deadline:
        raise HTTPException(status_code=400, detail="Quiz deadline has passed")

    # Check for existing attempt
    existing = list(
        db.collection(models.QUIZ_ATTEMPTS)
        .where(filter=FieldFilter("quizId", "==", qid))
        .where(filter=FieldFilter("studentId", "==", user["id"]))
        .limit(1)
        .get()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already attempted this quiz")

    # Get questions and grade
    questions = _get_quiz_questions(db, qid)
    q_map = {q["id"]: q for q in questions}

    score = 0.0
    total_points = 0.0
    for q in questions:
        total_points += q.get("points", 1.0)
        student_answer = req.answers.get(q["id"], "").strip()
        correct = q.get("correctAnswer", "").strip()

        if q.get("type") in ("mcq", "true_false"):
            if student_answer.lower() == correct.lower():
                score += q.get("points", 1.0)
        elif q.get("type") == "short_answer":
            # Case-insensitive exact match for short answer
            if student_answer.lower() == correct.lower():
                score += q.get("points", 1.0)

    percentage = (score / total_points * 100) if total_points > 0 else 0
    now = datetime.now(timezone.utc)

    attempt_id = models.gen_id()
    photo_url = models.get_user_photo_url(db, user["id"])
    attempt_data = {
        "quizId": qid,
        "studentId": user["id"],
        "studentName": user.get("displayName", ""),
        "studentPhotoUrl": photo_url,
        "answers": req.answers,
        "score": score,
        "totalPoints": total_points,
        "percentage": round(percentage, 1),
        "startedAt": now,
        "submittedAt": now,
    }
    db.collection(models.QUIZ_ATTEMPTS).document(attempt_id).set(attempt_data)
    attempt_data["id"] = attempt_id

    log_activity(db, user["id"], "completed", "quiz", qid, quiz.get("title", ""))
    # Auto-badge check
    try:
        from .auto_badges import check_and_award_badges
        check_and_award_badges(db, user["id"])
    except Exception:
        pass
    return _attempt_out(attempt_data, photo_url).model_dump()


@router.get("/{qid}/attempt/mine")
def get_my_attempt(qid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get the current student's attempt for a quiz."""
    docs = list(
        db.collection(models.QUIZ_ATTEMPTS)
        .where(filter=FieldFilter("quizId", "==", qid))
        .where(filter=FieldFilter("studentId", "==", user["id"]))
        .limit(1)
        .get()
    )
    if not docs:
        return None
    return _attempt_out(models.doc_to_dict(docs[0]), models.get_user_photo_url(db, user["id"])).model_dump()


@router.get("/{qid}/attempts")
def get_quiz_attempts(qid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Lecturer: get all attempts for a quiz."""
    docs = (
        db.collection(models.QUIZ_ATTEMPTS)
        .where(filter=FieldFilter("quizId", "==", qid))
        .order_by("submittedAt", direction="DESCENDING")
        .get()
    )
    items = [models.doc_to_dict(d) for d in docs]
    photo_map = models.get_user_photo_urls(db, [a.get("studentId") for a in items])
    return [_attempt_out(a, photo_map.get(a.get("studentId"))).model_dump() for a in items]


@router.get("/{qid}/results")
def get_quiz_results(qid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get quiz results with correct answers (only if showResults is enabled and student has attempted)."""
    quiz_doc = db.collection(models.QUIZZES).document(qid).get()
    quiz = models.doc_to_dict(quiz_doc)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    is_lecturer = user.get("role") == "lecturer" and quiz.get("lecturerId") == user["id"]

    if not is_lecturer:
        if not quiz.get("showResults", True):
            raise HTTPException(status_code=403, detail="Results are not available for this quiz")
        # Verify student has attempted
        attempt = list(
            db.collection(models.QUIZ_ATTEMPTS)
            .where(filter=FieldFilter("quizId", "==", qid))
            .where(filter=FieldFilter("studentId", "==", user["id"]))
            .limit(1)
            .get()
        )
        if not attempt:
            raise HTTPException(status_code=403, detail="You must attempt the quiz first")

    questions = _get_quiz_questions(db, qid)
    return [_question_out(q, include_answer=True).model_dump() for q in questions]
