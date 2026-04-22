"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      >
        <source src="/assets/Login1.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 auth-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md auth-card p-8"
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center glow-blue">
            <Mail className="w-7 h-7 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white auth-heading text-center mb-2">Forgot Password?</h2>
        <p className="text-dark-300 auth-subtext text-sm text-center mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-4 rounded-xl mb-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Reset Email Sent</p>
              <p className="text-dark-300 text-xs">
                Check your inbox for a password reset link. If you don&apos;t see it, check your spam folder.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {error && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="glass-input w-full px-4 py-3"
                  placeholder="example@moe-dl.edu.my"
                />
              </div>

              <button type="submit" disabled={loading}
                className="btn-gradient w-full text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 relative z-10">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="relative z-10">Sending...</span>
                  </>
                ) : (
                  <span className="relative z-10">Send Reset Link</span>
                )}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-dark-300 auth-subtext mt-6">
          <Link href="/login" className="text-accent-blue font-medium hover:text-accent-blue/80 transition-colors auth-link inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
