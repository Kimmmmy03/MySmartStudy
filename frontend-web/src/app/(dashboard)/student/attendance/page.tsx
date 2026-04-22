"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { attendanceApi, MyAttendance } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, CheckCircle, Clock, XCircle, Loader2, QrCode, Camera } from "lucide-react";
import clsx from "clsx";
import dynamic from "next/dynamic";

const QrScanner = dynamic(() => import("@/components/qr-scanner"), { ssr: false });

export default function StudentAttendancePage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<MyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [checkInMsg, setCheckInMsg] = useState("");

  useEffect(() => {
    attendanceApi.myAttendance().then(setAttendance).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleScan = useCallback(async (data: string) => {
    setScannerOpen(false);
    setCheckInStatus("loading");

    let token = data;
    try {
      const url = new URL(data);
      const param = url.searchParams.get("token");
      if (param) token = param;
    } catch {
      // data is the raw token, not a URL
    }

    try {
      const result = await attendanceApi.checkIn(token);
      setCheckInStatus("success");
      setCheckInMsg(result.session_title ? `Checked in: ${result.session_title}` : "You have been marked as present!");
      attendanceApi.myAttendance().then(setAttendance).catch(() => {});
    } catch (err: any) {
      setCheckInStatus("error");
      setCheckInMsg(err?.message || "Check-in failed. The QR code may have expired or is invalid.");
    }
  }, []);

  const overallPresent = attendance.reduce((s, a) => s + a.present, 0);
  const overallLate = attendance.reduce((s, a) => s + a.late, 0);
  const overallAbsent = attendance.reduce((s, a) => s + a.absent, 0);
  const overallTotal = attendance.reduce((s, a) => s + a.total_sessions, 0);
  const overallPct = overallTotal > 0 ? ((overallPresent + overallLate) / overallTotal * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <UserCheck className="w-7 h-7 text-accent-blue" /> My Attendance
        </h1>
        <button
          onClick={() => { setCheckInStatus("idle"); setScannerOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white text-sm font-semibold shadow-lg shadow-accent-blue/20 active:scale-95 transition-transform"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Scan QR</span>
          <Camera className="w-4 h-4 sm:hidden" />
        </button>
      </div>

      {/* Check-in status banner */}
      <AnimatePresence>
        {checkInStatus !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={clsx(
              "mb-6 p-4 rounded-xl border flex items-center gap-3",
              checkInStatus === "loading" && "bg-accent-blue/5 border-accent-blue/10",
              checkInStatus === "success" && "bg-accent-emerald/10 border-accent-emerald/20",
              checkInStatus === "error" && "bg-red-500/10 border-red-500/20",
            )}
          >
            {checkInStatus === "loading" && (
              <>
                <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
                <span className="text-sm text-gray-700 dark:text-dark-200">Checking in...</span>
              </>
            )}
            {checkInStatus === "success" && (
              <>
                <CheckCircle className="w-5 h-5 text-accent-emerald" />
                <span className="text-sm text-gray-700 dark:text-dark-200 flex-1">{checkInMsg}</span>
                <button onClick={() => setCheckInStatus("idle")} className="text-xs text-dark-400 hover:text-dark-200">Dismiss</button>
              </>
            )}
            {checkInStatus === "error" && (
              <>
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm text-gray-700 dark:text-dark-200 flex-1">{checkInMsg}</span>
                <button onClick={() => setCheckInStatus("idle")} className="text-xs text-dark-400 hover:text-dark-200">Dismiss</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10"
        >
          <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
          <span className="text-sm text-dark-300">Loading your attendance records across all courses...</span>
        </motion.div>
      )}

      {loading ? (
        <>
          {/* Skeleton Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {["Overall Rate", "Present", "Late", "Absent"].map((label, i) => (
              <div key={label} className="glass-card p-4 text-center">
                <motion.div
                  className="h-7 w-14 rounded-md bg-white/5 mx-auto mb-2"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
                />
                <p className="text-xs text-dark-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Skeleton Course Cards */}
          <div className="h-5 w-28 rounded-md bg-white/5 mb-4" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-2">
                    <motion.div
                      className="h-4 w-36 rounded-md bg-white/5"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                    />
                    <motion.div
                      className="h-3 w-20 rounded-md bg-white/5"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.08 }}
                    />
                  </div>
                  <motion.div
                    className="h-6 w-12 rounded-md bg-white/5"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  />
                </div>
                <motion.div
                  className="w-full h-2 bg-dark-700 rounded-full overflow-hidden mb-3"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }}
                />
                <div className="flex gap-4">
                  {[0, 1, 2, 3].map((j) => (
                    <motion.div
                      key={j}
                      className="h-3 w-16 rounded-md bg-white/5"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + j * 0.06 }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : attendance.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-accent-blue/10 flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-10 h-10 text-accent-blue/50" />
          </div>
          <p className="text-gray-700 dark:text-dark-300 font-medium mb-2">No attendance records yet</p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mb-6">Scan a QR code from your lecturer to check in</p>
          <button
            onClick={() => { setCheckInStatus("idle"); setScannerOpen(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white text-sm font-semibold shadow-lg shadow-accent-blue/20 active:scale-95 transition-transform"
          >
            <Camera className="w-4 h-4" /> Open Scanner
          </button>
        </div>
      ) : (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(overallPct)}%</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Overall Rate</p>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="w-4 h-4 text-accent-emerald" />
              </div>
              <p className="text-2xl font-bold text-accent-emerald">{overallPresent}</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Present</p>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-4 h-4 text-accent-amber" />
              </div>
              <p className="text-2xl font-bold text-accent-amber">{overallLate}</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Late</p>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-2xl font-bold text-red-400">{overallAbsent}</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Absent</p>
            </div>
          </div>

          {/* Per-Course Breakdown */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">By Course</h2>
          <div className="space-y-3">
            {attendance.map(a => (
              <div key={a.course_id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{a.course_name}</h3>
                    <p className="text-xs text-gray-500 dark:text-dark-400">{a.course_code}</p>
                  </div>
                  <span className={clsx("text-lg font-bold",
                    a.attendance_percentage >= 80 ? "text-accent-emerald" :
                    a.attendance_percentage >= 60 ? "text-accent-amber" : "text-red-400"
                  )}>
                    {Math.round(a.attendance_percentage)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden mb-3">
                  <div className={clsx("h-full rounded-full transition-all",
                    a.attendance_percentage >= 80 ? "bg-accent-emerald" :
                    a.attendance_percentage >= 60 ? "bg-accent-amber" : "bg-red-400"
                  )} style={{ width: `${Math.min(a.attendance_percentage, 100)}%` }} />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-500 dark:text-dark-400">{a.total_sessions} sessions</span>
                  <span className="text-accent-emerald">{a.present} present</span>
                  <span className="text-accent-amber">{a.late} late</span>
                  <span className="text-red-400">{a.absent} absent</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* QR Scanner overlay */}
      {scannerOpen && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </motion.div>
  );
}
