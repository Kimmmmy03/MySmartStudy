"""
CLP (Course Learning Plan) — Router

All endpoints for the AI-powered Course Learning Plan generator.
Lecturer-only feature integrated into MySmartStudy.
"""

import uuid
import json
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse

from app import models, schemas
from app.firestore import get_db
from app.auth import get_current_user, require_lecturer
from app.services.clp.parser import parse_input_xlsx, parse_input_pdf, parse_with_ai
from app.services.clp.gemini_service import enrich_week
from app.services.clp.excel_generator import generate_single_excel, generate_combined_zip
from app.services.clp import storage

router = APIRouter(prefix="/api/clp", tags=["CLP"])


# ── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=schemas.CLPUploadResponse)
async def upload_input_file(
    file: UploadFile = File(...),
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Upload a syllabus file (.xlsx/.xls/.pdf) and extract metadata + weekly topics."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls", ".pdf")):
        raise HTTPException(status_code=400, detail="Please upload .xlsx or .pdf files only.")

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error reading file: {str(e)}")

    # Dedup check
    file_hash = storage.compute_file_hash(file_bytes)
    existing_session_id = storage.find_duplicate(db, file_hash)
    if existing_session_id:
        existing_draft = storage.get_draft(db, existing_session_id)
        if existing_draft and existing_draft.owner_id == user["id"]:
            return schemas.CLPUploadResponse(
                session_id=existing_session_id,
                metadata=existing_draft.metadata,
                weeks=existing_draft.weeks,
            )

    # Extraction
    try:
        try:
            metadata, weeks = await parse_with_ai(file_bytes, file.filename)
        except Exception as ai_err:
            print(f"[CLP Upload] AI extraction failed, falling back: {ai_err}")
            storage.store_failed_upload(
                db, file_bytes=file_bytes,
                filename=f"[AI_FAIL] {file.filename or 'unknown'}",
                error_msg=f"AI Parser Error: {str(ai_err)}",
                user_id=user["id"],
            )
            if file.filename.lower().endswith(".pdf"):
                metadata, weeks = parse_input_pdf(file_bytes)
            else:
                metadata, weeks = parse_input_xlsx(file_bytes)
    except Exception as e:
        storage.store_failed_upload(
            db, file_bytes=file_bytes,
            filename=f"[TOTAL_FAIL] {file.filename or 'unknown'}",
            error_msg=f"Total Parser Error: {str(e)}",
            user_id=user["id"],
        )
        raise HTTPException(status_code=422, detail=f"Error parsing file: {str(e)}")

    # Adaptive learning
    fields_found = [f for f in ["nama_kursus", "kod_kursus", "pensyarah", "semester"]
                    if getattr(metadata, f, None)]
    fingerprint = storage.compute_layout_fingerprint(
        file.filename, header_row=None,
        col_count=len(fields_found), row_count=len(weeks),
    )
    storage.save_extraction_pattern(db, fingerprint, {
        "fields_found": fields_found,
        "week_count": len(weeks),
    })

    # Create session
    session_id = str(uuid.uuid4())
    draft = schemas.CLPSessionDraft(
        session_id=session_id,
        owner_id=user["id"],
        metadata=metadata,
        weeks=weeks,
    )
    storage.save_draft(db, session_id, draft)
    storage.save_input_file(session_id, file_bytes)
    storage.register_file_hash(db, file_hash, session_id)

    return schemas.CLPUploadResponse(
        session_id=session_id,
        metadata=metadata,
        weeks=weeks,
    )


