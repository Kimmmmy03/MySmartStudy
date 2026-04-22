"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Globe, BookOpen, Bot, FileText, Loader2 } from "lucide-react";
import { aiPlagiarismApi, PlagiarismReport, PlagiarismSource } from "@/lib/api";

interface AiPlagiarismReportProps {
  submissionId: string;
}

const sourceIcon = (type: string) => {
  switch (type) {
    case "ai_generated": return <Bot className="w-3.5 h-3.5" />;
    case "web": return <Globe className="w-3.5 h-3.5" />;
    case "book": return <BookOpen className="w-3.5 h-3.5" />;
    default: return <FileText className="w-3.5 h-3.5" />;
  }
};

const sourceLabel = (type: string) => {
  switch (type) {
    case "ai_generated": return "AI Generated";
    case "web": return "Web Source";
    case "book": return "Book";
    case "article": return "Article";
    default: return type;
  }
};

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    percentage > 50 ? "text-red-400" :
    percentage > 20 ? "text-accent-amber" :
    "text-accent-emerald";
  const strokeColor =
    percentage > 50 ? "#f87171" :
    percentage > 20 ? "#f59e0b" :
    "#10b981";

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={strokeColor} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold ${color}`}>{percentage}%</span>
        <span className="text-[10px] text-dark-400">plagiarism</span>
      </div>
    </div>
  );
}

export default function AiPlagiarismReport({ submissionId }: AiPlagiarismReportProps) {
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiPlagiarismApi.analyze(submissionId);
      setReport(result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze submission");
    } finally {
      setLoading(false);
    }
  };

  if (!report && !loading) {
    return (
      <div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-colors border border-accent-cyan/20"
        >
          <Shield className="w-3.5 h-3.5" />
          AI Plagiarism Check
        </button>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-dark-800/50 border border-white/10 rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-accent-cyan animate-spin" />
        <div>
          <p className="text-sm text-white">Analyzing submission...</p>
          <p className="text-xs text-dark-400">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="bg-dark-800/50 border border-white/10 rounded-xl p-4 space-y-4 mt-2"
      >
        {/* Header with circular progress */}
        <div className="flex items-center gap-4">
          <CircularProgress percentage={report.plagiarism_percentage} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-accent-cyan" />
              <h4 className="text-sm font-semibold text-white">AI Plagiarism Report</h4>
            </div>
            <p className="text-xs text-dark-400">
              Analyzed at {new Date(report.analyzed_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Source breakdown */}
        {report.sources.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-dark-300 uppercase tracking-wide">Sources</p>
            {report.sources.map((source: PlagiarismSource, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-dark-300">{sourceIcon(source.type)}</span>
                  <span className="text-xs font-medium text-white">{sourceLabel(source.type)}</span>
                  <div className="flex-1 mx-2">
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          source.confidence > 0.7 ? "bg-red-400" :
                          source.confidence > 0.4 ? "bg-accent-amber" :
                          "bg-accent-emerald"
                        }`}
                        style={{ width: `${source.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-dark-400">{Math.round(source.confidence * 100)}%</span>
                </div>
                {source.evidence && (
                  <p className="text-xs text-dark-400 italic pl-5 border-l border-white/5">
                    {source.evidence}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Summary */}
        {report.summary && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-xs text-dark-300">{report.summary}</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
