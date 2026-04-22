from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{cid}/group-tasks", tags=["Group Tasks"])


def _member_entry(sid: str, db) -> dict:
    u = models.doc_to_dict(db.collection(models.USERS).document(sid).get())
    return {
        "student_id": sid,
        "student_name": u.get("displayName", "") if u else "",
        "student_email": u.get("email", "") if u else "",
        "student_photo": u.get("photoURL", "") if u else "",
    }


def _groups_for_task(task_id: str, db) -> list[dict]:
    docs = (
        db.collection(models.COURSE_GROUPS)
        .where(filter=FieldFilter("taskId", "==", task_id))
        .get()
    )
    out = []
    for d in docs:
        g = models.doc_to_dict(d)
        if not g:
            continue
        out.append({
            "id": g["id"],
            "task_id": task_id,
            "name": g.get("name", ""),
            "description": g.get("description", ""),
            "members": [_member_entry(sid, db) for sid in g.get("memberIds", [])],
            "created_at": g.get("createdAt", datetime.now(timezone.utc)),
        })
    # Stable order: by createdAt asc, fall back to name
    out.sort(key=lambda x: (str(x.get("created_at", "")), x.get("name", "")))
    return out


def _task_summary(t: dict, db) -> dict:
    groups = _groups_for_task(t["id"], db)
    total_members = sum(len(g["members"]) for g in groups)
    return {
        "id": t["id"],
        "course_id": t.get("courseId", ""),
        "title": t.get("title", ""),
        "description": t.get("description", ""),
        "due_date": t.get("dueDate", "") or None,
        "group_count": len(groups),
        "member_count": total_members,
        "created_at": t.get("createdAt", datetime.now(timezone.utc)),
    }


# ── Tasks ──
@router.get("/")
def list_group_tasks(cid: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """List all group tasks in a course (both roles)."""
    docs = (
        db.collection(models.GROUP_TASKS)
        .where(filter=FieldFilter("courseId", "==", cid))
        .get()
    )
    tasks = [models.doc_to_dict(d) for d in docs]
    tasks = [t for t in tasks if t]
    tasks.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)
    return [_task_summary(t, db) for t in tasks]


