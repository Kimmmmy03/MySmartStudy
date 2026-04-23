from fastapi import APIRouter, Depends, HTTPException
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from .notifications import create_notification
from datetime import datetime, timezone
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{course_id}/announcements", tags=["Announcements"])


def _ann_out(a: dict, photo_url: str | None = None) -> schemas.AnnouncementOut:
    return schemas.AnnouncementOut(
        id=a["id"],
        course_id=a.get("courseId", ""),
        title=a.get("title", ""),
        content=a.get("content", ""),
        sender_name=a.get("senderName", ""),
        sender_id=a.get("senderId", ""),
        sender_photo_url=photo_url if photo_url is not None else a.get("senderPhotoUrl"),
        created_at=a.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/", response_model=list[schemas.AnnouncementOut])
def get_announcements(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    docs = (
        db.collection(models.ANNOUNCEMENTS)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .order_by("createdAt", direction="DESCENDING")
        .get()
    )
    items = [models.doc_to_dict(d) for d in docs]
    photo_map = models.get_user_photo_urls(db, [i.get("senderId") for i in items])
    return [_ann_out(i, photo_map.get(i.get("senderId"))) for i in items]


@router.post("/", response_model=schemas.AnnouncementOut, status_code=201)
def create_announcement(course_id: str, req: schemas.AnnouncementCreate, user: dict = Depends(get_current_user), db=Depends(get_db)):
    ann_id = models.gen_id()
    now = datetime.now(timezone.utc)
    photo_url = models.get_user_photo_url(db, user["id"])
    data = {
        "courseId": course_id,
        "title": req.title,
        "content": req.content,
        "senderName": user.get("displayName", ""),
        "senderId": user["id"],
        "senderPhotoUrl": photo_url,
        "createdAt": now,
    }
    db.collection(models.ANNOUNCEMENTS).document(ann_id).set(data)
    data["id"] = ann_id

    # Notify enrolled students
    try:
        c_doc = db.collection(models.COURSES).document(course_id).get()
        c = models.doc_to_dict(c_doc) or {}
        course_name = c.get("courseName", "")
        link = f"/student/course/{course_id}/announcements"
        # Trim the message preview to one-line
        preview = (req.content or "").strip().replace("\n", " ")
        if len(preview) > 160:
            preview = preview[:157] + "..."
        for sid in c.get("enrolledStudents", []) or []:
            if sid == user["id"]:
                continue
            create_notification(
                db,
                user_id=sid,
                title=f"{course_name}: {req.title}",
                message=preview or req.title,
                notification_type="announcement",
                link=link,
            )
    except Exception:
        pass

    return _ann_out(data, photo_url)


@router.delete("/{ann_id}")
def delete_announcement(course_id: str, ann_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    doc = db.collection(models.ANNOUNCEMENTS).document(ann_id).get()
    a = models.doc_to_dict(doc)
    if not a or a.get("courseId") != course_id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.collection(models.ANNOUNCEMENTS).document(ann_id).delete()
    return {"ok": True}
