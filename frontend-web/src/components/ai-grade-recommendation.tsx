"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";
import { aiGradingApi, GradeRecommendation } from "@/lib/api";

interface AiGradeRecommendationProps {
  submissionId: string;
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

  const handleRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiGradingApi.recommend(submissionId);
      setRecommendation(result);
    } catch (err: any) {
      setError(err.message || "Failed to get grade recommendation");
    } finally {
      setLoading(false);
    }
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
          <p className="text-xs text-dark-400">Analyzing submission quality</p>
        </div>
      </div>
    );
  }

  if (!recommendation) return null;

  const criterionEntries = Object.entries(recommendation.criterion_scores || {});

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="bg-dark-800/50 border border-white/10 rounded-xl p-4 space-y-4 mt-2"
      >
        {/* Header with grade */}
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 ${gradeBg(recommendation.recommended_grade)}`}>
            <span className={`text-2xl font-bold ${gradeColor(recommendation.recommended_grade)}`}>
              {recommendation.recommended_grade}
            </span>
            <span className="text-[10px] text-dark-400">/ 100</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <h4 className="text-sm font-semibold text-white">AI Grade Recommendation</h4>
            </div>
            {/* Confidence meter */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-dark-400">Confidence</span>
                <span className="text-[10px] text-dark-300">{Math.round(recommendation.confidence * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-purple transition-all duration-500"
                  style={{ width: `${recommendation.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Criterion scores table */}
        {criterionEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-dark-300 uppercase tracking-wide">Criteria Breakdown</p>
            <div className="rounded-lg border border-white/5 overflow-hidden">
              {criterionEntries.map(([criterion, score], i) => (
                <motion.div
                  key={criterion}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between px-3 py-2 text-xs border-b border-white/5 last:border-b-0 bg-white/[0.02]"
                >
                  <span className="text-dark-200">{criterion}</span>
                  <span className={`font-medium ${gradeColor(score)}`}>{score}%</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Justification */}
        {recommendation.justification && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-xs text-dark-300">{recommendation.justification}</p>
          </div>
        )}

        {/* Apply button */}
        {onApply && (
          <button
            onClick={() => onApply(recommendation.recommended_grade)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors border border-accent-purple/20"
          >
            <CheckCircle className="w-4 h-4" />
            Apply Recommendation
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
