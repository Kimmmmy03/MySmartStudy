"use client";

import { useState, useEffect, useRef } from "react";
import { certificatesApi, progressApi, CertificateOut, CourseProgressOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { motion } from "framer-motion";
import { Award, Download, CheckCircle, Lock, Loader2 } from "lucide-react";
import clsx from "clsx";

export default function CertificatesPage() {
  const { user, profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateOut[]>([]);
  const [progress, setProgress] = useState<CourseProgressOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [viewCert, setViewCert] = useState<CertificateOut | null>(null);

  useEffect(() => {
    Promise.all([
      certificatesApi.my().then(setCertificates).catch(() => {}),
      progressApi.courses().then(setProgress).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleClaim = async (courseId: string) => {
    setClaiming(courseId);
    try {
      const cert = await certificatesApi.claim(courseId);
      setCertificates(prev => [...prev, cert]);
    } catch (e: any) {
      alert(e.message || "Cannot claim certificate yet");
    } finally {
      setClaiming(null);
    }
  };

  const earnedCourseIds = new Set(certificates.map(c => c.course_id));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Award className="w-7 h-7 text-accent-amber" /> My Certificates
      </h1>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-accent-amber/5 border border-accent-amber/10"
        >
          <Loader2 className="w-4 h-4 text-accent-amber animate-spin" />
          <span className="text-sm text-dark-300">Fetching your certificates and course progress...</span>
        </motion.div>
      )}

      {loading ? (
        <>
          {/* Skeleton Earned Certificates */}
          <div className="mb-8">
            <motion.div className="h-5 w-20 rounded-md bg-white/5 mb-4" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="glass-card p-5">
                  <div className="flex items-start gap-4">
                    <motion.div
                      className="w-12 h-12 rounded-xl bg-white/5 flex-shrink-0"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                    />
                    <div className="space-y-2 flex-1">
                      <motion.div className="h-4 w-36 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.05 }} />
                      <motion.div className="h-3 w-20 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }} />
                      <motion.div className="h-3 w-28 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.15 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Course Progress */}
          <motion.div className="h-5 w-32 rounded-md bg-white/5 mb-4" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }} />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-2">
                    <motion.div className="h-4 w-36 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }} />
                    <motion.div className="h-3 w-20 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.08 }} />
                  </div>
                  <motion.div className="h-7 w-16 rounded-full bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }} />
                </div>
                <motion.div
                  className="w-full h-2 bg-dark-700 rounded-full overflow-hidden mb-2"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }}
                />
                <div className="flex gap-4">
                  {[0, 1, 2].map((j) => (
                    <motion.div key={j} className="h-3 w-24 rounded-md bg-white/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + j * 0.06 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Earned Certificates */}
          {certificates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Earned</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {certificates.map(cert => (
                  <button key={cert.id} onClick={() => setViewCert(cert)}
                    className="glass-card p-5 text-left hover:border-accent-amber/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
                        <Award className="w-6 h-6 text-accent-amber" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white">{cert.course_name}</h3>
                        <p className="text-xs text-dark-400 mt-1">{cert.course_code}</p>
                        <p className="text-xs text-dark-300 mt-1">Issued: {new Date(cert.issued_at).toLocaleDateString()}</p>
                        <p className="text-xs text-dark-500 font-mono mt-1">{cert.certificate_number}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available Courses */}
          <h2 className="text-lg font-semibold text-white mb-4">Course Progress</h2>
          {progress.length === 0 ? (
            <p className="text-dark-400 text-center py-8">No enrolled courses yet.</p>
          ) : (
            <div className="space-y-3">
              {progress.map(p => {
                const earned = earnedCourseIds.has(p.course_id);
                const complete = p.overall_percentage >= 100;
                return (
                  <div key={p.course_id} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{p.course_name}</h3>
                        <p className="text-xs text-dark-400">{p.course_code}</p>
                      </div>
                      {earned ? (
                        <span className="flex items-center gap-1 text-xs px-3 py-1.5 bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Earned
                        </span>
                      ) : complete ? (
                        <button onClick={() => handleClaim(p.course_id)} disabled={claiming === p.course_id}
                          className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                          <span className="relative z-10">{claiming === p.course_id ? "Claiming..." : "Claim Certificate"}</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs px-3 py-1.5 bg-dark-700 text-dark-400 border border-white/5 rounded-full">
                          <Lock className="w-3 h-3" /> {Math.round(p.overall_percentage)}%
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full transition-all",
                        p.overall_percentage >= 100 ? "bg-accent-emerald" :
                        p.overall_percentage >= 50 ? "bg-accent-blue" : "bg-accent-amber"
                      )} style={{ width: `${Math.min(p.overall_percentage, 100)}%` }} />
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-dark-400">
                      <span>Assignments: {p.submitted_assignments}/{p.total_assignments}</span>
                      <span>Quizzes: {p.completed_quizzes}/{p.total_quizzes}</span>
                      <span>Resources: {p.opened_resources}/{p.total_resources}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Certificate View Modal */}
      <Modal open={!!viewCert} onClose={() => setViewCert(null)} title="Certificate" maxWidth="max-w-2xl">
        {viewCert && (
          <div className="text-center py-6">
            <div className="border-2 border-accent-amber/30 rounded-2xl p-8 bg-gradient-to-br from-accent-amber/5 to-accent-purple/5">
              <Award className="w-16 h-16 text-accent-amber mx-auto mb-4" />
              <p className="text-sm text-dark-400 uppercase tracking-widest mb-2">Certificate of Completion</p>
              <h2 className="text-2xl font-bold text-white mb-1">{viewCert.course_name}</h2>
              <p className="text-dark-300 mb-4">{viewCert.course_code}</p>
              <div className="w-24 h-px bg-accent-amber/30 mx-auto mb-4" />
              <p className="text-dark-200 mb-1">Awarded to</p>
              <p className="text-xl font-semibold text-white mb-4">{viewCert.student_name}</p>
              <p className="text-xs text-dark-400">Instructor: {viewCert.lecturer_name}</p>
              <p className="text-xs text-dark-400 mt-1">Issued: {new Date(viewCert.issued_at).toLocaleDateString()}</p>
              <p className="text-xs text-dark-500 font-mono mt-3">Certificate No: {viewCert.certificate_number}</p>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
