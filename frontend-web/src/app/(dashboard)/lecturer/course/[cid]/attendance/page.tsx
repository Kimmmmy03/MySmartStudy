"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { attendanceApi, AttendanceSession } from "@/lib/api";
import Modal from "@/components/ui/modal";
import {
  ArrowLeft, Plus, Trash2, CalendarDays, Users, CheckCircle,
  Clock, XCircle, ChevronRight, QrCode, ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export default function AttendancePage() {
  const { cid } = useParams();
  const router = useRouter();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Create session
  const [showCreate, setShowCreate] = useState(false);
  const defaultCreateForm = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const startHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endDt = new Date(now.getTime() + 60 * 60 * 1000);
    const endHHMM = `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`;
    return {
      date: new Date().toISOString().slice(0, 10),
      title: "",
      start_time: startHHMM,
      end_time: endHHMM,
    };
  };
  const [createForm, setCreateForm] = useState(defaultCreateForm());
  const [creating, setCreating] = useState(false);

  // Apply a duration preset (in minutes) — sets end_time = start_time + mins
  const applyDurationPreset = (mins: number) => {
    const [h, m] = createForm.start_time.split(":").map(Number);
    const total = (h * 60 + m + mins) % (24 * 60);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const end = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
    setCreateForm(p => ({ ...p, end_time: end }));
  };

  const durationMins = (() => {
    const [sh, sm] = createForm.start_time.split(":").map(Number);
    const [eh, em] = createForm.end_time.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  })();

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) return;
    attendanceApi.getSessions(cid as string).then(setSessions).finally(() => setLoading(false));
  }, [cid]);

  const handleCreate = async () => {
    if (!cid || !createForm.date || creating) return;
    setCreating(true);
    try {
      await attendanceApi.createSession(cid as string, {
        date: createForm.date,
        title: createForm.title,
        start_time: createForm.start_time,
        end_time: createForm.end_time,
      });
      const updated = await attendanceApi.getSessions(cid as string);
      setSessions(updated);
      setShowCreate(false);
      setCreateForm(defaultCreateForm());
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await attendanceApi.deleteSession(deleteTarget);
    setSessions(prev => prev.filter(s => s.id !== deleteTarget));
    setDeleteTarget(null);
  };

  // Stats
  const totalSessions = sessions.length;
  const avgRate = totalSessions > 0
    ? Math.round(sessions.reduce((s, sess) => s + (sess.total_count > 0 ? sess.present_count / sess.total_count * 100 : 0), 0) / totalSessions)
    : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-accent-purple" /> Attendance
          </h1>
          <p className="text-sm text-dark-400 mt-1">{totalSessions} sessions recorded</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Session</span>
        </button>
      </div>

      {/* Overview Stats */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 text-center">
            <ClipboardList className="w-5 h-5 text-accent-purple mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{totalSessions}</p>
            <p className="text-[10px] text-dark-400 mt-1">Total Sessions</p>
          </div>
          <div className="glass-card p-4 text-center">
            <CheckCircle className="w-5 h-5 text-accent-emerald mx-auto mb-2" />
            <p className="text-2xl font-bold text-accent-emerald">{avgRate}%</p>
            <p className="text-[10px] text-dark-400 mt-1">Avg Attendance</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Users className="w-5 h-5 text-accent-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {sessions.length > 0 ? sessions[0].total_count : 0}
            </p>
            <p className="text-[10px] text-dark-400 mt-1">Students</p>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-dark-400 text-sm">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 glass-card">
          <CalendarDays className="w-12 h-12 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300 font-medium mb-1">No sessions yet</p>
          <p className="text-dark-500 text-sm mb-4">Create your first attendance session to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gradient relative z-10 px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2"
          >
            <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Session</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sessions.map((s, i) => {
              const pct = s.total_count > 0 ? Math.round(s.present_count / s.total_count * 100) : 0;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card p-4 hover:border-white/10 transition-colors group cursor-pointer"
                  onClick={() => router.push(`/lecturer/course/${cid}/attendance/session/${s.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Date badge */}
                      <div className="w-12 h-12 rounded-xl bg-accent-purple/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] text-accent-purple font-medium uppercase">
                          {new Date(s.date + "T00:00").toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-lg font-bold text-white leading-none">
                          {new Date(s.date + "T00:00").getDate()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{s.title}</h3>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {s.start_time && s.end_time && (
                            <span className="flex items-center gap-1 text-xs text-dark-300">
                              <Clock className="w-3 h-3" /> {s.start_time} – {s.end_time}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-accent-emerald">
                            <CheckCircle className="w-3 h-3" /> {s.present_count} present
                          </span>
                          {s.total_count - s.present_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <XCircle className="w-3 h-3" /> {s.total_count - s.present_count} absent
                            </span>
                          )}
                          <span className="text-xs text-dark-400">{s.total_count} total</span>
                        </div>
                      </div>

                      {/* Progress ring */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="relative w-10 h-10">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="15.5" fill="none"
                              stroke={pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171"}
                              strokeWidth="3" strokeLinecap="round"
                              strokeDasharray={`${pct * 0.975} 100`}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(s.id); }}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-dark-300 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Session Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Attendance Session">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Date</label>
            <input
              type="date"
              value={createForm.date}
              onChange={e => setCreateForm(p => ({ ...p, date: e.target.value }))}
              className="glass-input w-full px-3 py-2.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Title</label>
            <input
              type="text"
              value={createForm.title}
              placeholder="e.g. Week 5 Lecture"
              onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
              className="glass-input w-full px-3 py-2.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Start time</label>
              <input
                type="time"
                value={createForm.start_time}
                onChange={e => {
                  const newStart = e.target.value;
                  setCreateForm(p => {
                    // If new start is >= end, bump end = start + 1h
                    const [sh, sm] = newStart.split(":").map(Number);
                    const [eh, em] = p.end_time.split(":").map(Number);
                    const sMin = sh * 60 + sm;
                    const eMin = eh * 60 + em;
                    if (eMin <= sMin) {
                      const bumped = (sMin + 60) % (24 * 60);
                      const pad = (n: number) => n.toString().padStart(2, "0");
                      return {
                        ...p,
                        start_time: newStart,
                        end_time: `${pad(Math.floor(bumped / 60))}:${pad(bumped % 60)}`,
                      };
                    }
                    return { ...p, start_time: newStart };
                  });
                }}
                className="glass-input w-full px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">End time</label>
              <input
                type="time"
                value={createForm.end_time}
                onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))}
                className="glass-input w-full px-3 py-2.5"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Duration presets</label>
            <div className="flex flex-wrap gap-2">
              {[30, 60, 90, 120, 180].map(mins => {
                const active = durationMins === mins;
                const label = mins < 60 ? `${mins}m` : mins % 60 === 0 ? `${mins / 60}h` : `${Math.floor(mins / 60)}h${mins % 60}m`;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => applyDurationPreset(mins)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      active
                        ? "bg-accent-purple/20 border-accent-purple/40 text-accent-purple"
                        : "bg-white/5 border-white/10 text-dark-300 hover:bg-white/10"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !createForm.date}
              className="btn-gradient relative z-10 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              <span className="relative z-10">{creating ? "Creating..." : "Create Session"}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Session">
        <p className="text-dark-200 text-sm mb-4">Are you sure? This will delete the session and all its attendance records.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-dark-300 hover:bg-white/5 rounded-xl">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">Delete</button>
        </div>
      </Modal>
    </motion.div>
  );
}
