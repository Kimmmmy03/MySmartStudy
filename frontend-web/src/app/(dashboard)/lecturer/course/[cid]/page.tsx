"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { coursesApi, CourseOut, UserOut, participationApi } from "@/lib/api";
import {
  ArrowLeft, FolderOpen, ClipboardList, MessageCircle, Megaphone, Users, Trophy,
  UserPlus, Search, X, Check, HelpCircle, BarChart3, UserCheck,
  MessageSquare, CheckCircle2, Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import Modal from "@/components/ui/modal";
import ParticipationScore from "@/components/participation-score";
import { UserAvatar } from "@/components/ui/user-avatar";
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
  { key: "resources", label: "Resources", icon: FolderOpen, desc: "Manage course materials", color: "text-accent-blue bg-accent-blue/10" },
  { key: "assignments", label: "Assignments", icon: ClipboardList, desc: "Create & manage assignments", color: "text-accent-emerald bg-accent-emerald/10" },
  { key: "quizzes", label: "Quizzes", icon: HelpCircle, desc: "Create & manage quizzes", color: "text-accent-cyan bg-accent-cyan/10" },
  { key: "gradebook", label: "Gradebook", icon: BarChart3, desc: "View all student grades", color: "text-accent-pink bg-accent-pink/10" },
  { key: "announcements", label: "Announcements", icon: Megaphone, desc: "Post announcements", color: "text-accent-amber bg-accent-amber/10" },
  { key: "attendance", label: "Attendance", icon: UserCheck, desc: "Track student attendance", color: "text-accent-emerald bg-accent-emerald/10" },
  { key: "completion", label: "Completion", icon: CheckCircle2, desc: "Track student progress", color: "text-accent-emerald bg-accent-emerald/10" },
  { key: "groups", label: "Group Tasks", icon: Users, desc: "Tasks & project groups", color: "text-dark-200 bg-white/10" },
  { key: "forum", label: "Forum", icon: MessageSquare, desc: "Topic-based discussions", color: "text-accent-pink bg-accent-pink/10" },
  { key: "plagiarism", label: "Plagiarism Detection", icon: Shield, desc: "AI-powered plagiarism analysis", color: "text-accent-cyan bg-accent-cyan/10" },
  { key: "discussions", label: "Class Chat", icon: MessageCircle, desc: "Real-time chat", color: "text-accent-purple bg-accent-purple/10" },
];

