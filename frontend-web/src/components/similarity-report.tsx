"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, FileText } from "lucide-react";
import { assignmentsApi } from "@/lib/api";

interface SimilarityPair {
  student_a: string;
  student_b: string;
  similarity: number;
  student_a_name: string;
  student_b_name: string;
}

interface SimilarityReportProps {
  assignmentId: string;
}

export default function SimilarityReport({ assignmentId }: SimilarityReportProps) {
  const [pairs, setPairs] = useState<SimilarityPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    assignmentsApi
      .similarityReport(assignmentId)
      .then(setPairs)
      .catch(() => setPairs([]))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  if (loading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <FileText className="w-12 h-12 text-dark-400 mx-auto mb-3" />
        <p className="text-dark-300">No significant similarities found.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-accent-amber" />
        <span className="text-sm font-semibold text-white">Flagged Pairs</span>
        <span className="text-xs text-dark-400 ml-auto">{pairs.length} pair{pairs.length !== 1 ? "s" : ""}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-3 text-dark-300 font-medium">Student A</th>
            <th className="text-left p-3 text-dark-300 font-medium">Student B</th>
            <th className="text-left p-3 text-dark-300 font-medium">Similarity</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <motion.tr
              key={`${p.student_a}-${p.student_b}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="border-b border-white/5"
            >
              <td className="p-3 text-white">{p.student_a_name}</td>
              <td className="p-3 text-white">{p.student_b_name}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p.similarity > 0.8 ? "bg-red-500" : p.similarity > 0.6 ? "bg-accent-amber" : "bg-emerald-500"
                      }`}
                      style={{ width: `${p.similarity * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    p.similarity > 0.8 ? "text-red-400" : p.similarity > 0.6 ? "text-accent-amber" : "text-emerald-400"
                  }`}>
                    {Math.round(p.similarity * 100)}%
                  </span>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
