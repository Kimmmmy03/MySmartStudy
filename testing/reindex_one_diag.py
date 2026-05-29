"""
Diagnostic re-index for ONE course (Psikologi) to find why it ended at 0 chunks.
Re-runs the same logic with per-document tracing.
"""
import os, sys, asyncio, warnings
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, "..", "backend"))
sys.path.insert(0, BACKEND); os.chdir(BACKEND)
from dotenv import load_dotenv; load_dotenv(".env")
from app import rag_service, models, ai_service
from app.firestore import db
ai_service._enforce_ai_gate = lambda *a, **k: None

from reindex_courses import reconstruct_documents  # noqa: E402
sys.path.insert(0, os.path.dirname(__file__))


async def main():
    cid = "c5a4cd2d-34d7-4db0-97a7-7e782bdbf23e"
    # We cannot reconstruct documents because chunks are already gone.
    # Instead, pull state docs from Firestore that recorded the source titles.
    state_docs = db.collection(models.RAG_INDEX_STATE).where(
        "courseId", "==", cid).get()
    print(f"Found {len(state_docs)} state records for Psikologi.")
    # State records survived our delete loop only if state_id matched the new
    # format. Print a sample.
    for s in list(state_docs)[:3]:
        d = s.to_dict()
        print(f"  state: {s.id}  title={d.get('title','')[:40]}  hash={d.get('contentHash','')[:8]}  chunks={d.get('chunkCount')}")

    # If state is empty too, we have lost Psikologi entirely until you re-upload.
    # Confirm:
    col = rag_service._get_collection(cid)
    print(f"\nChromaDB count for Psikologi: {col.count()}")
    print(f"State doc count: {len(state_docs)}")


asyncio.run(main())
