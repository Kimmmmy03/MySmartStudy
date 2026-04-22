"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { mapsApi, MapOut, coursesApi, assignmentsApi, CourseOut, progressApi, CourseProgressOut, badgesApi, type BadgeDefinition } from "@/lib/api";
import { formatDate, resolveBackendUrl, resolveBadge } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import MapCard from "@/components/map-card";
import ActivityFeed from "@/components/activity-feed";
import BadgeIcon from "@/components/badge-icon";
import StudyActivityChart from "@/components/charts/study-activity-chart";
import MonthlyComparisonChart from "@/components/charts/monthly-comparison-chart";
import RecommendationWizard from "@/components/recommendation-wizard";
import WeeklyReflectionModal from "@/components/weekly-reflection-modal";
import { reflectionsApi } from "@/lib/api";
import { motion } from "framer-motion";
import { Lightbulb, Award, TrendingUp, Map as MapIcon, Plus, Sparkles, Wand2, Brain, BookOpen, CheckCircle2, Clock, AlertCircle, QrCode, GraduationCap, ClipboardList, FileText, Compass, Flame, CalendarDays, Star, Loader2 } from "lucide-react";

const tips = [
  "Use concept maps to connect ideas visually — it boosts retention!",
  "Review your maps before exams for quick revision.",
  "Collaborate with classmates to build richer mind maps.",
  "Try different map templates to find your learning style.",
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [recentMaps, setRecentMaps] = useState<MapOut[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);
  const [totalMaps, setTotalMaps] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseOut[]>([]);
  const [activitiesDue, setActivitiesDue] = useState(0);
  const [activitiesCompleted, setActivitiesCompleted] = useState(0);
  const [courseProgress, setCourseProgress] = useState<CourseProgressOut[]>([]);
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([]);

  useEffect(() => {
    badgesApi.definitions().then(setBadgeDefs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadMaps = async () => {
      try {
        const recent = await mapsApi.list(4);
        setRecentMaps(recent);
        const all = await mapsApi.list();
        setTotalMaps(all.length);
      } finally {
        setMapsLoading(false);
      }
    };
    loadMaps();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadCourses = async () => {
      try {
        const courses = await coursesApi.enrolled();
        setEnrolledCourses(courses);
        // Fetch assignments for each course to count due/completed
        let due = 0;
        let completed = 0;
        for (const course of courses) {
          try {
            const assignments = await assignmentsApi.list(course.id);
            for (const a of assignments) {
              try {
                const sub = await assignmentsApi.getMySubmission(a.id);
                if (sub) {
                  completed++;
                } else if (new Date(a.deadline) >= new Date()) {
                  due++;
                }
              } catch {
                if (new Date(a.deadline) >= new Date()) due++;
              }
            }
          } catch {}
        }
        setActivitiesDue(due);
        setActivitiesCompleted(completed);
      } catch {}
    };
    loadCourses();
    progressApi.courses().then(setCourseProgress).catch(() => {});
  }, [user]);

  const dailyTip = tips[new Date().getDate() % tips.length];
  const avatarUrl = resolveBackendUrl(profile?.photoURL) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "U")}&background=6366f1&color=fff&size=120`;

  const points = profile?.points || 0;
  const streak = profile?.streak || 0;
  const level = Math.floor(points / 100) + 1;
  const xpInLevel = points % 100;

  const quickAccessItems = [
    // High-priority actions — gradient bg + ring
    { icon: ClipboardList, label: "Tasks", href: "/student/planner", color: "from-blue-500 to-blue-600", priority: true },
    { icon: GraduationCap, label: "Exam Plan", href: "/student/exam-planner", color: "from-purple-500 to-purple-600", priority: true },
    { icon: Wand2, label: "AI Materials", href: "#", color: "from-cyan-500 to-cyan-600", priority: true, onClick: () => setWizardOpen(true) },
    // Standard items — solid bg
    { icon: BookOpen, label: "Courses", href: "/student/courses", color: "from-emerald-500 to-emerald-600", priority: false },
    { icon: MapIcon, label: "My Maps", href: "/student/my-maps", color: "from-indigo-500 to-indigo-600", priority: false },
    { icon: Award, label: "Grades", href: "/student/gradebook", color: "from-amber-500 to-amber-600", priority: false },
    { icon: Compass, label: "Study Guide", href: "/student/study-guide", color: "from-pink-500 to-pink-600", priority: false },
    { icon: Brain, label: "Reflection", href: "#", color: "from-slate-500 to-slate-600", priority: false, onClick: () => setReflectionOpen(true) },
  ];

  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long" });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* ── Mobile: Compact Header with Gamification + QR Scanner ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}
        className="lg:hidden relative overflow-hidden rounded-2xl"
      >
        {/* Greeting row */}
        <div className="flex items-center gap-3 mb-4">
          <img src={avatarUrl} alt="Profile" className="w-11 h-11 rounded-2xl ring-2 ring-accent-blue/20 shadow-lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              Hi, {profile?.displayName?.split(" ")[0] || "Student"}!
            </h1>
            <p className="text-xs text-gray-500 dark:text-dark-400">
              {dayName}, {dateStr}
            </p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent-amber/10 border border-accent-amber/20">
              <Flame className="w-3.5 h-3.5 text-accent-amber" />
              <span className="text-xs font-bold text-accent-amber">{streak}</span>
            </div>
          )}
        </div>

        {/* XP + Level card */}
        <div
          className="rounded-2xl p-3.5 mb-3"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))",
            border: "1px solid rgba(99,102,241,0.15)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent-blue/20 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-accent-blue" />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Level {level}</span>
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-dark-300">{xpInLevel}/100 XP</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 dark:bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-purple"
              initial={{ width: 0 }}
              animate={{ width: `${xpInLevel}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* QR Scanner button */}
        <button
          onClick={() => router.push("/student/attendance")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/80 dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/8 active:scale-[0.98] transition-transform shadow-sm dark:shadow-none"
        >
          <div className="w-9 h-9 rounded-xl bg-accent-emerald/15 flex items-center justify-center">
            <QrCode className="w-4.5 h-4.5 text-accent-emerald" />
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-white flex-1 text-left">Scan Attendance QR</span>
          <span className="text-accent-emerald text-xs font-semibold">Scan →</span>
        </button>
      </motion.div>

      {/* ── Desktop: Original Welcome Banner ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}
        className="hidden lg:block relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1), rgba(6,182,212,0.08))",
          border: "1px solid rgba(99,102,241,0.2)",
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent-blue/5 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent-blue" />
              <span className="text-xs font-medium text-accent-blue uppercase tracking-wider">Welcome back</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Hi, {profile?.displayName || "Student"}!
            </h1>
            <p className="text-dark-200 text-sm">
              You have <span className="text-accent-blue font-semibold">{totalMaps}</span> active mind maps
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-purple/15 text-accent-purple text-sm font-medium hover:bg-accent-purple/25 transition-colors"
              >
                <Wand2 className="w-4 h-4" /> Get Recommendation
              </button>
              <button
                onClick={() => setReflectionOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-amber/15 text-accent-amber text-sm font-medium hover:bg-accent-amber/25 transition-colors"
              >
                <Brain className="w-4 h-4" /> Weekly Reflection
              </button>
            </div>
            <div className="mt-4 glass-card px-4 py-3 max-w-md" style={{ borderRadius: "12px" }}>
              <p className="text-dark-200 text-sm italic">&quot;{dailyTip}&quot;</p>
            </div>
          </div>
          <img
            src={avatarUrl}
            alt="Profile"
            className="w-20 h-20 rounded-2xl ring-2 ring-accent-blue/30"
          />
        </div>
      </motion.div>

      {/* ── Mobile: Quick Access Grid ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="lg:hidden space-y-4">
        {/* Essentials — primary actions */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2.5 px-0.5">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {quickAccessItems.filter(i => i.priority).map(({ icon: Icon, label, href, color, onClick }) => (
              <button
                key={label}
                onClick={() => { onClick?.(); if (!onClick) router.push(href); }}
                className="flex flex-col items-center gap-2 py-3 px-1 rounded-2xl bg-white/80 dark:bg-white/[0.05] border border-gray-200/50 dark:border-white/8 active:scale-95 transition-all shadow-sm dark:shadow-none"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-dark-200 text-center leading-tight">{label}</span>
              </button>
            ))}
            <button
              onClick={() => router.push("/student/gradebook")}
              className="flex flex-col items-center gap-2 py-3 px-1 rounded-2xl bg-white/80 dark:bg-white/[0.05] border border-gray-200/50 dark:border-white/8 active:scale-95 transition-all shadow-sm dark:shadow-none"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
                <Award className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-dark-200 text-center leading-tight">Grades</span>
            </button>
          </div>
        </div>
        {/* Explore — secondary items */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-dark-500 uppercase tracking-wider mb-2.5 px-0.5">Explore</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {quickAccessItems.filter(i => !i.priority && i.label !== "Grades").map(({ icon: Icon, label, href, color, onClick }) => (
              <button
                key={label}
                onClick={() => { onClick?.(); if (!onClick) router.push(href); }}
                className="flex flex-col items-center gap-2 py-3 px-1 rounded-2xl active:scale-95 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} opacity-75 flex items-center justify-center`}>
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 dark:text-dark-400 text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Mobile: Daily Tip */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}
        className="lg:hidden rounded-2xl px-4 py-3 flex items-start gap-3 bg-white/80 dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/8 shadow-sm dark:shadow-none"
      >
        <div className="w-8 h-8 rounded-lg bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-accent-amber" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-dark-400 mb-0.5">Daily Tip</p>
          <p className="text-gray-700 dark:text-dark-200 text-sm leading-relaxed">{dailyTip}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left column */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="space-y-6">
          {/* Recent Maps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Maps</h2>
              <button onClick={() => router.push("/student/my-maps")} className="text-sm text-accent-blue hover:text-accent-blue/80 transition-colors max-lg:font-medium max-lg:px-3 max-lg:py-1.5 max-lg:rounded-lg max-lg:min-h-[36px]">
                View All
              </button>
            </div>
            {mapsLoading ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10"
                >
                  <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
                  <span className="text-sm text-dark-300">Loading your recent mind maps...</span>
                </motion.div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="glass-card overflow-hidden rounded-xl">
                      <motion.div
                        className="w-full h-28 bg-white/5"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
                      />
                      <div className="p-3 space-y-2">
                        <motion.div
                          className="h-3.5 w-3/4 rounded-md bg-white/5"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 + 0.05 }}
                        />
                        <motion.div
                          className="h-2.5 w-1/2 rounded-md bg-white/5"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12 + 0.1 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : recentMaps.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <MapIcon className="w-12 h-12 text-dark-400 mx-auto mb-3" />
                <p className="text-dark-300">No maps yet. Create your first mind map!</p>
                <button
                  onClick={() => router.push("/student/create-map")}
                  className="btn-gradient mt-4 px-5 py-2.5 rounded-xl text-sm text-white font-medium inline-flex items-center gap-2 relative z-10"
                >
                  <Plus className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">New Map</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {recentMaps.map(map => (
                  <MapCard
                    key={map.id}
                    title={map.title}
                    thumbnail={map.thumbnail}
                    lastModified={formatDate(map.last_modified)}
                    onClick={() => router.push(`/student/create-map?id=${map.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right column — Bento grid */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="space-y-4">
          {/* Progress Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
            {[
              { icon: BookOpen, color: "accent-blue", value: enrolledCourses.length, label: "Courses" },
              { icon: CheckCircle2, color: "accent-emerald", value: activitiesCompleted, label: "Done" },
              { icon: Clock, color: "accent-amber", value: activitiesDue, label: "Due" },
              { icon: MapIcon, color: "accent-blue", value: totalMaps, label: "Maps" },
            ].map(({ icon: SIcon, color, value, label: sLabel }) => (
              <div key={sLabel} className="glass-card p-3 lg:p-4 text-center">
                <div className={`w-9 h-9 lg:w-10 lg:h-10 mx-auto mb-1.5 lg:mb-2 rounded-xl bg-${color}/10 flex items-center justify-center`}>
                  <SIcon className={`w-4 h-4 lg:w-5 lg:h-5 text-${color}`} />
                </div>
                <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-[11px] lg:text-xs text-gray-500 dark:text-dark-300">{sLabel}</p>
              </div>
            ))}
          </div>

          {/* Recent Badges */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 6 }}>
                <Award className="w-4 h-4 text-accent-amber" />
              </motion.div>
              Recent Badges
            </h3>
            {profile?.badges && profile.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.badges.slice(-3).map((badgeId, i) => {
                  const badge = resolveBadge(badgeId, badgeDefs);
                  return (
                    <motion.span
                      key={badgeId}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i, type: "spring", damping: 15 }}
                      whileHover={{ scale: 1.1, y: -2 }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-accent-amber/10 text-accent-amber border border-accent-amber/20 cursor-default flex items-center gap-1.5"
                    >
                      <BadgeIcon icon={badge.icon} size={14} animated colored lottieUrl={badge.lottie_url} />
                      {badge.name}
                    </motion.span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-dark-400">No badges yet</p>
            )}
            <button onClick={() => router.push("/student/achievements")} className="text-xs text-accent-blue hover:text-accent-blue/80 mt-3 block transition-colors max-lg:text-sm max-lg:font-medium max-lg:px-2 max-lg:py-1.5 max-lg:rounded-lg max-lg:min-h-[36px]">
              View All
            </button>
          </div>

          {/* Course Progress */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent-blue" /> Course Progress
            </h3>
            {enrolledCourses.length > 0 ? (
              <div className="space-y-3">
                {enrolledCourses.slice(0, 5).map(course => {
                  const prog = courseProgress.find(p => p.course_id === course.id);
                  const pct = prog?.overall_percentage || 0;
                  return (
                    <Link key={course.id} href={`/student/course/${course.id}`}
                      className="block px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-dark-100 truncate">{course.course_name}</p>
                        <span className="text-[11px] font-medium text-dark-300">{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 80 ? "rgb(52, 211, 153)" : pct >= 50 ? "rgb(99, 102, 241)" : "rgb(251, 191, 36)",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-dark-400 mt-1">
                        {prog ? `${prog.submitted_assignments}/${prog.total_assignments} assignments · ${prog.completed_quizzes}/${prog.total_quizzes} quizzes` : course.course_code}
                      </p>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-dark-400">No courses enrolled</p>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed />

          {/* Tip Card (desktop only — mobile has its own above) */}
          <div className="hidden lg:block glass-card p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-accent-blue/5 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-accent-blue" />
                <span className="text-sm font-medium text-dark-100">Learning Tip</span>
              </div>
              <p className="text-sm text-dark-300">{dailyTip}</p>
            </div>
          </div>

        </motion.div>
      </div>

      {/* Charts Section */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudyActivityChart />
        <MonthlyComparisonChart />
      </motion.div>

      <RecommendationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSelect={(template) => {
          router.push(`/student/create-map?template=${encodeURIComponent(template)}`);
        }}
      />

      <WeeklyReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        onSubmit={async (confidence, notes) => {
          await reflectionsApi.create({ confidence, notes });
        }}
      />
    </div>
  );
}
