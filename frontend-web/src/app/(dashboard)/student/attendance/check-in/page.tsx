"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { attendanceApi } from "@/lib/api";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No check-in token provided.");
      return;
    }

    attendanceApi.checkIn(token)
      .then(result => {
        setStatus("success");
        setSessionTitle(result.session_title);
        setMessage("You have been marked as present!");
      })
      .catch(err => {
        setStatus("error");
        setMessage(err?.message || "Check-in failed. The QR code may have expired or is invalid.");
      });
  }, [token]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center min-h-[60vh]"
    >
      <div className="glass-card p-8 max-w-sm w-full text-center">
        {status === "loading" && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            <Loader2 className="w-16 h-16 text-accent-purple animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Checking In...</h2>
            <p className="text-sm text-dark-400">Please wait while we record your attendance.</p>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }}>
            <div className="w-20 h-20 rounded-full bg-accent-emerald/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-accent-emerald" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Checked In!</h2>
            {sessionTitle && (
              <p className="text-sm text-accent-purple font-medium mb-2">{sessionTitle}</p>
            )}
            <p className="text-sm text-dark-300 mb-6">{message}</p>
            <button
              onClick={() => router.push("/student/attendance")}
              className="btn-gradient relative z-10 px-6 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
            >
              <span className="relative z-10">View My Attendance</span>
            </button>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check-In Failed</h2>
            <p className="text-sm text-dark-300 mb-6">{message}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push("/student/attendance")}
                className="px-4 py-2 rounded-xl text-sm text-dark-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
              >
                My Attendance
              </button>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-dark-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Go Back
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
