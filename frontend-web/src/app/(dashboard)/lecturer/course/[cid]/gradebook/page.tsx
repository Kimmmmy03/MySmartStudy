"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { gradebookApi, LecturerGradebookRow, StudentReport } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Download, TrendingUp, Users, Award, UserCheck, Activity, Star, Eye, Settings } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

function gradeColor(pct: number) {
  if (pct >= 80) return "text-accent-emerald bg-accent-emerald/10";
  if (pct >= 60) return "text-accent-blue bg-accent-blue/10";
  if (pct >= 50) return "text-accent-amber bg-accent-amber/10";
  return "text-red-400 bg-red-500/10";
}

export default function LecturerGradebookPage() {
  const { cid } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<LecturerGradebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aWeight, setAWeight] = useState(60);
  const [qWeight, setQWeight] = useState(40);

  useEffect(() => {
    if (!cid) return;
    gradebookApi.course(cid as string).then(setRows).finally(() => setLoading(false));
    gradebookApi.getSettings(cid as string).then(s => { setAWeight(s.assignment_weight); setQWeight(s.quiz_weight); }).catch(() => {});
  }, [cid]);

  // Get all unique item titles across all students
  const allItems = rows.length > 0 ? rows[0].entries : [];
  const classAvg = rows.length > 0
    ? rows.filter(r => r.average != null).reduce((s, r) => s + (r.average || 0), 0) / rows.filter(r => r.average != null).length
    : null;

  const openReport = async (studentId: string) => {
    if (!cid) return;
    setReportLoading(true);
    try {
      const r = await gradebookApi.studentReport(studentId, cid as string);
      setReport(r);
    } catch { /* silent */ }
    finally { setReportLoading(false); }
  };

  const handleSaveWeights = async () => {
    if (!cid) return;
    await gradebookApi.updateSettings(cid as string, aWeight, qWeight);
    // Refresh gradebook with new weights
    const updated = await gradebookApi.course(cid as string);
    setRows(updated);
    setShowSettings(false);
  };

  const handleExport = () => {
    if (!cid) return;
    const url = gradebookApi.exportCsv(cid as string);
    window.open(url, "_blank");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Gradebook</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-white/10 text-dark-300 hover:text-white hover:bg-white/5 rounded-lg">
            <Settings className="w-4 h-4" /> Weights
          </button>
          <button onClick={handleExport}
            className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <span className="relative z-10 flex items-center gap-2"><Download className="w-4 h-4" /> Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
            <Users className="w-4 h-4" /> Students
          </div>
          <p className="text-2xl font-bold text-white">{rows.length}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
            <TrendingUp className="w-4 h-4" /> Class Average
          </div>
          <p className={clsx("text-2xl font-bold",
            classAvg !== null ? (classAvg >= 60 ? "text-accent-emerald" : "text-accent-amber") : "text-dark-400"
          )}>
            {classAvg !== null ? `${classAvg.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-dark-400 text-xs mb-2">
            <Award className="w-4 h-4" /> Items
          </div>
          <p className="text-2xl font-bold text-white">{allItems.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3">
                    <motion.div className="h-3 w-20 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
                  </th>
                  {[0, 1, 2].map((i) => (
                    <th key={i} className="text-center px-4 py-3">
                      <motion.div className="h-3 w-16 rounded-md bg-white/5 mx-auto" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }} />
                    </th>
                  ))}
                  <th className="text-center px-4 py-3">
                    <motion.div className="h-3 w-16 rounded-md bg-white/5 mx-auto" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((row) => (
                  <tr key={row} className="border-b border-white/3">
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <motion.div className="h-3 w-28 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: row * 0.1 }} />
                        <motion.div className="h-2.5 w-36 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: row * 0.1 + 0.05 }} />
                      </div>
                    </td>
                    {[0, 1, 2].map((col) => (
                      <td key={col} className="px-4 py-3 text-center">
                        <motion.div className="h-5 w-12 rounded-lg bg-white/5 mx-auto" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: row * 0.1 + col * 0.08 }} />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <motion.div className="h-5 w-12 rounded-lg bg-white/5 mx-auto" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: row * 0.1 + 0.25 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No students enrolled.</p>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-dark-300 font-medium sticky left-0 bg-dark-800 z-10">Student</th>
                  {allItems.map((item, i) => (
                    <th key={i} className="text-center px-4 py-3 text-dark-300 font-medium whitespace-nowrap">
                      <div className="text-xs">{item.title}</div>
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-block",
                        item.item_type === "quiz" ? "bg-accent-purple/10 text-accent-purple" : "bg-accent-blue/10 text-accent-blue"
                      )}>
                        {item.item_type}
                      </span>
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-dark-300 font-medium">Average</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student_id} className="border-b border-white/3 hover:bg-white/3">
                    <td className="px-4 py-3 sticky left-0 bg-dark-800 z-10">
                      <button onClick={() => openReport(row.student_id)} className="text-left hover:text-accent-blue transition-colors group flex items-center gap-3">
                        <UserAvatar name={row.student_name} photoUrl={row.student_photo_url} size={32} role="student" />
                        <div className="min-w-0">
                          <p className="text-dark-100 font-medium text-sm group-hover:text-accent-blue flex items-center gap-1 truncate">
                            {row.student_name} <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />
                          </p>
                          <p className="text-dark-400 text-xs truncate">{row.student_email}</p>
                        </div>
                      </button>
                    </td>
                    {row.entries.map((entry, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {entry.percentage != null ? (
                          <span className={clsx("px-2 py-0.5 rounded-lg text-xs font-bold", gradeColor(entry.percentage))}>
                            {entry.percentage}%
                          </span>
                        ) : entry.submitted_at ? (
                          <span className="text-dark-400 text-xs">Pending</span>
                        ) : (
                          <span className="text-dark-500 text-xs">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      {row.average != null ? (
                        <span className={clsx("px-2.5 py-1 rounded-lg text-xs font-bold", gradeColor(row.average))}>
                          {row.average}%
                        </span>
                      ) : (
                        <span className="text-dark-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Grade Weight Settings Modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Grade Weight Settings">
        <div className="space-y-4">
          <p className="text-sm text-dark-300">Configure how assignments and quizzes contribute to the final course grade.</p>
          <div>
            <label className="flex items-center justify-between text-sm text-dark-200 mb-1">
              <span>Assignment Weight</span>
              <span className="text-accent-blue font-bold">{aWeight}%</span>
            </label>
            <input type="range" min={0} max={100} value={aWeight}
              onChange={e => { setAWeight(Number(e.target.value)); setQWeight(100 - Number(e.target.value)); }}
              className="w-full accent-accent-blue" />
          </div>
          <div>
            <label className="flex items-center justify-between text-sm text-dark-200 mb-1">
              <span>Quiz Weight</span>
              <span className="text-accent-purple font-bold">{qWeight}%</span>
            </label>
            <input type="range" min={0} max={100} value={qWeight}
              onChange={e => { setQWeight(Number(e.target.value)); setAWeight(100 - Number(e.target.value)); }}
              className="w-full accent-accent-purple" />
          </div>
          <div className="text-xs text-dark-400 text-center">Total: {aWeight + qWeight}%</div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleSaveWeights} className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm">
              <span className="relative z-10">Save Weights</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Student Report Modal */}
      <Modal open={!!report || reportLoading} onClose={() => setReport(null)} title={`Student Report — ${report?.student.name || ""}`} maxWidth="max-w-2xl">
        {reportLoading ? (
          <p className="text-dark-400 text-sm text-center py-6">Loading report...</p>
        ) : report && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Student Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-accent-purple/20 flex items-center justify-center text-lg font-bold text-accent-purple">
                {report.student.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{report.student.name}</p>
                <p className="text-xs text-dark-400">{report.student.email}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-accent-amber">{report.student.points} pts</span>
                  <span className="text-xs text-accent-pink">{report.student.streak} day streak</span>
                  <span className="text-xs text-dark-400">{report.student.badges.length} badges</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="glass-card p-3 text-center">
                <TrendingUp className="w-4 h-4 text-accent-blue mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{report.gradebook?.average != null ? `${report.gradebook.average}%` : "—"}</p>
                <p className="text-[10px] text-dark-400">Grade Avg</p>
              </div>
              <div className="glass-card p-3 text-center">
                <UserCheck className="w-4 h-4 text-accent-emerald mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{report.attendance.percentage}%</p>
                <p className="text-[10px] text-dark-400">Attendance</p>
              </div>
              <div className="glass-card p-3 text-center">
                <Activity className="w-4 h-4 text-accent-cyan mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{report.activity_count}</p>
                <p className="text-[10px] text-dark-400">Activities</p>
              </div>
              <div className="glass-card p-3 text-center">
                <Star className="w-4 h-4 text-accent-amber mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{report.reviews_given}</p>
                <p className="text-[10px] text-dark-400">Reviews</p>
              </div>
            </div>

            {/* Attendance Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-dark-200 mb-2">Attendance</h4>
              <div className="flex gap-3 text-xs">
                <span className="text-accent-emerald">{report.attendance.present} present</span>
                <span className="text-accent-amber">{report.attendance.late} late</span>
                <span className="text-red-400">{report.attendance.absent} absent</span>
                <span className="text-dark-400">/ {report.attendance.total_sessions} sessions</span>
              </div>
            </div>

            {/* Grade Details */}
            {report.gradebook && report.gradebook.entries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-200 mb-2">Grades</h4>
                <div className="space-y-1">
                  {report.gradebook.entries.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full",
                          entry.item_type === "quiz" ? "bg-accent-purple/10 text-accent-purple" : "bg-accent-blue/10 text-accent-blue"
                        )}>{entry.item_type}</span>
                        <span className="text-sm text-dark-100">{entry.title}</span>
                      </div>
                      {entry.percentage != null ? (
                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-lg", gradeColor(entry.percentage))}>
                          {entry.percentage}%
                        </span>
                      ) : entry.submitted_at ? (
                        <span className="text-xs text-dark-400">Pending</span>
                      ) : (
                        <span className="text-xs text-dark-500">Not submitted</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
