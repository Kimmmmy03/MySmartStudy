"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { coursesApi, CourseOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ArrowRight, Clock, Users, GraduationCap, KeyRound, Loader2, Search } from "lucide-react";
import { getPatternStyle } from "@/lib/patterns";
import { semesterLabel } from "@/lib/utils";

const FALLBACK_PATTERNS = ["songket", "batik", "pucuk_rebung", "ipg_education"];

const CLASS_COLORS = [
  { id: "blue",    bg: "from-blue-400/30 to-blue-600/20 dark:from-blue-500/20 dark:to-indigo-900/20",          border: "border-blue-300/30 dark:border-blue-400/20",     text: "text-blue-600 dark:text-blue-300",     accent: "#1d4ed8" },
  { id: "purple",  bg: "from-violet-400/30 to-violet-600/20 dark:from-violet-500/20 dark:to-indigo-900/20",  border: "border-violet-300/30 dark:border-violet-400/20", text: "text-violet-600 dark:text-violet-300",  accent: "#7c3aed" },
  { id: "emerald", bg: "from-slate-400/25 to-indigo-500/20 dark:from-slate-500/20 dark:to-indigo-900/20",     border: "border-slate-300/25 dark:border-slate-400/25",   text: "text-slate-600 dark:text-slate-300",    accent: "#475569" },
  { id: "rose",    bg: "from-rose-400/25 to-rose-600/15 dark:from-rose-500/15 dark:to-stone-800/20",         border: "border-rose-300/25 dark:border-rose-400/20",     text: "text-rose-600 dark:text-rose-300",      accent: "#9f1239" },
  { id: "amber",   bg: "from-amber-400/25 to-amber-600/15 dark:from-amber-500/15 dark:to-stone-800/20",     border: "border-amber-300/25 dark:border-amber-400/15",   text: "text-amber-600 dark:text-amber-300",    accent: "#b45309" },
  { id: "cyan",    bg: "from-sky-400/25 to-blue-500/20 dark:from-sky-500/20 dark:to-blue-900/20",            border: "border-sky-300/25 dark:border-sky-400/20",       text: "text-sky-600 dark:text-sky-300",        accent: "#0369a1" },
  { id: "indigo",  bg: "from-indigo-400/30 to-indigo-600/20 dark:from-indigo-500/20 dark:to-slate-900/20",   border: "border-indigo-300/30 dark:border-indigo-400/20", text: "text-indigo-600 dark:text-indigo-300",   accent: "#4338ca" },
  { id: "pink",    bg: "from-pink-400/25 to-pink-600/15 dark:from-pink-500/15 dark:to-slate-800/20",         border: "border-pink-300/25 dark:border-pink-400/15",     text: "text-pink-600 dark:text-pink-300",      accent: "#be185d" },
];

