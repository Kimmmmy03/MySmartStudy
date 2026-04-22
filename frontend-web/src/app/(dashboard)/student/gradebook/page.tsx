"use client";

import { useState, useEffect } from "react";
import { gradebookApi, CourseGradebook } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { BookOpen, TrendingUp, Award, FileText, HelpCircle, Loader2 } from "lucide-react";
import clsx from "clsx";

function gradeColor(pct: number) {
  if (pct >= 80) return "text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20";
  if (pct >= 60) return "text-accent-blue bg-accent-blue/10 border-accent-blue/20";
  if (pct >= 50) return "text-accent-amber bg-accent-amber/10 border-accent-amber/20";
  return "text-red-400 bg-red-500/10 border-red-500/20";
}

function gradeLetter(pct: number) {
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "F";
}

export default function GradebookPage() {
  const { user } = useAuth();
  const [gradebooks, setGradebooks] = useState<CourseGradebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    gradebookApi.my().then(setGradebooks).finally(() => setLoading(false));
  }, [user]);

  // Overall stats
  const allEntries = gradebooks.flatMap(g => g.entries);
  const gradedEntries = allEntries.filter(e => e.percentage != null);
  const overallAvg = gradedEntries.length > 0
    ? gradedEntries.reduce((s, e) => s + (e.percentage || 0), 0) / gradedEntries.length
    : null;
  const totalItems = allEntries.length;
  const completedItems = allEntries.filter(e => e.submitted_at).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">Gradebook</h1>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10"
        >
          <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
          <span className="text-sm text-dark-300">Fetching your grades across all courses...</span>
        </motion.div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          [{icon: TrendingUp, label: "Overall Average"}, {icon: BookOpen, label: "Courses"}, {icon: FileText, label: "Completed"}, {icon: Award, label: "Best Course"}].map(({icon: Icon, label}, i) => (
            <div key={label} className="glass-card p-4">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                <Icon className="w-4 h-4" /> {label}
              </div>
              <motion.div
                className="h-7 w-16 rounded-md bg-white/5 mt-1"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
              />
            </div>
          ))
        ) : (
          <>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                <TrendingUp className="w-4 h-4" /> Overall Average
              </div>
              <p className={clsx("text-2xl font-bold", overallAvg !== null ? (overallAvg >= 60 ? "text-accent-emerald" : "text-accent-amber") : "text-dark-400")}>
                {overallAvg !== null ? `${overallAvg.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                <BookOpen className="w-4 h-4" /> Courses
              </div>
              <p className="text-2xl font-bold text-white">{gradebooks.length}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                <FileText className="w-4 h-4" /> Completed
              </div>
              <p className="text-2xl font-bold text-white">{completedItems}/{totalItems}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                <Award className="w-4 h-4" /> Best Course
              </div>
              <p className="text-lg font-bold text-white truncate">
                {gradebooks.filter(g => g.average != null).sort((a, b) => (b.average || 0) - (a.average || 0))[0]?.course_code || "—"}
              </p>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 bg-white/3 flex items-center justify-between">
                <div className="space-y-2">
                  <motion.div
                    className="h-4 w-40 rounded-md bg-white/5"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  />
                  <motion.div
                    className="h-3 w-24 rounded-md bg-white/5"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }}
                  />
                </div>
                <motion.div
                  className="h-8 w-20 rounded-lg bg-white/5"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                />
              </div>
              <div className="px-5 py-3 space-y-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center justify-between">
                    <motion.div
                      className="h-3 w-32 rounded-md bg-white/5"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + j * 0.1 }}
                    />
                    <motion.div
                      className="h-3 w-16 rounded-md bg-white/5"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + j * 0.1 + 0.05 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : gradebooks.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No courses enrolled.</p>
      ) : (
        <div className="space-y-6">
          {gradebooks.map(gb => (
            <div key={gb.course_id} className="glass-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 bg-white/3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{gb.course_name}</h3>
                  <p className="text-xs text-dark-400">{gb.course_code}</p>
                </div>
                {gb.average !== null && (
                  <div className={clsx("px-3 py-1.5 rounded-lg text-sm font-bold border", gradeColor(gb.average))}>
                    {gradeLetter(gb.average)} ({gb.average}%)
                  </div>
                )}
              </div>
              {gb.entries.length === 0 ? (
                <p className="text-dark-400 text-sm text-center py-6">No graded items yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-5 py-3 text-dark-300 font-medium">Item</th>
                        <th className="text-center px-5 py-3 text-dark-300 font-medium">Type</th>
                        <th className="text-center px-5 py-3 text-dark-300 font-medium">Grade</th>
                        <th className="text-left px-5 py-3 text-dark-300 font-medium">Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gb.entries.map((e, i) => (
                        <tr key={i} className="border-b border-white/3">
                          <td className="px-5 py-3 text-dark-100">{e.title}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={clsx("text-xs px-2 py-0.5 rounded-full",
                              e.item_type === "quiz" ? "bg-accent-purple/10 text-accent-purple" : "bg-accent-blue/10 text-accent-blue"
                            )}>
                              {e.item_type === "quiz" ? "Quiz" : "Assignment"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {e.percentage != null ? (
                              <span className={clsx("px-2.5 py-1 rounded-lg text-xs font-bold border", gradeColor(e.percentage))}>
                                {gradeLetter(e.percentage)} ({e.percentage}%)
                              </span>
                            ) : e.submitted_at ? (
                              <span className="text-dark-400 text-xs">Pending</span>
                            ) : (
                              <span className="text-dark-500 text-xs">Not submitted</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-dark-300 text-xs max-w-[200px] truncate">
                            {e.feedback || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
