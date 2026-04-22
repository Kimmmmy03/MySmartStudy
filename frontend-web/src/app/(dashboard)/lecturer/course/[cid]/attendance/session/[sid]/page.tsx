"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { attendanceApi, AttendanceSession, coursesApi, UserOut } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, ShieldCheck,
  QrCode, Users, Loader2, Check,
} from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { UserAvatar } from "@/components/ui/user-avatar";

const STATUS_OPTIONS = [
  { value: "present", label: "Present", icon: CheckCircle, color: "text-accent-emerald", bg: "bg-accent-emerald/15 border-accent-emerald/30 hover:bg-accent-emerald/25" },
  { value: "absent", label: "Absent", icon: XCircle, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30 hover:bg-red-500/25" },
  { value: "late", label: "Late", icon: Clock, color: "text-accent-amber", bg: "bg-accent-amber/15 border-accent-amber/30 hover:bg-accent-amber/25" },
  { value: "excused", label: "Excused", icon: ShieldCheck, color: "text-accent-blue", bg: "bg-accent-blue/15 border-accent-blue/30 hover:bg-accent-blue/25" },
] as const;

function statusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[1];
}

export default function SessionDetailPage() {
  const { cid, sid } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [students, setStudents] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [localRecords, setLocalRecords] = useState<Record<string, string>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [regenerating, setRegenerating] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const loadSession = useCallback(async () => {
    if (!sid || !cid) return;
    try {
      const [sess, studs] = await Promise.all([
        attendanceApi.getSession(sid as string),
        coursesApi.getStudents(cid as string),
      ]);
      setSession(sess);
      setStudents(studs);

      const map: Record<string, string> = {};
      sess.records.forEach(r => { map[r.student_id] = r.status; });
      studs.forEach(s => { if (!map[s.id]) map[s.id] = "absent"; });
      setLocalRecords(map);
      // Mark initial load done after a tick so the autosave effect skips the first set
      setTimeout(() => { initialLoadDone.current = true; }, 100);
    } catch { /* ignore */ }
    setLoading(false);
  }, [sid, cid]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // Auto-refresh every 10s to pick up QR check-ins
  useEffect(() => {
    if (!sid || !cid) return;
    const interval = setInterval(async () => {
      try {
        const sess = await attendanceApi.getSession(sid as string);
        setSession(sess);
        const map: Record<string, string> = {};
        sess.records.forEach(r => { map[r.student_id] = r.status; });
        students.forEach(s => { if (!map[s.id]) map[s.id] = "absent"; });
        setLocalRecords(prev => {
          // Only update if not manually changed
          const merged = { ...prev };
          sess.records.forEach(r => { merged[r.student_id] = r.status; });
          return merged;
        });
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [sid, cid, students]);

  // Autosave: debounce 1.5s after any manual status change
  useEffect(() => {
    if (!initialLoadDone.current || !session) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        const records = Object.entries(localRecords).map(([student_id, status]) => ({ student_id, status }));
        await attendanceApi.bulkUpdate(session.id, records);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [localRecords, session]);

  const handleRegenerateQr = async () => {
    if (!session) return;
    setRegenerating(true);
    try {
      const result = await attendanceApi.regenerateQr(session.id);
      setSession(prev => prev ? { ...prev, qr_token: result.qr_token } : prev);
    } catch { /* ignore */ }
    setRegenerating(false);
  };

  const qrUrl = session?.qr_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/student/attendance/check-in?token=${session.qr_token}`
    : "";

  const setStatus = (studentId: string, status: string) => {
    setLocalRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    const map: Record<string, string> = {};
    students.forEach(s => { map[s.id] = "present"; });
    setLocalRecords(map);
  };

  const markAllAbsent = () => {
    const map: Record<string, string> = {};
    students.forEach(s => { map[s.id] = "absent"; });
    setLocalRecords(map);
  };

  // Build scanned_at map from the current session records
  const scanTimes: Record<string, string> = {};
  if (session) {
    session.records.forEach(r => {
      if (r.scanned_at) {
        try {
          const d = new Date(r.scanned_at);
          scanTimes[r.student_id] = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch { /* ignore */ }
      }
    });
  }

  // Stats
  const presentCount = Object.values(localRecords).filter(s => s === "present").length;
  const lateCount = Object.values(localRecords).filter(s => s === "late").length;
  const absentCount = Object.values(localRecords).filter(s => s === "absent").length;
  const excusedCount = Object.values(localRecords).filter(s => s === "excused").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-accent-purple" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-dark-400">Session not found.</p>
        <button onClick={() => router.back()} className="text-accent-blue text-sm mt-2 hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Sessions
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{session.title}</h1>
          <p className="text-sm text-dark-400 mt-1 flex items-center gap-2">
            <span>{session.date}</span>
            {session.start_time && session.end_time && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-purple/10 border border-accent-purple/25 text-accent-purple text-[11px] font-medium">
                <Clock className="w-3 h-3" /> {session.start_time} – {session.end_time}
              </span>
            )}
          </p>
        </div>
        {autoSaveStatus !== "idle" && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm">
            {autoSaveStatus === "saving" ? (
              <><Loader2 className="w-4 h-4 animate-spin text-dark-400" /><span className="text-dark-400">Saving...</span></>
            ) : (
              <><Check className="w-4 h-4 text-accent-emerald" /><span className="text-accent-emerald">Saved</span></>
            )}
          </div>
        )}
      </div>

      {/* Live Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-3 text-center">
          <p className="text-lg font-bold text-accent-emerald">{presentCount}</p>
          <p className="text-[10px] text-dark-400">Present</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-lg font-bold text-accent-amber">{lateCount}</p>
          <p className="text-[10px] text-dark-400">Late</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-lg font-bold text-red-400">{absentCount}</p>
          <p className="text-[10px] text-dark-400">Absent</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-lg font-bold text-accent-blue">{excusedCount}</p>
          <p className="text-[10px] text-dark-400">Excused</p>
        </div>
      </div>

      {/* Side-by-side: QR (left) + Manual (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Check-In — Left */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-accent-purple" />
            <h2 className="text-lg font-semibold text-white">QR Check-In</h2>
          </div>
          <p className="text-sm text-dark-400 mb-5 text-center">
            Display this QR code for students to scan with their phone camera. They will be automatically marked as present.
          </p>

          <div className="flex flex-col items-center">
            {/* QR Code */}
            <div className="bg-white rounded-2xl p-5 mb-5 shadow-lg">
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="H"
                minVersion={6}
                includeMargin={false}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleRegenerateQr}
                disabled={regenerating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-dark-200 hover:bg-white/5 border border-white/10 transition-colors"
              >
                <RefreshCw className={clsx("w-4 h-4", regenerating && "animate-spin")} />
                New QR
              </button>
            </div>

            <p className="text-[10px] text-dark-500 text-center">
              Auto-refreshes every 10 seconds to show new check-ins
            </p>
          </div>
        </motion.div>

        {/* Manual Marking — Right */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-blue" />
              <h2 className="text-lg font-semibold text-white">Manual Marking</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={markAllPresent}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-accent-emerald bg-accent-emerald/10 hover:bg-accent-emerald/20 border border-accent-emerald/20 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> All Present
              </button>
              <button
                onClick={markAllAbsent}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> All Absent
              </button>
            </div>
          </div>

          {/* Student List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {students.map((s, i) => {
              const current = localRecords[s.id] || "absent";
              const style = statusStyle(current);

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="glass-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={s.display_name || s.email} photoUrl={s.photo_url} size={36} role="student" className="flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{s.display_name}</p>
                        <p className="text-[10px] text-dark-400 truncate">{s.email}</p>
                      </div>
                      {scanTimes[s.id] && (
                        <span
                          title={`Scanned at ${scanTimes[s.id]}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-emerald/15 border border-accent-emerald/30 text-accent-emerald text-[10px] font-medium tabular-nums flex-shrink-0"
                        >
                          <QrCode className="w-3 h-3" /> {scanTimes[s.id]}
                        </span>
                      )}
                    </div>

                    {/* Status buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {STATUS_OPTIONS.map(opt => {
                        const active = current === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setStatus(s.id, opt.value)}
                            className={clsx(
                              "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                              active
                                ? opt.bg
                                : "border-transparent text-dark-500 hover:text-dark-300 hover:bg-white/5"
                            )}
                            title={opt.label}
                          >
                            <opt.icon className={clsx("w-3.5 h-3.5", active ? opt.color : "")} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
