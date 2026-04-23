"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { coursesApi, announcementsApi, CourseOut, AnnouncementOut } from "@/lib/api";
import { formatDate, semesterLabel } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FolderOpen, ClipboardList, BarChart3, MessageCircle, Megaphone,
  HelpCircle, Users, MessageSquare, ChevronRight, Calendar, ListTodo
} from "lucide-react";
import { getPatternStyle } from "@/lib/patterns";

const FALLBACK_PATTERNS = ["songket", "batik", "pucuk_rebung", "ipg_education"];

const THEME_COLORS: Record<string, { bg: string; accent: string }> = {
  blue: { bg: "from-blue-400/30 to-blue-600/20 dark:from-blue-500/20 dark:to-indigo-900/20", accent: "#1d4ed8" },
  purple: { bg: "from-violet-400/30 to-violet-600/20 dark:from-violet-500/20 dark:to-indigo-900/20", accent: "#7c3aed" },
  emerald: { bg: "from-slate-400/25 to-indigo-500/20 dark:from-slate-500/20 dark:to-indigo-900/20", accent: "#475569" },
  rose: { bg: "from-rose-400/25 to-rose-600/15 dark:from-rose-500/15 dark:to-stone-800/20", accent: "#9f1239" },
  amber: { bg: "from-amber-400/25 to-amber-600/15 dark:from-amber-500/15 dark:to-stone-800/20", accent: "#b45309" },
  cyan: { bg: "from-sky-400/25 to-blue-500/20 dark:from-sky-500/20 dark:to-blue-900/20", accent: "#0369a1" },
  indigo: { bg: "from-indigo-400/30 to-indigo-600/20 dark:from-indigo-500/20 dark:to-slate-900/20", accent: "#4338ca" },
  pink: { bg: "from-pink-400/25 to-pink-600/15 dark:from-pink-500/15 dark:to-slate-800/20", accent: "#be185d" },
};

