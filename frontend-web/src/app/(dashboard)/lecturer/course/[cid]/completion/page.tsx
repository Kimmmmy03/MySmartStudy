"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { completionApi, StudentCompletion, CompletionSummary } from "@/lib/api";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, TrendingUp, Users, AlertTriangle, CheckCircle2, BookOpen, HelpCircle, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

function pctColor(pct: number) {
  if (pct >= 80) return "text-accent-emerald";
  if (pct >= 50) return "text-accent-amber";
  return "text-red-400";
}

function pctBg(pct: number) {
  if (pct >= 80) return "bg-accent-emerald";
  if (pct >= 50) return "bg-accent-amber";
  return "bg-red-400";
}

export default function CourseCompletionPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [students, setStudents] = useState<StudentCompletion[]>([]);
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cid) return;
    const courseId = cid as string;
    Promise.all([
      completionApi.course(courseId),
      completionApi.summary(courseId),
    ]).then(([s, sum]) => {
      setStudents(s);
      setSummary(sum);
    }).finally(() => setLoading(false));
  }, [cid]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Course Completion Tracking</h1>

      {loading ? (
        <p className="text-dark-400 text-center py-8">Loading completion data...</p>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                  <TrendingUp className="w-4 h-4" /> Avg Completion
                </div>
                <p className={clsx("text-2xl font-bold", pctColor(summary.avg_completion))}>
                  {summary.avg_completion}%
                </p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                  <CheckCircle2 className="w-4 h-4" /> Fully Complete
                </div>
                <p className="text-2xl font-bold text-accent-emerald">
                  {summary.fully_complete}<span className="text-sm text-dark-400">/{summary.total_students}</span>
                </p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                  <AlertTriangle className="w-4 h-4" /> At Risk (&lt;30%)
                </div>
                <p className="text-2xl font-bold text-red-400">{summary.at_risk}</p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
                  <Users className="w-4 h-4" /> Students
                </div>
                <p className="text-2xl font-bold text-white">{summary.total_students}</p>
              </div>
            </div>
          )}

          {/* Category Rates */}
          {summary && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-xs text-dark-400 mb-3">
                  <BookOpen className="w-4 h-4 text-accent-blue" /> Assignment Completion
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2 mb-1">
                  <div className={clsx("h-2 rounded-full", pctBg(summary.assignment_completion_rate))}
                    style={{ width: `${summary.assignment_completion_rate}%` }} />
                </div>
                <p className={clsx("text-sm font-bold", pctColor(summary.assignment_completion_rate))}>
                  {summary.assignment_completion_rate}%
                </p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-xs text-dark-400 mb-3">
                  <HelpCircle className="w-4 h-4 text-accent-cyan" /> Quiz Completion
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2 mb-1">
                  <div className={clsx("h-2 rounded-full", pctBg(summary.quiz_completion_rate))}
                    style={{ width: `${summary.quiz_completion_rate}%` }} />
                </div>
                <p className={clsx("text-sm font-bold", pctColor(summary.quiz_completion_rate))}>
                  {summary.quiz_completion_rate}%
                </p>
              </div>
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-xs text-dark-400 mb-3">
                  <FolderOpen className="w-4 h-4 text-accent-amber" /> Resource Completion
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2 mb-1">
                  <div className={clsx("h-2 rounded-full", pctBg(summary.resource_completion_rate))}
                    style={{ width: `${summary.resource_completion_rate}%` }} />
                </div>
                <p className={clsx("text-sm font-bold", pctColor(summary.resource_completion_rate))}>
                  {summary.resource_completion_rate}%
                </p>
              </div>
            </div>
          )}

          {/* Student Table */}
          {students.length === 0 ? (
            <p className="text-dark-400 text-center py-8">No students enrolled.</p>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-dark-300 font-medium">Student</th>
                      <th className="text-center px-4 py-3 text-dark-300 font-medium">Assignments</th>
                      <th className="text-center px-4 py-3 text-dark-300 font-medium">Quizzes</th>
                      <th className="text-center px-4 py-3 text-dark-300 font-medium">Resources</th>
                      <th className="text-center px-4 py-3 text-dark-300 font-medium">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.student_id} className="border-b border-white/3 hover:bg-white/3">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={s.student_name} photoUrl={s.student_photo_url} size={32} role="student" />
                            <div className="min-w-0">
                              <p className="text-dark-100 font-medium text-sm truncate">{s.student_name}</p>
                              <p className="text-dark-400 text-xs truncate">{s.student_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-dark-200 text-xs">
                            {s.submitted_assignments}/{s.total_assignments}
                          </span>
                          {s.total_assignments > 0 && (
                            <div className="w-16 mx-auto bg-dark-700 rounded-full h-1.5 mt-1">
                              <div className="bg-accent-blue h-1.5 rounded-full"
                                style={{ width: `${s.total_assignments > 0 ? (s.submitted_assignments / s.total_assignments * 100) : 0}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-dark-200 text-xs">
                            {s.completed_quizzes}/{s.total_quizzes}
                          </span>
                          {s.total_quizzes > 0 && (
                            <div className="w-16 mx-auto bg-dark-700 rounded-full h-1.5 mt-1">
                              <div className="bg-accent-cyan h-1.5 rounded-full"
                                style={{ width: `${s.total_quizzes > 0 ? (s.completed_quizzes / s.total_quizzes * 100) : 0}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-dark-200 text-xs">
                            {s.opened_resources}/{s.total_resources}
                          </span>
                          {s.total_resources > 0 && (
                            <div className="w-16 mx-auto bg-dark-700 rounded-full h-1.5 mt-1">
                              <div className="bg-accent-amber h-1.5 rounded-full"
                                style={{ width: `${s.total_resources > 0 ? (s.opened_resources / s.total_resources * 100) : 0}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={clsx("text-sm font-bold px-2 py-0.5 rounded-lg",
                            s.overall_percentage >= 80 ? "bg-accent-emerald/10 text-accent-emerald" :
                            s.overall_percentage >= 50 ? "bg-accent-amber/10 text-accent-amber" :
                            "bg-red-500/10 text-red-400"
                          )}>
                            {s.overall_percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
