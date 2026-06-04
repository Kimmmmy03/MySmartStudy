"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, CheckCircle, AlertTriangle, Quote, ShieldCheck } from "lucide-react";
import { aiGradingApi, GradeRecommendation } from "@/lib/api";

interface AiGradeRecommendationProps {
  submissionId: string;
  /** Called after the lecturer accepts the AI grade (review recorded server-side). */
  onApply?: (grade: number) => void;
}

function gradeColor(grade: number) {
  if (grade >= 80) return "text-accent-emerald";
  if (grade >= 60) return "text-accent-blue";
  if (grade >= 40) return "text-accent-amber";
  return "text-red-400";
}

function gradeBg(grade: number) {
  if (grade >= 80) return "bg-accent-emerald/10 border-accent-emerald/20";
  if (grade >= 60) return "bg-accent-blue/10 border-accent-blue/20";
  if (grade >= 40) return "bg-accent-amber/10 border-accent-amber/20";
  return "bg-red-500/10 border-red-500/20";
}

export default function AiGradeRecommendation({ submissionId, onApply }: AiGradeRecommendationProps) {
  const [recommendation, setRecommendation] = useState<GradeRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const handleRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiGradingApi.recommend(submissionId);
      setRecommendation(result);
      setAccepted(!!result.reviewed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get grade recommendation");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!recommendation) return;
    try {
      // Record the accept decision (human-in-the-loop audit + calibration pair).
      await aiGradingApi.review({
        submission_id: submissionId,
        ai_grade: recommendation.recommended_grade,
        final_grade: recommendation.recommended_grade,
        action: "accepted",
        apply: false, // let the grading form own the actual write
      });
      setAccepted(true);
    } catch { /* non-fatal — the grade form still applies it */ }
    onApply?.(recommendation.recommended_grade);
  };

  if (!recommendation && !loading) {
    return (
      <div>
        <button
          onClick={handleRecommend}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors border border-accent-purple/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Suggest Grade
        </button>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
        <div>
          <p className="text-sm text-white">Generating recommendation...</p>
          <p className="text-xs text-dark-400">Scoring each rubric criterion across multiple passes</p>
        </div>
      </div>
    );
  }

  if (!recommendation) return null;

  const rec = recommendation;
  const detail = rec.criteria_detail ?? [];
  const criterionEntries = detail.length > 0
    ? detail.map(d => ({ name: d.name, score: d.score, max: d.max_points, evidence: d.evidence, justification: d.justification }))
    : Object.entries(rec.criterion_scores || {}).map(([name, score]) => ({ name, score, max: 100, evidence: "", justification: "" }));
  const confidencePct = Math.round((rec.confidence ?? 0) * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="bg-dark-800/50 border border-white/10 rounded-xl p-4 space-y-4 mt-2"
      >
        {/* Advisory banner — recommendation, not a final grade */}
        <div className="flex items-start gap-2 rounded-lg bg-accent-amber/5 border border-accent-amber/20 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-accent-amber shrink-0 mt-0.5" />
          <p className="text-[11px] text-dark-300 leading-relaxed">
            AI recommendation for your review — <strong className="text-dark-100">not a final grade</strong>.
            Scores are per-criterion against the rubric; confirm or override before committing.
          </p>
        </div>

        {/* Header with grade + measured confidence */}
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 ${gradeBg(rec.recommended_grade)}`}>
            <span className={`text-2xl font-bold ${gradeColor(rec.recommended_grade)}`}>
              {rec.recommended_grade}
            </span>
            <span className="text-[10px] text-dark-400">/ 100</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <h4 className="text-sm font-semibold text-white">AI Grade Recommendation</h4>
            </div>
            {rec.method && <p className="text-[10px] text-dark-400 mb-1.5">{rec.method}</p>}
            {/* Measured confidence (agreement across samples) */}
            <div className="mt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-dark-400">
                  Confidence{rec.samples ? ` (agreement across ${rec.samples} passes)` : ""}
                </span>
                <span className="text-[10px] text-dark-300">
                  {confidencePct}%{rec.score_spread != null ? ` · ±${rec.score_spread}` : ""}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${confidencePct >= 75 ? "bg-accent-emerald" : confidencePct >= 60 ? "bg-accent-amber" : "bg-red-400"}`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Low-agreement warning */}
        {rec.needs_review && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-dark-300 leading-relaxed">
              <strong className="text-red-300">Low agreement between passes</strong> — the model was
              inconsistent on this submission. Manual grading strongly recommended.
            </p>
          </div>
        )}

        {/* Per-criterion breakdown with evidence */}
        {criterionEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-dark-300 uppercase tracking-wide">Criteria Breakdown</p>
            <div className="rounded-lg border border-white/5 overflow-hidden divide-y divide-white/5">
              {criterionEntries.map((c, i) => (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-3 py-2 text-xs bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-dark-200">{c.name}</span>
                    <span className="font-medium text-dark-100 tabular-nums">
                      {c.score}{c.max ? <span className="text-dark-500"> / {c.max}</span> : null}
                    </span>
                  </div>
                  {c.evidence ? (
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-dark-400 italic">
                      <Quote className="w-3 h-3 shrink-0 mt-0.5 text-dark-500" />
                      <span className="line-clamp-3">{c.evidence}</span>
                    </p>
                  ) : null}
                  {c.justification ? (
                    <p className="mt-0.5 text-[11px] text-dark-400">{c.justification}</p>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Justification */}
        {rec.justification && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-xs text-dark-300">{rec.justification}</p>
          </div>
        )}

        {/* Accept (records the human-in-the-loop decision) */}
        {onApply && (
          accepted ? (
            <div className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
              <ShieldCheck className="w-4 h-4" />
              Accepted — review the grade form, then save
            </div>
          ) : (
            <button
              onClick={handleAccept}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors border border-accent-purple/20"
            >
              <CheckCircle className="w-4 h-4" />
              Accept &amp; Pre-fill Grade
            </button>
          )
        )}
      </motion.div>
    </AnimatePresence>
  );
}
