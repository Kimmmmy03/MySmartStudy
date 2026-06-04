"""TF-IDF + cosine similarity for plagiarism detection across all submission types."""
from . import models
from google.cloud.firestore_v1.base_query import FieldFilter
from datetime import datetime, timezone
import os

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    _HAS_SKLEARN = True
except ImportError:
    _HAS_SKLEARN = False


def _extract_text_from_file(file_path: str) -> str:
    """Extract readable text from a submitted file (PDF or plain text)."""
    if not file_path or not os.path.exists(file_path):
        return ""
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    if ext == "pdf":
        try:
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                return " ".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    elif ext in ("txt", "md", "csv"):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""
    return ""


def _extract_submission_text(db, submission: dict) -> str:
    """Extract comparable text from any submission type."""
    sub_type = submission.get("submissionType", "")
    text_parts = []

    # Map-based submission — use nodesText
    map_id = submission.get("mapId")
    if map_id:
        m_doc = db.collection(models.MAPS).document(map_id).get()
        m = models.doc_to_dict(m_doc)
        if m:
            text_parts.append(m.get("nodesText", ""))

    # File-based submission — extract from uploaded file
    file_url = submission.get("fileUrl", "")
    if file_url:
        # fileUrl is like /uploads/submissions/cid/aid/uid/filename
        file_path = file_url.lstrip("/")
        text_parts.append(_extract_text_from_file(file_path))

    # Comments / text content
    comments = submission.get("comments", "")
    if comments:
        text_parts.append(comments)

    # External link — include URL as minimal text
    ext_link = submission.get("externalLink", "")
    if ext_link:
        text_parts.append(ext_link)

    return " ".join(t for t in text_parts if t).strip()


def compute_similarity_report(db, assignment_id: str, threshold: float = 0.5) -> list[dict]:
    """Compare all submissions for an assignment using TF-IDF cosine similarity on map node text.
    Returns list of flagged pairs above threshold.
    """
    if not _HAS_SKLEARN:
        return []

    subs = db.collection(models.SUBMISSIONS).where(filter=FieldFilter("assignmentId", "==", assignment_id)).get()
    submissions = [models.doc_to_dict(s) for s in subs]

    # Gather node text from submitted maps
    texts: list[str] = []
    metadata: list[dict] = []

    for s in submissions:
        if not s:
            continue
        map_id = s.get("mapId")
        if not map_id:
            continue
        m_doc = db.collection(models.MAPS).document(map_id).get()
        m = models.doc_to_dict(m_doc)
        if not m:
            continue
        node_text = m.get("nodesText", "")
        if len(node_text.strip()) < 10:
            continue
        texts.append(node_text)
        metadata.append({
            "student_id": s.get("studentId", ""),
            "student_name": s.get("studentName", ""),
        })

    if len(texts) < 2:
        return []

    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(texts)
    sim_matrix = cosine_similarity(tfidf_matrix)

    flagged = []
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            score = float(sim_matrix[i][j])
            if score >= threshold:
                flagged.append({
                    "student_a": metadata[i]["student_id"],
                    "student_a_name": metadata[i]["student_name"],
                    "student_b": metadata[j]["student_id"],
                    "student_b_name": metadata[j]["student_name"],
                    "similarity": round(score, 3),
                })

    return sorted(flagged, key=lambda x: x["similarity"], reverse=True)