export default function LecturerCourseDetailPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseOut | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [participation, setParticipation] = useState<any[]>([]);
  const [partLoading, setPartLoading] = useState(true);
  const [showParticipation, setShowParticipation] = useState(false);

  // Students management
  const [students, setStudents] = useState<UserOut[]>([]);
  const [showStudents, setShowStudents] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserOut[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cid) return;
    coursesApi.get(cid as string).then(setCourse);
    participationApi
      .get(cid as string)
      .then(setParticipation)
      .catch(() => {})
      .finally(() => setPartLoading(false));
  }, [cid]);

  const loadStudents = async () => {
    if (!cid) return;
    const list = await coursesApi.getStudents(cid as string);
    setStudents(list);
  };

  useEffect(() => {
    if (showStudents && cid) loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStudents, cid]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await coursesApi.searchStudents(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleAddStudent = async (studentId: string) => {
    if (!cid) return;
    setAddingId(studentId);
    try {
      await coursesApi.addStudent(cid as string, studentId);
      setAddedIds(prev => new Set(prev).add(studentId));
      // Update enrolled count
      setCourse(prev => prev ? { ...prev, enrolled_count: (prev.enrolled_count || 0) + 1 } : prev);
      if (showStudents) loadStudents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setAddingId(null);
    }
  };

  if (!course) return <p className="text-dark-400 text-center py-8">Loading...</p>;

  const enrolledStudentIds = new Set(students.map(s => s.id));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {(() => {
        const theme = getCourseTheme(course);
        const pattern = getCoursePattern(course);
        const patStyle = getPatternStyle(pattern, accentToPatternColor(theme.accent));
        return (
          <div className={`bg-gradient-to-r ${theme.bg} glass-card p-4 md:p-5 mb-6 relative overflow-hidden`}>
            {patStyle && <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none" style={{ ...patStyle, mixBlendMode: "normal", opacity: 0.2, maskImage: "linear-gradient(to right, transparent, black)", WebkitMaskImage: "linear-gradient(to right, transparent, black)" }} />}
            <button
              onClick={() => router.push("/lecturer/class-management")}
              className="px-3 py-1 rounded-lg bg-white/90 dark:bg-white/10 text-gray-700 dark:text-dark-200 hover:bg-white dark:hover:bg-white/20 text-xs flex items-center gap-1.5 mb-3 relative z-[1] backdrop-blur-sm border border-gray-200/50 dark:border-white/10 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Classes
            </button>
            <div className="relative z-[1]">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-dark-100 mb-0.5">{course.course_name}</h1>
              <p className="text-xs text-dark-300">{course.course_code}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2.5 py-0.5 bg-white/10 rounded-full text-[11px] text-gray-700 dark:text-dark-200">Semester {course.semester}</span>
                <span className="px-2.5 py-0.5 bg-white/10 rounded-full text-[11px] text-gray-700 dark:text-dark-200 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {course.enrolled_count || 0} students
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Course Tools</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-6">
        {modules.map(({ key, label, icon: Icon, desc, color }) => (
          <button
            key={key}
            onClick={() => router.push(`/lecturer/course/${cid}/${key}`)}
            className="p-3 text-left rounded-xl hover:-translate-y-0.5 hover:shadow-md transition-all bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/8 backdrop-blur-sm shadow-sm"
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#7c3aed40")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-xs">{label}</h3>
            <p className="text-[11px] text-gray-500 dark:text-dark-300 mt-0.5 leading-tight line-clamp-2">{desc}</p>
          </button>
        ))}
      </div>

      {/* Students Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Students</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAddStudent(true); setSearchQuery(""); setSearchResults([]); setAddedIds(new Set()); }}
              className="btn-gradient relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              <span className="relative z-10 flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Add Student</span>
            </button>
            <button
              onClick={() => setShowStudents(!showStudents)}
              className="text-sm text-accent-purple hover:text-accent-blue flex items-center gap-1"
            >
              <Users className="w-4 h-4" />
              {showStudents ? "Hide" : `View (${course.enrolled_count || 0})`}
            </button>
          </div>
        </div>
        {showStudents && (
          <div className="glass-card overflow-hidden">
            {students.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-6">No students enrolled yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {students.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <UserAvatar name={s.display_name || s.email} photoUrl={s.photo_url} size={32} role="student" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-100 truncate">{s.display_name || "Unnamed"}</p>
                      <p className="text-xs text-dark-400 truncate">{s.email}</p>
                    </div>
                    {s.class_name && <span className="text-xs text-dark-400">{s.class_name}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Participation Scores */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Participation</h2>
        <button
          onClick={() => setShowParticipation(!showParticipation)}
          className="text-sm text-accent-purple hover:text-accent-blue flex items-center gap-1"
        >
          <Trophy className="w-4 h-4" />
          {showParticipation ? "Hide" : "Show Scores"}
        </button>
      </div>
      {showParticipation && (
        <ParticipationScore data={participation} loading={partLoading} />
      )}

      {/* Add Student Modal */}
      <Modal open={showAddStudent} onClose={() => setShowAddStudent(false)} title="Add Student">
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="glass-input w-full pl-9 pr-9 py-2.5 text-sm"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/5 rounded">
                <X className="w-3.5 h-3.5 text-dark-400" />
              </button>
            )}
          </div>

          {searching && <p className="text-sm text-dark-400 text-center py-2">Searching...</p>}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-dark-400 text-center py-4">No students found matching &quot;{searchQuery}&quot;</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {searchResults.map(s => {
                const alreadyEnrolled = enrolledStudentIds.has(s.id) || addedIds.has(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                    <UserAvatar name={s.display_name || s.email} photoUrl={s.photo_url} size={32} role="student" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-100 truncate">{s.display_name || "Unnamed"}</p>
                      <p className="text-xs text-dark-400 truncate">{s.email}</p>
                    </div>
                    {alreadyEnrolled ? (
                      <span className="text-xs px-2 py-1 rounded-lg bg-accent-emerald/10 text-accent-emerald flex items-center gap-1">
                        <Check className="w-3 h-3" /> Enrolled
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddStudent(s.id)}
                        disabled={addingId === s.id}
                        className="btn-gradient relative z-10 px-3 py-1 rounded-lg text-xs disabled:opacity-50"
                      >
                        <span className="relative z-10">{addingId === s.id ? "Adding..." : "Add"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery.length < 2 && !searching && (
            <p className="text-xs text-dark-400 text-center py-2">Type at least 2 characters to search</p>
          )}
        </div>
      </Modal>
    </motion.div>
  );
}
