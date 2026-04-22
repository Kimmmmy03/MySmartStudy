from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{cid}/groups", tags=["Course Groups"])


def _group_out(g: dict, db) -> schemas.GroupOut:
    members = []
    for sid in g.get("memberIds", []):
        u_doc = db.collection(models.USERS).document(sid).get()
        u = models.doc_to_dict(u_doc)
        members.append({
            "student_id": sid,
            "student_name": u.get("displayName", "") if u else "",
        })
    return schemas.GroupOut(
        id=g["id"],
        course_id=g.get("courseId", ""),
        name=g.get("name", ""),
        description=g.get("description", ""),
        members=members,
        created_at=g.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/", response_model=list[schemas.GroupOut])
def list_groups(cid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """List all groups in a course."""
    docs = db.collection(models.COURSE_GROUPS).where(filter=FieldFilter("courseId", "==", cid)).get()
    return [_group_out(models.doc_to_dict(d), db) for d in docs if models.doc_to_dict(d)]


@router.post("/", response_model=schemas.GroupOut, status_code=201)
def create_group(cid: str, req: schemas.GroupCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Create a new group in a course."""
    gid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": cid,
        "name": req.name,
        "description": req.description,
        "memberIds": [],
        "createdAt": now,
    }
    db.collection(models.COURSE_GROUPS).document(gid).set(data)
    data["id"] = gid
    return _group_out(data, db)


@router.post("/{gid}/members")
def add_members(cid: str, gid: str, req: schemas.GroupAddMembers, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Add students to a group."""
    from google.cloud.firestore_v1 import ArrayUnion
    doc_ref = db.collection(models.COURSE_GROUPS).document(gid)
    doc = doc_ref.get()
    g = models.doc_to_dict(doc)
    if not g or g.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group not found")
    doc_ref.update({"memberIds": ArrayUnion(req.student_ids)})
    return {"ok": True}


@router.delete("/{gid}/members/{sid}")
def remove_member(cid: str, gid: str, sid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Remove a student from a group."""
    from google.cloud.firestore_v1 import ArrayRemove
    doc_ref = db.collection(models.COURSE_GROUPS).document(gid)
    doc = doc_ref.get()
    g = models.doc_to_dict(doc)
    if not g or g.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group not found")
    doc_ref.update({"memberIds": ArrayRemove([sid])})
    return {"ok": True}


@router.delete("/{gid}")
def delete_group(cid: str, gid: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Delete a group."""
    doc = db.collection(models.COURSE_GROUPS).document(gid).get()
    g = models.doc_to_dict(doc)
    if not g or g.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group not found")
    db.collection(models.COURSE_GROUPS).document(gid).delete()
    return {"ok": True}


@router.post("/auto-assign")
def auto_assign_groups(cid: str, group_count: int = 4, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    """Automatically create groups and randomly distribute students."""
    import random

    course_doc = db.collection(models.COURSES).document(cid).get()
    course = models.doc_to_dict(course_doc)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    student_ids = list(course.get("enrolledStudents", []))
    if not student_ids:
        raise HTTPException(status_code=400, detail="No students enrolled")

    # Delete existing groups
    existing = db.collection(models.COURSE_GROUPS).where(filter=FieldFilter("courseId", "==", cid)).get()
    for d in existing:
        d.reference.delete()

    random.shuffle(student_ids)
    group_count = min(group_count, len(student_ids))
    now = datetime.now(timezone.utc)

    groups = []
    for i in range(group_count):
        gid = models.gen_id()
        data = {
            "courseId": cid,
            "name": f"Group {i + 1}",
            "description": "",
            "memberIds": [],
            "createdAt": now,
        }
        db.collection(models.COURSE_GROUPS).document(gid).set(data)
        data["id"] = gid
        groups.append(data)

    # Distribute students round-robin
    for idx, sid in enumerate(student_ids):
        g = groups[idx % group_count]
        from google.cloud.firestore_v1 import ArrayUnion
        db.collection(models.COURSE_GROUPS).document(g["id"]).update(
            {"memberIds": ArrayUnion([sid])}
        )
        g["memberIds"].append(sid)

    return [_group_out(g, db) for g in groups]