# ── Generate (SSE) ─────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_draft_stream(
    request: schemas.CLPGenerateRequest,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Stream AI enrichment progress per-week via SSE."""
    draft = storage.get_draft(db, request.session_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Session not found.")
    if draft.owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized.")

    # Apply user parameters
    draft.tarikh = request.tarikh
    draft.kumpulan_list = request.kumpulan_list

    if request.nama_kursus is not None:
        draft.metadata.nama_kursus = request.nama_kursus
    if request.kod_kursus is not None:
        draft.metadata.kod_kursus = request.kod_kursus
    if request.pensyarah is not None:
        draft.metadata.pensyarah = request.pensyarah

    if request.weeks:
        tarikh_map = {w.minggu: w.tarikh for w in request.weeks if w.tarikh}
        for week in draft.weeks:
            if week.minggu in tarikh_map:
                week.tarikh = tarikh_map[week.minggu]

    if request.selected_weeks:
        weeks_to_enrich = [w for w in draft.weeks if w.minggu in request.selected_weeks]
        weeks_to_skip = [w for w in draft.weeks if w.minggu not in request.selected_weeks]
    else:
        weeks_to_enrich = draft.weeks
        weeks_to_skip = []

    total = len(weeks_to_enrich)

    async def event_stream():
        try:
            enriched_weeks = []
            for i, week in enumerate(weeks_to_enrich):
                progress_data = json.dumps({
                    "current": i + 1,
                    "total": total,
                    "minggu": week.minggu,
                    "topik": week.topik,
                })
                yield f"event: progress\ndata: {progress_data}\n\n"

                result = await enrich_week(
                    week.topik, week.minggu,
                    nama_kursus=draft.metadata.nama_kursus,
                    program=draft.metadata.program,
                    detail_level=request.detail_level,
                )
                week_dict = week.model_dump()
                week_dict.update(result)
                enriched_weeks.append(schemas.CLPWeekData(**week_dict))

                if total > 1 and i < total - 1:
                    await asyncio.sleep(1)

            all_weeks = enriched_weeks + weeks_to_skip
            all_weeks.sort(key=lambda w: w.minggu)
            draft.weeks = all_weeks

            storage.save_draft(db, draft.session_id, draft)

            done_data = json.dumps(draft.model_dump(), default=str)
            yield f"event: done\ndata: {done_data}\n\n"

        except Exception as e:
            print(f"[CLP Generate Error] {e}")
            import traceback
            traceback.print_exc()
            error_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Drafts CRUD ─────────────────────────────────────────────────────────────

@router.get("/drafts")
def list_drafts(
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """List all CLP drafts for the current lecturer."""
    return storage.get_drafts_by_owner(db, user["id"])


@router.get("/drafts/{session_id}")
def get_session_draft(
    session_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Retrieve a saved draft by session ID."""
    draft = storage.get_draft(db, session_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Session not found.")
    if draft.owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized.")
    return draft


@router.put("/drafts/{session_id}")
def update_draft(
    session_id: str,
    request: schemas.CLPUpdateDraftRequest,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Update a draft with user edits."""
    draft = storage.get_draft(db, session_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Session not found.")
    if draft.owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized.")

    draft.weeks = request.weeks
    if request.tarikh is not None:
        draft.tarikh = request.tarikh
    if request.kumpulan_list is not None:
        draft.kumpulan_list = request.kumpulan_list

    storage.save_draft(db, session_id, draft)
    return draft


@router.delete("/drafts/{session_id}")
def delete_draft(
    session_id: str,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Delete a draft."""
    draft = storage.get_draft(db, session_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Session not found.")
    if draft.owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized.")

    storage.delete_draft(db, session_id)
    return {"ok": True}


# ── Download ────────────────────────────────────────────────────────────────

@router.post("/download")
def download_weeks(
    request: schemas.CLPDownloadRequest,
    user: dict = Depends(require_lecturer),
    db=Depends(get_db),
):
    """Generate Excel files for selected weeks."""
    draft = storage.get_draft(db, request.session_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Session not found.")
    if draft.owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized.")

    if not request.selected_weeks:
        raise HTTPException(status_code=400, detail="Please select at least one week.")

    download_format = getattr(request, "format", "zip") or "zip"

    try:
        if download_format == "xlsx":
            input_bytes = storage.get_input_file(request.session_id) if request.include_input else None
            excel_buffer = generate_single_excel(draft, request.selected_weeks, input_bytes=input_bytes)
            kod = draft.metadata.kod_kursus or "RPP"
            weeks_str = "_".join(str(w) for w in sorted(request.selected_weeks))
            filename = f"RPP_Mingguan_{kod} - Minggu {weeks_str}.xlsx"

            return StreamingResponse(
                excel_buffer,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        else:
            zip_buffer = generate_combined_zip(draft, request.selected_weeks)
            group_label = draft.kumpulan_list[0].nama if draft.kumpulan_list else "Output"
            num_groups = len(draft.kumpulan_list) if draft.kumpulan_list else 1
            filename = f"RPP_Mingguan_{group_label}{'_dan_lain' if num_groups > 1 else ''}.zip"

            return StreamingResponse(
                zip_buffer,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Template file not found on server.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating file: {str(e)}")