def compute_full_plagiarism_report(db, assignment_id: str, threshold: float = 0.3) -> dict:
    """Generate a comprehensive plagiarism report for all submissions in an assignment.

    Fuses two complementary lexical signals across all submission types (maps,
    files, text): TF-IDF cosine similarity (shared vocabulary / paraphrase) and
    winnowing fingerprint containment (verbatim copied passages, reorder-robust).
    Flagged pairs carry the actual overlapping passages as evidence.
    Returns a full report with pairwise scores, per-student risk, and summary stats.
    """
    if not _HAS_SKLEARN:
        return {"error": "scikit-learn not installed"}

    # Fetch assignment info
    a_doc = db.collection(models.ASSIGNMENTS).document(assignment_id).get()
    assignment = models.doc_to_dict(a_doc)
    assignment_title = assignment.get("title", "Unknown") if assignment else "Unknown"

    # Fetch all submissions
    subs = db.collection(models.SUBMISSIONS).where(
        filter=FieldFilter("assignmentId", "==", assignment_id)
    ).get()
    submissions = [models.doc_to_dict(s) for s in subs]

    total_submissions = len(submissions)
    texts: list[str] = []
    metadata: list[dict] = []
    skipped: list[dict] = []

    for s in submissions:
        if not s:
            continue
        text = _extract_submission_text(db, s)
        if len(text.strip()) < 10:
            skipped.append({
                "student_id": s.get("studentId", ""),
                "student_name": s.get("studentName", ""),
                "reason": "Insufficient text content",
            })
            continue
        texts.append(text)
        metadata.append({
            "student_id": s.get("studentId", ""),
            "student_name": s.get("studentName", ""),
            "submission_type": s.get("submissionType", "unknown"),
            "submission_id": s.get("id", ""),
            "submitted_at": str(s.get("submittedAt", "")),
        })

    analyzed_count = len(texts)

    # Fusion weights: the final score blends a bag-of-words signal (TF-IDF
    # cosine) with a lexical-overlap signal (winnowing fingerprint containment).
    # The two are complementary — TF-IDF catches shared vocabulary/paraphrase,
    # winnowing catches verbatim copied passages and is reorder-robust — so a
    # fused score is harder to defeat than either alone. Weights are env-tunable.
    from . import winnowing
    w_tfidf = float(os.getenv("PLAGIARISM_TFIDF_WEIGHT", "0.5"))
    w_lex = float(os.getenv("PLAGIARISM_LEXICAL_WEIGHT", "0.5"))
    _wsum = (w_tfidf + w_lex) or 1.0
    w_tfidf, w_lex = w_tfidf / _wsum, w_lex / _wsum

    # Build similarity matrix
    flagged_pairs = []
    all_scores: dict[str, list[float]] = {}  # student_id -> list of combined scores

    if analyzed_count >= 2:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
        tfidf_matrix = vectorizer.fit_transform(texts)
        sim_matrix = cosine_similarity(tfidf_matrix)

        # Precompute winnowing fingerprints once per submission (O(n) instead
        # of recomputing inside every pair comparison).
        fingerprints = [winnowing.fingerprint(t) for t in texts]

        # Initialize score tracking for each student
        for m in metadata:
            all_scores[m["student_id"]] = []

        for i in range(analyzed_count):
            for j in range(i + 1, analyzed_count):
                tfidf_score = float(sim_matrix[i][j])

                fp_a, fp_b = fingerprints[i], fingerprints[j]
                if fp_a and fp_b:
                    inter = len(fp_a & fp_b)
                    lexical_score = inter / min(len(fp_a), len(fp_b))
                else:
                    lexical_score = 0.0

                combined = w_tfidf * tfidf_score + w_lex * lexical_score

                # Track combined scores for per-student risk calculation
                all_scores[metadata[i]["student_id"]].append(combined)
                all_scores[metadata[j]["student_id"]].append(combined)

                if combined >= threshold:
                    severity = "high" if combined >= 0.8 else "medium" if combined >= 0.6 else "low"
                    # Extract the actual overlapping passages (evidence) only
                    # for pairs we're flagging — the full k-gram pass is the
                    # expensive step, so we skip it for the cleared majority.
                    ev = winnowing.compare(texts[i], texts[j])
                    flagged_pairs.append({
                        "student_a_id": metadata[i]["student_id"],
                        "student_a_name": metadata[i]["student_name"],
                        "student_a_type": metadata[i]["submission_type"],
                        "student_b_id": metadata[j]["student_id"],
                        "student_b_name": metadata[j]["student_name"],
                        "student_b_type": metadata[j]["submission_type"],
                        "similarity": round(combined, 4),
                        "combined_similarity": round(combined, 4),
                        "tfidf_similarity": round(tfidf_score, 4),
                        "lexical_similarity": round(lexical_score, 4),
                        "severity": severity,
                        "matched_spans": ev["matched_spans"],
                    })

    flagged_pairs.sort(key=lambda x: x["similarity"], reverse=True)

    # Per-student risk assessment
    student_risks = []
    for m in metadata:
        sid = m["student_id"]
        scores = all_scores.get(sid, [])
        if not scores:
            student_risks.append({
                "student_id": sid,
                "student_name": m["student_name"],
                "submission_type": m["submission_type"],
                "avg_similarity": 0,
                "max_similarity": 0,
                "flagged_pairs_count": 0,
                "risk_level": "clear",
            })
            continue
        avg_sim = sum(scores) / len(scores)
        max_sim = max(scores)
        flagged_count = sum(1 for p in flagged_pairs
                           if p["student_a_id"] == sid or p["student_b_id"] == sid)
        if max_sim >= 0.8:
            risk = "high"
        elif max_sim >= 0.6:
            risk = "medium"
        elif max_sim >= 0.3:
            risk = "low"
        else:
            risk = "clear"
        student_risks.append({
            "student_id": sid,
            "student_name": m["student_name"],
            "submission_type": m["submission_type"],
            "avg_similarity": round(avg_sim, 4),
            "max_similarity": round(max_sim, 4),
            "flagged_pairs_count": flagged_count,
            "risk_level": risk,
        })

    student_risks.sort(key=lambda x: x["max_similarity"], reverse=True)

    # Summary statistics
    all_pair_scores = [p["similarity"] for p in flagged_pairs]
    high_count = sum(1 for p in flagged_pairs if p["severity"] == "high")
    medium_count = sum(1 for p in flagged_pairs if p["severity"] == "medium")
    low_count = sum(1 for p in flagged_pairs if p["severity"] == "low")

    overall_stats = {
        "avg_similarity": round(sum(all_pair_scores) / len(all_pair_scores), 4) if all_pair_scores else 0,
        "max_similarity": round(max(all_pair_scores), 4) if all_pair_scores else 0,
        "flagged_count": len(flagged_pairs),
        "high_severity_count": high_count,
        "medium_severity_count": medium_count,
        "low_severity_count": low_count,
        "students_at_risk": sum(1 for r in student_risks if r["risk_level"] in ("high", "medium")),
    }

    return {
        "assignment_id": assignment_id,
        "assignment_title": assignment_title,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_submissions": total_submissions,
        "analyzed_submissions": analyzed_count,
        "skipped_submissions": len(skipped),
        "skipped_details": skipped,
        "flagged_pairs": flagged_pairs,
        "student_risks": student_risks,
        "overall_stats": overall_stats,
        "methodology": {
            "method": "TF-IDF cosine + winnowing fingerprint (fused)",
            "tfidf_weight": round(w_tfidf, 3),
            "lexical_weight": round(w_lex, 3),
            "threshold": threshold,
            "scope": "within this assignment",
        },
    }