function accentToPatternColor(accent: string): string {
  if (!accent) return "rgba(255,255,255,0.1)";
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.18)`;
}

function getCourseTheme(course: CourseOut): { bg: string; accent: string } {
  if (course.theme_color) {
    const found = THEME_COLORS[course.theme_color];
    if (found) return found;
  }
  const keys = Object.keys(THEME_COLORS);
  let hash = 0;
  for (let i = 0; i < course.id.length; i++) hash = course.id.charCodeAt(i) + ((hash << 5) - hash);
  return THEME_COLORS[keys[Math.abs(hash) % keys.length]];
}

function getCoursePattern(course: CourseOut): string {
  if (course.pattern) return course.pattern;
  let hash = 0;
  for (let i = 0; i < course.id.length; i++) hash = course.id.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PATTERNS[Math.abs(hash) % FALLBACK_PATTERNS.length];
}

const modules = [
  { key: "resources", label: "Resources", icon: FolderOpen, desc: "Course materials & files" },
  { key: "assignments", label: "Assignments", icon: ClipboardList, desc: "View & submit work" },
  { key: "quizzes", label: "Quizzes", icon: HelpCircle, desc: "Take course quizzes" },
  { key: "peer-reviews", label: "Peer Reviews", icon: Users, desc: "Review classmates' work" },
  { key: "groups", label: "Groups", icon: ListTodo, desc: "View your task groups" },
  { key: "grades", label: "My Grades", icon: BarChart3, desc: "Track your performance" },
  { key: "forum", label: "Forum", icon: MessageSquare, desc: "Topic-based discussions" },
  { key: "discussions", label: "Class Chat", icon: MessageCircle, desc: "Real-time chat" },
];

export default function CourseDetailPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseOut | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([]);

  useEffect(() => {
    if (!cid) return;
    const load = async () => {
      const courseData = await coursesApi.get(cid as string);
      setCourse(courseData);
      const anns = await announcementsApi.list(cid as string);
      setAnnouncements(anns);
    };
    load();
  }, [cid]);

  if (!course) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-t-2 border-r-2 border-accent-blue rounded-full" />
    </div>
  );

  const theme = getCourseTheme(course);
  const accent = theme.accent;
  const pattern = getCoursePattern(course);
  const patStyle = getPatternStyle(pattern, accentToPatternColor(accent));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Course Header Banner */}
      <div className={`glass-card bg-gradient-to-r ${theme.bg} p-6 md:p-8 mb-8 relative overflow-hidden`}>
        {patStyle && <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none" style={{ ...patStyle, mixBlendMode: "normal", opacity: 0.2, maskImage: "linear-gradient(to right, transparent, black)", WebkitMaskImage: "linear-gradient(to right, transparent, black)" }} />}

        <button
          onClick={() => router.push("/student/courses")}
          className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-white/10 text-gray-700 dark:text-dark-200 hover:bg-white dark:hover:bg-white/20 text-sm flex items-center gap-1.5 mb-4 relative z-[1] backdrop-blur-sm border border-gray-200/50 dark:border-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Courses
        </button>

        <div className="relative z-[1]">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-100 mb-1">{course.course_name}</h1>
          <p className="text-dark-300">{course.course_code}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-gray-700 dark:text-dark-200 flex items-center gap-1">
              <Users className="w-3 h-3" /> {course.lecturer_name || "Lecturer"}
            </span>
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-gray-700 dark:text-dark-200">
              Semester {semesterLabel(course.semester)}
              {course.year ? ` · Year ${course.year}` : ""}
              {course.academic_session ? ` · ${course.academic_session}` : ""}
            </span>
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-gray-700 dark:text-dark-200 flex items-center gap-1">
              <Users className="w-3 h-3" /> {course.enrolled_count || 0} students
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
        {/* Course Tools Grid */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Course Tools</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {modules.map(({ key, label, icon: Icon, desc }, idx) => (
              <motion.button
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => key === "grades" ? router.push("/student/gradebook") : router.push(`/student/course/${cid}/${key}`)}
                className="p-4 text-left rounded-2xl hover:-translate-y-1 hover:shadow-md transition-all group relative overflow-hidden bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/8 backdrop-blur-sm shadow-sm"
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${accent}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 border relative z-10"
                  style={{ backgroundColor: `${accent}15`, borderColor: `${accent}25`, color: accent }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm relative z-10">{label}</h3>
                <p className="text-xs text-dark-300 mt-1 relative z-10">{desc}</p>
                <div className="flex items-center gap-1 text-xs mt-3 opacity-0 group-hover:opacity-100 transition-opacity relative z-10" style={{ color: accent }}>
                  Open <ChevronRight className="w-3 h-3" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Announcements Sidebar */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-4 h-4" style={{ color: accent }} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Announcements</h2>
          </div>

          <div className="glass-card p-5">
            {announcements.length === 0 ? (
              <div className="text-center py-12">
                <div
                  className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: `${accent}15`, borderColor: `${accent}25` }}
                >
                  <Megaphone className="w-7 h-7 opacity-50" style={{ color: accent }} />
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-dark-200 mb-1">All Caught Up</p>
                <p className="text-xs text-dark-400">No announcements yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {announcements.slice(0, 5).map((a, idx) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="relative"
                    >
                      {idx < announcements.slice(0, 5).length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-px bg-white/5" />
                      )}
                      <div className="flex gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl shrink-0 flex flex-col items-center justify-center text-center border ${idx === 0 ? "" : "bg-white/5 border-white/5"}`}
                          style={idx === 0 ? { backgroundColor: `${accent}15`, borderColor: `${accent}25` } : undefined}
                        >
                          <span className={`text-[9px] font-semibold uppercase leading-none ${idx !== 0 ? "text-dark-400" : ""}`} style={idx === 0 ? { color: accent } : undefined}>
                            {formatDate(a.created_at, { month: "short" })}
                          </span>
                          <span className={`text-sm font-bold leading-none mt-0.5 ${idx === 0 ? "text-gray-900 dark:text-white" : "text-dark-200"}`}>
                            {formatDate(a.created_at, { day: "numeric" })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-3 h-3 text-dark-400" />
                            <span className="text-[10px] text-dark-400 font-medium">
                              {formatDate(a.created_at, { hour: "numeric", minute: "2-digit" })}
                            </span>
                            {idx === 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: accent, backgroundColor: `${accent}15`, border: `1px solid ${accent}25` }}>NEW</span>
                            )}
                          </div>
                          <h4 className={`text-sm font-semibold leading-snug mb-1 ${idx === 0 ? "text-gray-900 dark:text-white" : "text-gray-800 dark:text-dark-100"}`}>
                            {a.title}
                          </h4>
                          <p className="text-xs text-dark-300 leading-relaxed line-clamp-2">{a.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {announcements.length > 5 && (
              <button
                onClick={() => router.push(`/student/course/${cid}/announcements`)}
                className="mt-4 w-full text-xs font-medium transition-colors py-2.5 rounded-lg bg-white/90 dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/10 hover:bg-white dark:hover:bg-white/10"
                style={{ color: accent }}
              >
                View All Announcements
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
