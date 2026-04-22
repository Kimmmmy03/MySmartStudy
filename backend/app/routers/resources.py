from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user, require_lecturer
from ..file_validation import validate_file, ALLOWED_EXTENSIONS
from datetime import datetime, timezone
from typing import Optional
import os
import json
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/api/courses/{course_id}/modules", tags=["Resources"])


def _item_out(i: dict) -> schemas.ModuleItemOut:
    """Build ModuleItemOut from a Firestore item doc dict."""
    return schemas.ModuleItemOut(
        id=i["id"],
        module_id=i.get("moduleId", ""),
        title=i.get("title", ""),
        type=i.get("type", "link"),
        url=i.get("url", ""),
        file_type=i.get("fileType"),
        file_path=i.get("filePath"),
        file_name=i.get("fileName"),
        file_size=i.get("fileSize"),
        unlock_date=i.get("unlockDate"),
        embed_url=i.get("embedUrl"),
        description=i.get("description"),
        created_at=i.get("createdAt", datetime.now(timezone.utc)),
    )


@router.get("/", response_model=list[schemas.ModuleOut])
def get_modules(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    mod_docs = (
        db.collection(models.COURSE_MODULES)
        .where(filter=FieldFilter("courseId", "==", course_id))
        .order_by("order")
        .get()
    )
    now = datetime.now(timezone.utc)
    is_student = user.get("role") == "student"

    result = []
    for md in mod_docs:
        m = models.doc_to_dict(md)
        item_docs = (
            db.collection(models.MODULE_ITEMS)
            .where(filter=FieldFilter("moduleId", "==", m["id"]))
            .order_by("createdAt")
            .get()
        )
        items = []
        for idoc in item_docs:
            i = models.doc_to_dict(idoc)
            # Filter locked items for students
            unlock = i.get("unlockDate")
            if is_student and unlock and unlock > now:
                continue
            items.append(_item_out(i))
        result.append(schemas.ModuleOut(
            id=m["id"], course_id=m.get("courseId", ""),
            title=m.get("title", ""), description=m.get("description", ""),
            items=items, created_at=m.get("createdAt", datetime.now(timezone.utc)),
        ))
    return result


@router.post("/", response_model=schemas.ModuleOut, status_code=201)
def create_module(course_id: str, req: schemas.ModuleCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    mid = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "courseId": course_id,
        "title": req.title,
        "description": req.description,
        "createdAt": now,
    }
    db.collection(models.COURSE_MODULES).document(mid).set(data)
    return schemas.ModuleOut(
        id=mid, course_id=course_id, title=req.title,
        description=req.description, items=[], created_at=now,
    )


@router.delete("/{module_id}")
def delete_module(course_id: str, module_id: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.COURSE_MODULES).document(module_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Module not found")
    for item in db.collection(models.MODULE_ITEMS).where(filter=FieldFilter("moduleId", "==", module_id)).get():
        item.reference.delete()
    db.collection(models.COURSE_MODULES).document(module_id).delete()
    return {"ok": True}


@router.post("/{module_id}/items", response_model=schemas.ModuleItemOut, status_code=201)
def add_item(course_id: str, module_id: str, req: schemas.ModuleItemCreate, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    item_id = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "moduleId": module_id,
        "title": req.title,
        "type": req.type,
        "url": req.url,
        "fileType": req.file_type or req.type,
        "createdAt": now,
    }
    if req.unlock_date:
        data["unlockDate"] = req.unlock_date
    db.collection(models.MODULE_ITEMS).document(item_id).set(data)
    return _item_out({"id": item_id, **data})


@router.post("/{module_id}/items/upload", response_model=schemas.ModuleItemOut, status_code=201)
async def upload_item(
    course_id: str,
    module_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    file_type: str = Form("pdf"),
    unlock_date: Optional[str] = Form(None),
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    content = await file.read()

    # Validate file
    is_valid, err_msg = validate_file(content, file.filename or "unknown")
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    # Store file
    upload_dir = os.path.join("uploads", "resources", course_id, module_id)
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"{models.gen_id()}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse unlock_date if provided
    parsed_unlock = None
    if unlock_date:
        try:
            parsed_unlock = datetime.fromisoformat(unlock_date)
        except ValueError:
            pass

    item_id = models.gen_id()
    now = datetime.now(timezone.utc)
    data = {
        "moduleId": module_id,
        "title": title,
        "type": file_type,
        "url": f"/{file_path.replace(os.sep, '/')}",
        "fileType": file_type,
        "filePath": file_path.replace(os.sep, "/"),
        "fileName": file.filename,
        "fileSize": len(content),
        "createdAt": now,
    }
    if parsed_unlock:
        data["unlockDate"] = parsed_unlock
    db.collection(models.MODULE_ITEMS).document(item_id).set(data)
    return _item_out({"id": item_id, **data})


@router.post("/{module_id}/items/{item_id}/attach-pdf", response_model=schemas.ModuleItemOut)
async def attach_pdf_to_item(
    course_id: str,
    module_id: str,
    item_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Attach a PDF to an existing (typically Canva/link) item so AI generation
    can extract text from it without relying on remote rendering."""
    doc_ref = db.collection(models.MODULE_ITEMS).document(item_id)
    doc = doc_ref.get()
    i = models.doc_to_dict(doc)
    if not i or i.get("moduleId") != module_id:
        raise HTTPException(status_code=404, detail="Item not found")

    content = await file.read()
    is_valid, err_msg = validate_file(content, file.filename or "unknown")
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    upload_dir = os.path.join("uploads", "resources", course_id, module_id)
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"{models.gen_id()}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(content)

    # Remove any previous attached file to avoid orphans.
    prev = i.get("filePath")
    if prev and os.path.exists(prev):
        try:
            os.remove(prev)
        except OSError:
            pass

    normalized = file_path.replace(os.sep, "/")
    doc_ref.update({
        "filePath": normalized,
        "fileName": file.filename,
        "fileSize": len(content),
    })
    i.update({"filePath": normalized, "fileName": file.filename, "fileSize": len(content)})
    return _item_out(i)


@router.delete("/{module_id}/items/{item_id}")
def delete_item(course_id: str, module_id: str, item_id: str, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    doc = db.collection(models.MODULE_ITEMS).document(item_id).get()
    i = models.doc_to_dict(doc)
    if not i or i.get("moduleId") != module_id:
        raise HTTPException(status_code=404, detail="Item not found")
    # Delete uploaded file if exists
    file_path = i.get("filePath")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    db.collection(models.MODULE_ITEMS).document(item_id).delete()
    return {"ok": True}


@router.patch("/reorder")
def reorder_modules(course_id: str, body: dict, user: dict = Depends(require_lecturer), db=Depends(get_db)):
    order_list = body.get("order", [])
    for idx, mid in enumerate(order_list):
        db.collection(models.COURSE_MODULES).document(mid).update({"order": idx})
    return {"ok": True}


# ── Progress tracking ──

@router.post("/{module_id}/items/{item_id}/track")
def track_progress(course_id: str, module_id: str, item_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Record that a student opened a resource."""
    uid = user["id"]
    # Check if already tracked
    existing = (
        db.collection(models.RESOURCE_PROGRESS)
        .where(filter=FieldFilter("userId", "==", uid))
        .where(filter=FieldFilter("resourceId", "==", item_id))
        .limit(1)
        .get()
    )
    if len(list(existing)) > 0:
        return {"ok": True, "already_tracked": True}

    pid = models.gen_id()
    db.collection(models.RESOURCE_PROGRESS).document(pid).set({
        "userId": uid,
        "resourceId": item_id,
        "courseId": course_id,
        "openedAt": datetime.now(timezone.utc),
    })
    return {"ok": True, "already_tracked": False}


@router.get("/progress", response_model=list[schemas.ResourceProgressOut])
def get_progress(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get the current user's progress for all resources in a course."""
    docs = (
        db.collection(models.RESOURCE_PROGRESS)
        .where(filter=FieldFilter("userId", "==", user["id"]))
        .where(filter=FieldFilter("courseId", "==", course_id))
        .get()
    )
    result = []
    for d in docs:
        data = models.doc_to_dict(d)
        result.append(schemas.ResourceProgressOut(
            resource_id=data.get("resourceId", ""),
            opened_at=data.get("openedAt", datetime.now(timezone.utc)),
        ))
    return result


# ── Template clone ──

@router.post("/{module_id}/items/{item_id}/clone")
def clone_template(course_id: str, module_id: str, item_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Clone a map_template resource into the student's personal maps."""
    # Get the resource item
    doc = db.collection(models.MODULE_ITEMS).document(item_id).get()
    item = models.doc_to_dict(doc)
    if not item:
        raise HTTPException(status_code=404, detail="Resource not found")

    if item.get("fileType") != "map_template" and item.get("type") != "map_template":
        raise HTTPException(status_code=400, detail="Resource is not a map template")

    # The template URL should point to a map's graph_data or contain a share code
    template_url = item.get("url", "")
    graph_data = "{}"
    template_title = item.get("title", "Untitled Template")

    # If the URL is a map ID or share code, fetch the source map
    if template_url:
        # Try as map ID first
        source_doc = db.collection(models.MAPS).document(template_url).get()
        source = models.doc_to_dict(source_doc)
        if source:
            graph_data = source.get("graphData", "{}")
            template_title = f"{source.get('title', template_title)} (Template)"
        else:
            # Try as share code
            results = db.collection(models.MAPS).where(filter=FieldFilter("shareCode", "==", template_url)).limit(1).get()
            for r in results:
                source = models.doc_to_dict(r)
                if source:
                    graph_data = source.get("graphData", "{}")
                    template_title = f"{source.get('title', template_title)} (Template)"

    # Create a new map for the student
    new_map_id = models.gen_id()
    now = datetime.now(timezone.utc)
    db.collection(models.MAPS).document(new_map_id).set({
        "ownerId": user["id"],
        "ownerEmail": user.get("email", ""),
        "title": template_title,
        "graphData": graph_data,
        "graphFormat": "reactflow",
        "nodesText": "",
        "thumbnail": "",
        "shareCode": models.gen_code(),
        "collaborators": [],
        "lastModified": now,
    })

    return {"ok": True, "map_id": new_map_id, "title": template_title}
