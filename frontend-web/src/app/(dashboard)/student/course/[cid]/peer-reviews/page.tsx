"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, peerReviewApi, AssignmentOut, ReviewableSubmission, PeerReviewOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Star, Send, Eye } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

export default function PeerReviewsPage() {
  const { cid } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentOut[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentOut | null>(null);
  const [submissions, setSubmissions] = useState<ReviewableSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  // Review modal
  const [reviewTarget, setReviewTarget] = useState<ReviewableSubmission | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // View reviews
  const [viewTarget, setViewTarget] = useState<ReviewableSubmission | null>(null);
  const [reviews, setReviews] = useState<PeerReviewOut[]>([]);

  useEffect(() => {
    if (!cid) return;
    assignmentsApi.list(cid as string)
      .then(list => setAssignments(list.filter(a => a.peer_review_enabled)));
  }, [cid]);

  const loadSubmissions = async (a: AssignmentOut) => {
    setSelectedAssignment(a);
    setLoading(true);
    try {
      const subs = await peerReviewApi.getReviewable(a.id);
      setSubmissions(subs);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || rating === 0) return;
    setSubmitting(true);
    try {
      await peerReviewApi.submitReview(reviewTarget.submission_id, { rating, comment });
      setSubmissions(prev => prev.map(s =>
        s.submission_id === reviewTarget.submission_id
          ? { ...s, already_reviewed: true, review_count: s.review_count + 1 }
          : s
      ));
      setReviewTarget(null);
      setRating(0);
      setComment("");
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  const viewReviews = async (s: ReviewableSubmission) => {
    setViewTarget(s);
    try {
      const r = await peerReviewApi.getReviews(s.submission_id);
      setReviews(r);
    } catch { setReviews([]); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Peer Reviews</h1>

      {!selectedAssignment ? (
        <div className="space-y-3">
          {assignments.length === 0 ? (
            <p className="text-dark-400 text-center py-8">
              No assignments are open for peer review yet. Your lecturer enables this per assignment.
            </p>
          ) : (
            assignments.map(a => (
              <button key={a.id} onClick={() => loadSubmissions(a)}
                className="glass-card p-5 w-full text-left flex items-center justify-between hover:border-accent-pink/30 transition-colors">
                <div>
                  <h3 className="font-semibold text-white">{a.title}</h3>
                  <p className="text-sm text-dark-300 mt-1 line-clamp-1">{a.description}</p>
                </div>
                <span className="text-xs text-dark-400">Due: {new Date(a.deadline).toLocaleDateString()}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <button onClick={() => setSelectedAssignment(null)}
            className="text-sm text-accent-pink hover:text-white mb-4 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> All Assignments
          </button>
          <h2 className="text-lg font-semibold text-white mb-4">{selectedAssignment.title}</h2>

          {loading ? (
            <p className="text-dark-400 text-sm text-center py-8">Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p className="text-dark-400 text-sm text-center py-8">No submissions available for peer review.</p>
          ) : (
            <div className="space-y-3">
              {submissions.map(s => (
                <div key={s.submission_id} className="glass-card p-5 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <UserAvatar name={s.student_name} photoUrl={s.student_photo_url} size={40} role="student" />
                    <div className="min-w-0">
                    <p className="font-medium text-white truncate">{s.student_name}</p>
                    <p className="text-xs text-dark-400 mt-1">
                      {s.submission_type === "map" ? "Mind Map" : s.submission_type === "link" ? "External Link" : "File"}
                      {" — "}{new Date(s.submitted_at).toLocaleDateString()}
                    </p>
                    {s.comments && <p className="text-xs text-dark-300 italic mt-1">&quot;{s.comments}&quot;</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {s.avg_rating != null && (
                        <span className="flex items-center gap-1 text-xs text-accent-amber">
                          <Star className="w-3 h-3 fill-accent-amber" /> {s.avg_rating}/5
                        </span>
                      )}
                      <span className="text-xs text-dark-500">{s.review_count} review{s.review_count !== 1 ? "s" : ""}</span>
                    </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => viewReviews(s)}
                      className="p-2 hover:bg-accent-blue/10 rounded-lg text-dark-400 hover:text-accent-blue" title="View Reviews">
                      <Eye className="w-4 h-4" />
                    </button>
                    {!s.already_reviewed && (
                      <button onClick={() => { setReviewTarget(s); setRating(0); setComment(""); }}
                        className="px-3 py-1.5 text-xs bg-accent-pink/10 text-accent-pink border border-accent-pink/20 rounded-lg hover:bg-accent-pink/20">
                        Review
                      </button>
                    )}
                    {s.already_reviewed && (
                      <span className="px-3 py-1.5 text-xs text-accent-emerald bg-accent-emerald/10 rounded-lg">Reviewed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Submit Review Modal */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title={`Review — ${reviewTarget?.student_name || ""}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-dark-200 mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)}
                  className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    n <= rating ? "bg-accent-amber/20 text-accent-amber border border-accent-amber/30" : "bg-white/5 text-dark-500 border border-white/5 hover:border-accent-amber/20"
                  )}>
                  <Star className={clsx("w-5 h-5", n <= rating && "fill-accent-amber")} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-dark-200 mb-1">Comment</label>
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
              className="glass-input w-full" placeholder="Share your feedback on this submission..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setReviewTarget(null)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleSubmitReview} disabled={rating === 0 || submitting}
              className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              <span className="relative z-10 flex items-center gap-1"><Send className="w-3 h-3" /> Submit Review</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* View Reviews Modal */}
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title={`Reviews — ${viewTarget?.student_name || ""}`}>
        {reviews.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-6">No reviews yet.</p>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {reviews.map(r => (
              <div key={r.id} className="p-3 rounded-xl border border-white/5 bg-white/3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar name={r.reviewer_name} photoUrl={r.reviewer_photo_url} size={28} role="student" />
                    <p className="text-sm font-medium text-white truncate">{r.reviewer_name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={clsx("w-3 h-3", i < r.rating ? "fill-accent-amber text-accent-amber" : "text-dark-600")} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-xs text-dark-300 mt-1">{r.comment}</p>}
                <p className="text-xs text-dark-500 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