@router.post("/", status_code=201)
def create_group_task(
    cid: str,
    req: schemas.GroupTaskCreate,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Create a new group task inside a course."""
    tid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": cid,
        "title": req.title.strip() or "Untitled Task",
        "description": req.description or "",
        "dueDate": (req.due_date or "").strip() or None,
        "createdBy": user["id"],
        "createdAt": now,
    }
    db.collection(models.GROUP_TASKS).document(tid).set(data)
    data["id"] = tid
    return _task_summary(data, db)


@router.get("/{tid}")
def get_group_task(
    cid: str,
    tid: str,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Fetch a single group task with all its groups + members."""
    t = models.doc_to_dict(db.collection(models.GROUP_TASKS).document(tid).get())
    if not t or t.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group task not found")
    return {
        "id": t["id"],
        "course_id": t.get("courseId", ""),
        "title": t.get("title", ""),
        "description": t.get("description", ""),
        "due_date": t.get("dueDate", "") or None,
        "groups": _groups_for_task(tid, db),
        "created_at": t.get("createdAt", datetime.now(timezone.utc)),
    }


@router.delete("/{tid}")
def delete_group_task(
    cid: str,
    tid: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Delete a task and all its groups."""
    t_doc = db.collection(models.GROUP_TASKS).document(tid).get()
    t = models.doc_to_dict(t_doc)
    if not t or t.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group task not found")
    # Cascade-delete groups under this task
    for d in db.collection(models.COURSE_GROUPS).where(
        filter=FieldFilter("taskId", "==", tid)
    ).get():
        d.reference.delete()
    db.collection(models.GROUP_TASKS).document(tid).delete()
    return {"ok": True}


# ── Groups within a task ──
@router.post("/{tid}/groups", status_code=201)
def create_group_in_task(
    cid: str,
    tid: str,
    req: schemas.GroupInTaskCreate,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Create a group inside a group task."""
    t = models.doc_to_dict(db.collection(models.GROUP_TASKS).document(tid).get())
    if not t or t.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group task not found")
    gid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": cid,
        "taskId": tid,
        "name": req.name.strip() or "Group",
        "description": req.description or "",
        "memberIds": [],
        "createdAt": now,
    }
    db.collection(models.COURSE_GROUPS).document(gid).set(data)
    return {
        "id": gid,
        "task_id": tid,
        "name": data["name"],
        "description": data["description"],
        "members": [],
        "created_at": now,
    }


@router.delete("/{tid}/groups/{gid}")
def delete_group_in_task(
    cid: str,
    tid: str,
    gid: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    g = models.doc_to_dict(db.collection(models.COURSE_GROUPS).document(gid).get())
    if not g or g.get("taskId") != tid or g.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group not found")
    db.collection(models.COURSE_GROUPS).document(gid).delete()
    return {"ok": True}


@router.post("/{tid}/groups/{gid}/members")
def add_members_in_task(
    cid: str,
    tid: str,
    gid: str,
    req: schemas.GroupInTaskAddMembers,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Add students to a group. Each student can be in at most one group per task —
    existing memberships within this task are automatically cleared before adding."""
    from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove

    doc_ref = db.collection(models.COURSE_GROUPS).document(gid)
    g = models.doc_to_dict(doc_ref.get())
    if not g or g.get("taskId") != tid or g.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group not found")

    # Remove requested students from other groups in the same task first
    other_docs = (
        db.collection(models.COURSE_GROUPS)
        .where(filter=FieldFilter("taskId", "==", tid))
        .get()
    )
    for d in other_docs:
        if d.id == gid:
            continue
        og = models.doc_to_dict(d)
        if not og:
            continue
        overlap = [s for s in req.student_ids if s in og.get("memberIds", [])]
        if overlap:
            d.reference.update({"memberIds": ArrayRemove(overlap)})

    doc_ref.update({"memberIds": ArrayUnion(req.student_ids)})
    return {"ok": True}


@router.delete("/{tid}/groups/{gid}/members/{sid}")
def remove_member_in_task(
    cid: str,
    tid: str,
    gid: str,
    sid: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    from google.cloud.firestore_v1 import ArrayRemove

    doc_ref = db.collection(models.COURSE_GROUPS).document(gid)
    g = models.doc_to_dict(doc_ref.get())
    if not g or g.get("taskId") != tid or g.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group not found")
    doc_ref.update({"memberIds": ArrayRemove([sid])})
    return {"ok": True}


# ── Auto-assign: scoped to this task only ──
@router.post("/{tid}/auto-assign")
def auto_assign_groups_in_task(
    cid: str,
    tid: str,
    group_count: int = 4,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Randomly distribute enrolled students into N groups under this task.
    Replaces any existing groups within this task (other tasks are untouched)."""
    import random

    t = models.doc_to_dict(db.collection(models.GROUP_TASKS).document(tid).get())
    if not t or t.get("courseId") != cid:
        raise HTTPException(status_code=404, detail="Group task not found")

    course = models.doc_to_dict(db.collection(models.COURSES).document(cid).get())
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    student_ids = list(course.get("enrolledStudents", []))
    if not student_ids:
        raise HTTPException(status_code=400, detail="No students enrolled")

    # Clear existing groups for this task
    for d in db.collection(models.COURSE_GROUPS).where(
        filter=FieldFilter("taskId", "==", tid)
    ).get():
        d.reference.delete()

    random.shuffle(student_ids)
    group_count = max(1, min(group_count, len(student_ids)))
    now = datetime.now(timezone.utc)

    groups = []
    for i in range(group_count):
        gid = models.gen_id()
        data = {
            "courseId": cid,
            "taskId": tid,
            "name": f"Group {i + 1}",
            "description": "",
            "memberIds": [],
            "createdAt": now,
        }
        db.collection(models.COURSE_GROUPS).document(gid).set(data)
        data["id"] = gid
        groups.append(data)

    from google.cloud.firestore_v1 import ArrayUnion
    for idx, sid in enumerate(student_ids):
        g = groups[idx % group_count]
        db.collection(models.COURSE_GROUPS).document(g["id"]).update(
            {"memberIds": ArrayUnion([sid])}
        )
        g["memberIds"].append(sid)

    return _groups_for_task(tid, db)
