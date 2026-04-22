"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { coursesApi, discussionsApi, assignmentsApi, CourseOut, DiscussionOut, AssignmentOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Users, BookOpen, MessageCircle, Sparkles, Plus, AlertCircle, FileText, Flame, Coins, Award } from "lucide-react";
import { resolveBackendUrl } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";

const tips = [
  "Engage your students with interactive mind maps.",
  "Use badges to motivate and reward participation.",
  "Check analytics regularly to identify at-risk students.",
  "Start discussions to encourage collaborative learning.",
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function LecturerDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [recentDiscussions, setRecentDiscussions] = useState<{ courseName: string; courseId: string; senderName: string; senderPhoto?: string | null; senderRole?: string; text: string }[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [pendingReviews, setPendingReviews] = useState<{ assignment: AssignmentOut; ungraded_count: number; total_submissions: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const courseList = await coursesApi.teaching();
      setCourses(courseList);

      let students = 0;
      const discussions: typeof recentDiscussions = [];

      for (const c of courseList) {
        students += (c.enrolled_count || 0);
        const msgs = await discussionsApi.list(c.id);
        const last2 = msgs.slice(-2).reverse();
        last2.forEach((d: DiscussionOut) => {
          discussions.push({ courseName: c.course_name, courseId: c.id, senderName: d.sender_name, senderPhoto: d.sender_photo_url, senderRole: d.sender_role, text: d.text });
        });
      }
      setTotalStudents(students);
      setRecentDiscussions(discussions.slice(0, 5));

      try {
        const pending = await assignmentsApi.pendingReviews();
        setPendingReviews(pending);
      } catch { /* ignore if no pending reviews */ }
    };
    load();
  }, [user]);

  const dailyTip = tips[new Date().getDate() % tips.length];
  const avatarUrl = resolveBackendUrl(profile?.photoURL) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "L")}&background=8b5cf6&color=fff&size=120`;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1), rgba(236,72,153,0.08))",
          border: "1px solid rgba(139,92,246,0.2)",
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent-purple/5 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <span className="text-xs font-medium text-accent-purple uppercase tracking-wider">Welcome back</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Hello, {profile?.displayName || "Lecturer"}!</h1>
            <p className="text-dark-200 text-sm">You have <span className="text-accent-purple font-semibold">{courses.length}</span> active classes</p>
            <div className="mt-4 glass-card px-4 py-3 max-w-md" style={{ borderRadius: "12px" }}>
              <p className="text-dark-200 text-sm italic">&quot;{dailyTip}&quot;</p>
            </div>
          </div>
          <img src={avatarUrl} alt="Profile" className="hidden md:block w-20 h-20 rounded-2xl ring-2 ring-accent-purple/30" />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: Classes */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">My Active Classes</h2>
            <button onClick={() => router.push("/lecturer/class-management")} className="text-sm text-accent-purple hover:text-accent-purple/80 transition-colors">Manage</button>
          </div>
          {courses.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <BookOpen className="w-12 h-12 text-dark-400 mx-auto mb-3" />
              <p className="text-dark-300">No classes yet.</p>
              <button onClick={() => router.push("/lecturer/class-management")}
                className="btn-gradient mt-4 px-5 py-2.5 rounded-xl text-sm text-white font-medium inline-flex items-center gap-2 relative z-10">
                <Plus className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Create Class</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {courses.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  onClick={() => router.push(`/lecturer/course/${c.id}`)}
                  className="glass-card p-5 cursor-pointer"
                >
                  <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                    {c.course_code}
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-2">{c.course_name}</h3>
                  <div className="flex items-center gap-4 mt-3 text-xs text-dark-300">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.enrolled_count || 0} students</span>
                    <span>Sem {c.semester}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent-purple" />
              </div>
              <p className="text-2xl font-bold text-white">{totalStudents}</p>
              <p className="text-xs text-dark-300">Total Students</p>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-accent-purple" />
              </div>
              <p className="text-2xl font-bold text-white">{courses.length}</p>
              <p className="text-xs text-dark-300">Courses</p>
            </div>
            <div className="glass-card p-4 text-center border border-accent-pink/20">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-pink/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-accent-pink" />
              </div>
              <p className="text-2xl font-bold text-white">{profile?.streak ?? 0}</p>
              <p className="text-xs text-dark-300">Day Streak</p>
            </div>
            <div className="glass-card p-4 text-center border border-accent-amber/20">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-accent-amber" />
              </div>
              <p className="text-2xl font-bold text-white">{profile?.points ?? 0}</p>
              <p className="text-xs text-dark-300">Points</p>
            </div>
          </div>

          {/* Badges */}
          {(profile?.badges?.length ?? 0) > 0 && (
            <div className="glass-card p-4 border border-accent-purple/10">
              <h3 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-accent-purple" /> Badges Earned
              </h3>
              <div className="flex flex-wrap gap-2">
                {(profile?.badges ?? []).slice(0, 8).map((b: string) => (
                  <span key={b} className="text-xs px-2.5 py-1 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium capitalize">
                    {b.replace(/_/g, " ")}
                  </span>
                ))}
                {(profile?.badges?.length ?? 0) > 8 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-dark-300 border border-white/10">
                    +{(profile?.badges?.length ?? 0) - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Required */}
          {pendingReviews.length > 0 && (
            <div className="glass-card p-4 border border-accent-amber/20">
              <h3 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-accent-amber" /> Action Required
              </h3>
              <div className="space-y-2">
                {pendingReviews.slice(0, 3).map((pr) => (
                  <div
                    key={pr.assignment.id}
                    onClick={() => router.push(`/lecturer/course/${pr.assignment.course_id}/assignments`)}
                    className="flex items-center justify-between cursor-pointer hover:bg-white/5 rounded-lg p-2 -mx-1 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />
                      <span className="text-sm text-white truncate">{pr.assignment.title}</span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent-amber/10 text-accent-amber font-medium flex-shrink-0">
                      {pr.ungraded_count} ungraded
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Discussions */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-accent-purple" /> Recent Discussions
            </h3>
            {recentDiscussions.length === 0 ? (
              <p className="text-sm text-dark-400">No recent discussions</p>
            ) : (
              <div className="space-y-2">
                {recentDiscussions.map((d, i) => (
                  <div key={i} onClick={() => router.push(`/lecturer/course/${d.courseId}/discussions`)}
                    className="cursor-pointer hover:bg-white/5 rounded-xl p-2.5 -mx-1 transition-colors flex items-start gap-2.5">
                    <UserAvatar name={d.senderName} photoUrl={d.senderPhoto} size={28} role={d.senderRole === "lecturer" ? "lecturer" : "student"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-dark-100 truncate">{d.senderName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 shrink-0">{d.courseName}</span>
                      </div>
                      <p className="text-xs text-dark-400 truncate mt-0.5">{d.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