function patternColor(accent: string): string {
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.18)`;
}

function getColor(course: CourseOut) {
  if (course.theme_color) {
    const found = CLASS_COLORS.find(c => c.id === course.theme_color);
    if (found) return found;
  }
  let hash = 0;
  for (let i = 0; i < course.id.length; i++) hash = course.id.charCodeAt(i) + ((hash << 5) - hash);
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
}

function getPattern(course: CourseOut): string {
  if (course.pattern) return course.pattern;
  let hash = 0;
  for (let i = 0; i < course.id.length; i++) hash = course.id.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PATTERNS[Math.abs(hash) % FALLBACK_PATTERNS.length];
}

export default function CoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalMsg, setModalMsg] = useState("");
  const [joining, setJoining] = useState(false);
  const [recentViewMap, setRecentViewMap] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [data, views] = await Promise.all([
        coursesApi.enrolled(),
        coursesApi.recentViews().catch(() => []),
      ]);
      setCourses(data);
      const viewMap = new Map<string, string>();
      for (const v of views) viewMap.set(v.course_id, v.viewed_at);
      setRecentViewMap(viewMap);
      setLoading(false);
    };
    load();
  }, [user]);

  const sortedCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? courses.filter(c =>
          c.course_name.toLowerCase().includes(q) ||
          c.course_code.toLowerCase().includes(q) ||
          c.lecturer_name.toLowerCase().includes(q)
        )
      : courses;
    return [...filtered].sort((a, b) => {
      const aView = recentViewMap.get(a.id) || "";
      const bView = recentViewMap.get(b.id) || "";
      if (aView && bView) return bView.localeCompare(aView);
      if (aView) return -1;
      if (bView) return 1;
      return 0;
    });
  }, [courses, recentViewMap, search]);

  const recentIds = useMemo(() => {
    const entries = Array.from(recentViewMap.entries()).sort((a, b) => b[1].localeCompare(a[1]));
    return new Set(entries.slice(0, 3).map(e => e[0]));
  }, [recentViewMap]);

  const handleJoin = async () => {
    if (joining) return;
    if (!joinCode.trim() || !user) return;
    const code = joinCode.trim().toUpperCase();
    if (courses.some(c => c.join_code === code)) {
      setModalMsg("You're already enrolled in this course.");
      return;
    }
    setJoining(true);
    try {
      const course = await coursesApi.join({ join_code: code });
      setCourses(prev => prev.some(c => c.id === course.id) ? prev : [...prev, course]);
      setJoinCode("");
      setModalMsg("Successfully enrolled in " + course.course_name + "!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid join code. Please check and try again.";
      setModalMsg(message);
    } finally {
      setJoining(false);
    }
  };

  const navigateToCourse = (course: CourseOut) => {
    coursesApi.markViewed(course.id).catch(() => {});
    router.push(`/student/course/${course.id}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <GraduationCap className="w-7 h-7 text-accent-blue" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Courses</h1>
          </div>
          <p className="text-sm text-dark-400">
            {courses.length > 0 ? `${courses.length} course${courses.length !== 1 ? "s" : ""} enrolled` : "No courses yet"}
          </p>
        </div>
      </div>

      {/* Join Card */}
      <div className="glass-card overflow-hidden mb-8">
        <div className="px-6 py-5 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/15 border border-accent-blue/20 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-accent-blue" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">Enroll in a Course</h3>
            <p className="text-xs text-dark-400">Enter the 6-character join code from your lecturer</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="glass-input w-full sm:w-32 px-4 py-2.5 text-center font-mono text-base uppercase tracking-widest"
              onKeyDown={e => e.key === "Enter" && handleJoin()}
            />
            <button
              onClick={handleJoin}
              disabled={joining || !joinCode.trim()}
              className="btn-gradient px-5 py-2.5 text-white rounded-xl font-medium relative z-10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="relative z-10 flex items-center gap-2">
                {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</> : "Join"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      {courses.length > 3 && (
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="glass-input w-full sm:w-72 pl-10 pr-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Course Grid */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card overflow-hidden animate-pulse">
              <div className="h-28 bg-white/5" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-3 w-24 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-accent-blue/60" />
          </div>
          <p className="text-lg font-medium text-gray-800 dark:text-dark-200 mb-1">No Courses Yet</p>
          <p className="text-sm text-dark-400">Enter a join code above to enroll in your first course</p>
        </div>
      ) : sortedCourses.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300">No courses match &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Recently Viewed Section */}
          {recentIds.size > 0 && !search && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-dark-400" />
                <h2 className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Recently Viewed</h2>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                <AnimatePresence>
                  {sortedCourses.filter(c => recentIds.has(c.id)).map((course, i) => (
                    <CourseCard key={course.id} course={course} index={i} isRecent onNavigate={navigateToCourse} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* All Courses Section */}
          <div>
            {recentIds.size > 0 && !search && (
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-dark-400" />
                <h2 className="text-xs font-semibold text-dark-400 uppercase tracking-wider">All Courses</h2>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
              <AnimatePresence>
                {(search ? sortedCourses : sortedCourses.filter(c => !recentIds.has(c.id) || recentIds.size === 0)).map((course, i) => (
                  <CourseCard key={course.id} course={course} index={i} onNavigate={navigateToCourse} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!modalMsg} onClose={() => setModalMsg("")} title="Notice">
        <p className="text-sm text-gray-800 dark:text-dark-200 mb-4">{modalMsg}</p>
        <div className="flex justify-end">
          <button onClick={() => setModalMsg("")} className="btn-gradient px-4 py-2 text-white rounded-lg text-sm relative z-10">
            <span className="relative z-10">Got it</span>
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

function CourseCard({
  course, index, isRecent, onNavigate,
}: {
  course: CourseOut;
  index: number;
  isRecent?: boolean;
  onNavigate: (c: CourseOut) => void;
}) {
  const color = getColor(course);
  const pattern = getPattern(course);
  const patStyle = getPatternStyle(pattern, patternColor(color.accent));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: 0.04 * index }}
      whileHover={{ y: -3 }}
      onClick={() => onNavigate(course)}
      className="glass-card overflow-hidden cursor-pointer hover:border-white/15 transition-all group"
    >
      {/* Gradient header with pattern */}
      <div className={`px-5 py-5 bg-gradient-to-r ${color.bg} border-b ${color.border} relative overflow-hidden`}>
        {patStyle && (
          <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none" style={{ ...patStyle, mixBlendMode: "normal", opacity: 0.2, maskImage: "linear-gradient(to right, transparent, black)", WebkitMaskImage: "linear-gradient(to right, transparent, black)" }} />
        )}
        <div className="relative z-[1]">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${color.text} border ${color.border} bg-black/15 backdrop-blur-sm`}>
              {course.course_code}
            </span>
            {isRecent && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-dark-200 border border-white/10 backdrop-blur-sm">
                <Clock className="w-2.5 h-2.5" />
                Recent
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-dark-100 leading-snug">{course.course_name}</h3>
          <p className="text-dark-300 text-sm mt-1">Semester {semesterLabel(course.semester)}</p>
        </div>
      </div>

      {/* Bottom info */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-white/5" style={{ backgroundColor: `${color.accent}20`, color: color.accent }}>
            {(course.lecturer_name || "L").charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm text-gray-700 dark:text-dark-200 block leading-tight">{course.lecturer_name || "Lecturer"}</span>
            <span className="text-[11px] text-dark-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> {course.enrolled_count || 0} students
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: color.accent }}>
          Enter
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}
