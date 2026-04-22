from fastapi import APIRouter, Depends
from .. import models
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{course_id}/participation", tags=["Participation"])

# Scoring weights
WEIGHTS = {
    "discussion": 5,
    "map": 10,
    "submission": 15,
}


@router.get("/")
def get_participation(course_id: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Get participation scores for all students in a course."""
    course_doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(course_doc)
    if not course:
        return []

    student_ids = course.get("enrolledStudents", [])
    results = []

    for sid in student_ids:
        u_doc = db.collection(models.USERS).document(sid).get()
        u = models.doc_to_dict(u_doc)
        if not u:
            continue

        # Count discussions
        disc_docs = db.collection(models.DISCUSSIONS).where(filter=FieldFilter("courseId", "==", course_id)).where(filter=FieldFilter("senderId", "==", sid)).get()
        disc_count = len(list(disc_docs))

        # Count maps
        map_docs = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", sid)).get()
        map_count = len(list(map_docs))

        # Count submissions for this course's assignments
        assign_docs = db.collection(models.ASSIGNMENTS).where(filter=FieldFilter("courseId", "==", course_id)).get()
        sub_count = 0
        for a_doc in assign_docs:
            a = models.doc_to_dict(a_doc)
            subs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", a["id"])).where(filter=FieldFilter("studentId", "==", sid)).limit(1).get()
            if list(subs):
                sub_count += 1

        total = (disc_count * WEIGHTS["discussion"]) + (map_count * WEIGHTS["map"]) + (sub_count * WEIGHTS["submission"])

        results.append({
            "student_id": sid,
            "display_name": u.get("displayName", ""),
            "email": u.get("email", ""),
            "photo_url": u.get("photoURL", "") or None,
            "discussions": disc_count,
            "maps": map_count,
            "submissions": sub_count,
            "total_score": total,
            "breakdown": {
                "discussions": disc_count * WEIGHTS["discussion"],
                "maps": map_count * WEIGHTS["map"],
                "submissions": sub_count * WEIGHTS["submission"],
            },
        })

    return sorted(results, key=lambda x: x["total_score"], reverse=True)
