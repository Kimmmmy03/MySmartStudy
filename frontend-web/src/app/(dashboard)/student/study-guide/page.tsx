"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  aiStudyPlanApi,
  aiCompanionApi,
  DailyGuide,
  StudyRecommendation,
  TimetableAnalysis,
  SavedTimetable,
  LearningStyleQuestion,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Clock,
  RefreshCw,
  Loader2,
  BookOpen,
  Calendar,
  MapPin,
  ClipboardList,
  Flame,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  Brain,
  Upload,
  Zap,
  FileText,
  X,
  Trash2,
  Save,
  Eye,
  Headphones,
  BookMarked,
  Hand,
  ArrowRight,
} from "lucide-react";

/* ── Priority helpers ── */
const priorityConfig: Record<
  string,
  { color: string; bg: string; border: string; label: string; icon: typeof Flame }
> = {
  high: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "High Priority",
    icon: Flame,
  },
  medium: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Medium",
    icon: TrendingUp,
  },
  low: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    label: "Low",
    icon: CheckCircle2,
  },
};

/** Parse "9:00 AM" or "10:30 PM" to minutes since midnight for sorting. */
function parseAmPm(t: string): number {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const pm = m[3].toUpperCase() === "PM";
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + min;
}

function sortByPriority(recs: StudyRecommendation[]): StudyRecommendation[] {
  const prioOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...recs].sort((a, b) => {
    // Sort by suggested_time first (chronological), then by priority as tiebreaker
    const startA = parseAmPm((a.suggested_time || "").split("-")[0]);
    const startB = parseAmPm((b.suggested_time || "").split("-")[0]);
    if (startA !== startB) return startA - startB;
    return (prioOrder[a.priority] ?? 3) - (prioOrder[b.priority] ?? 3);
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getTodayDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ── Expandable Card ── */
function RecommendationCard({
  rec,
  idx,
}: {
  rec: StudyRecommendation;
  idx: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const prio = priorityConfig[rec.priority] || priorityConfig.low;
  const PrioIcon = prio.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + idx * 0.04 }}
      className={`group relative overflow-hidden rounded-2xl border ${prio.border} bg-dark-800/40 backdrop-blur-sm hover:bg-dark-800/60 transition-all duration-300`}
    >
      {/* Left accent strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${prio.bg.replace("/10", "/60")}`}
      />

      <div className="pl-5 pr-5 py-5">
        {/* Top row: Course + Priority badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent-blue shrink-0" />
            <span className="text-accent-blue text-sm font-semibold">
              {rec.course}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${prio.bg} ${prio.color} border ${prio.border}`}
          >
            <PrioIcon className="w-3 h-3" />
            {prio.label}
          </span>
        </div>

        {/* Topic */}
        <h3 className="text-white font-semibold text-base mb-2 leading-snug">
          {rec.topic}
        </h3>

        {/* Suggested study time */}
        {rec.suggested_time && (
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="text-accent-cyan text-sm font-medium">
              {rec.suggested_time}
            </span>
          </div>
        )}

        {/* Reason */}
        <p
          className={`text-dark-300 text-sm leading-relaxed ${
            !expanded ? "line-clamp-2" : ""
          }`}
        >
          {rec.reason}
        </p>

        {/* Expand toggle */}
        {rec.reason && rec.reason.length > 100 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-dark-400 hover:text-accent-blue mt-1.5 transition-colors"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Read more <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}

        {/* Difficulty rating badge */}
        {rec.difficulty_rating != null && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-dark-400">Difficulty:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <div
                  key={star}
                  className={`w-2 h-2 rounded-full ${
                    star <= rec.difficulty_rating!
                      ? "bg-amber-400"
                      : "bg-dark-600"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-dark-500">
              {rec.difficulty_rating <= 2 ? "Easy" : rec.difficulty_rating <= 3 ? "Medium" : "Hard"}
            </span>
          </div>
        )}

        {/* Suggested activities */}
        {expanded && rec.suggested_activities && rec.suggested_activities.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-dark-400 mb-1.5">Suggested activities:</p>
            <ul className="space-y-1">
              {rec.suggested_activities.map((act, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-dark-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  {act}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Resource links */}
        {expanded && rec.resource_links && rec.resource_links.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-dark-400 mb-1.5">Related resources:</p>
            <div className="flex flex-wrap gap-1.5">
              {rec.resource_links.map((link, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                >
                  <BookOpen className="w-3 h-3" />
                  {link.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer: Estimated time */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-dark-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>{rec.estimated_time}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main page ── */
export default function StudyGuidePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"guide" | "timetable">("guide");

  // VARK learning style
  const [learningStyle, setLearningStyle] = useState<string | null | undefined>(undefined); // undefined = loading, null = not set
  const [varkQuestions, setVarkQuestions] = useState<LearningStyleQuestion[]>([]);
  const [varkStep, setVarkStep] = useState(0);
  const [varkAnswers, setVarkAnswers] = useState<string[]>([]);
  const [varkResult, setVarkResult] = useState<string | null>(null);
  const [varkLoading, setVarkLoading] = useState(false);

  // Daily Guide
  const [guide, setGuide] = useState<DailyGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Timetable extraction
  const [timetableText, setTimetableText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TimetableAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [timetableMode, setTimetableMode] = useState<"text" | "pdf">("pdf");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Saved timetables
  const [savedTimetables, setSavedTimetables] = useState<SavedTimetable[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [semesterLabel, setSemesterLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGuide = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await aiStudyPlanApi.dailyGuide();
      setGuide(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load study guide"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Check VARK profile on mount, load guide only if VARK is done
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await aiCompanionApi.getLearningProfile();
        const style = profile?.learning_style ?? null;
        setLearningStyle(style);
        if (style) fetchGuide();
      } catch {
        setLearningStyle(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const startVark = async () => {
    setVarkLoading(true);
    try {
      const data = await aiCompanionApi.assessStyle();
      setVarkQuestions(data.questions);
    } catch {
      setVarkQuestions([
        { id: "1", text: "When studying a new topic, I prefer to:", options: [{ value: "visual", text: "Look at diagrams and charts" }, { value: "auditory", text: "Listen to explanations" }, { value: "reading", text: "Read detailed text" }, { value: "kinesthetic", text: "Try hands-on exercises" }] },
        { id: "2", text: "I remember things best when I:", options: [{ value: "visual", text: "See images or videos" }, { value: "auditory", text: "Hear them explained aloud" }, { value: "reading", text: "Write them down" }, { value: "kinesthetic", text: "Practice doing them" }] },
        { id: "3", text: "In class, I find it most helpful to:", options: [{ value: "visual", text: "Watch demonstrations" }, { value: "auditory", text: "Listen to the lecturer" }, { value: "reading", text: "Take detailed notes" }, { value: "kinesthetic", text: "Participate in activities" }] },
        { id: "4", text: "When preparing for exams, I prefer:", options: [{ value: "visual", text: "Creating mind maps and diagrams" }, { value: "auditory", text: "Discussing topics with friends" }, { value: "reading", text: "Re-reading notes and textbooks" }, { value: "kinesthetic", text: "Solving practice problems" }] },
        { id: "5", text: "I find it easiest to follow:", options: [{ value: "visual", text: "Visual presentations with images" }, { value: "auditory", text: "Verbal instructions" }, { value: "reading", text: "Written step-by-step guides" }, { value: "kinesthetic", text: "Learning by trial and error" }] },
      ]);
    } finally {
      setVarkLoading(false);
    }
  };

  const handleVarkAnswer = async (value: string) => {
    const newAnswers = [...varkAnswers, value];
    setVarkAnswers(newAnswers);

    if (varkStep < varkQuestions.length - 1) {
      setVarkStep(varkStep + 1);
    } else {
      // Calculate result
      const counts: Record<string, number> = {};
      newAnswers.forEach((a) => { counts[a] = (counts[a] || 0) + 1; });
      const topStyle = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      setVarkResult(topStyle);

      // Save to backend
      try {
        await aiCompanionApi.updateLearningProfile({ learning_style: topStyle });
      } catch { /* continue */ }
    }
  };

  const finishVark = () => {
    if (varkResult) {
      setLearningStyle(varkResult);
      fetchGuide();
    }
  };

  const VARK_INFO: Record<string, { icon: typeof Eye; label: string; color: string }> = {
    visual: { icon: Eye, label: "Visual Learner", color: "from-blue-500 to-cyan-500" },
    auditory: { icon: Headphones, label: "Auditory Learner", color: "from-purple-500 to-pink-500" },
    reading: { icon: BookMarked, label: "Reading/Writing Learner", color: "from-amber-500 to-orange-500" },
    kinesthetic: { icon: Hand, label: "Kinesthetic Learner", color: "from-emerald-500 to-teal-500" },
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError("");
    try {
      let result: TimetableAnalysis;
      if (timetableMode === "pdf" && pdfFile) {
        result = await aiStudyPlanApi.uploadTimetablePdf(pdfFile);
      } else if (timetableMode === "text" && timetableText.trim()) {
        result = await aiStudyPlanApi.analyzeTimetable(timetableText);
      } else {
        setAnalyzing(false);
        return;
      }
      setAnalysis(result);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Failed to analyze timetable"
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      if (file.size > 5 * 1024 * 1024) {
        setAnalysisError("PDF file must be under 5MB");
        return;
      }
      setPdfFile(file);
      setAnalysisError("");
    } else {
      setAnalysisError("Please upload a PDF file");
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAnalysisError("PDF file must be under 5MB");
        return;
      }
      setPdfFile(file);
      setAnalysisError("");
    }
  };

  const fetchSavedTimetables = async () => {
    setLoadingSaved(true);
    try {
      const data = await aiStudyPlanApi.listTimetables();
      setSavedTimetables(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSavedTimetables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveTimetable = async () => {
    if (!analysis || !semesterLabel.trim()) return;
    setSaving(true);
    try {
      await aiStudyPlanApi.saveTimetable({
        semester_label: semesterLabel.trim(),
        parsed_schedule: analysis.parsed_schedule,
        recommended_study_times: analysis.recommended_study_times,
      });
      setSemesterLabel("");
      setAnalysis(null);
      setPdfFile(null);
      setTimetableText("");
      await fetchSavedTimetables();
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to save timetable");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimetable = async (id: string) => {
    try {
      await aiStudyPlanApi.deleteTimetable(id);
      setSavedTimetables((prev) => prev.filter((t) => t.id !== id));
    } catch {
      /* ignore */
    }
  };

  // Day sort order
  const DAY_ORDER: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  };

  const sortSchedule = (schedule: TimetableAnalysis["parsed_schedule"]) =>
    [...schedule]
      .sort((a, b) => (DAY_ORDER[a.day.toLowerCase()] ?? 99) - (DAY_ORDER[b.day.toLowerCase()] ?? 99))
      .map((day) => ({
        ...day,
        classes: [...day.classes].sort((a, b) => a.time.localeCompare(b.time)),
      }));

  const sortStudyTimes = (times: NonNullable<TimetableAnalysis["recommended_study_times"]>) =>
    [...times].sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day.toLowerCase()] ?? 99) - (DAY_ORDER[b.day.toLowerCase()] ?? 99);
      return dayDiff !== 0 ? dayDiff : a.time.localeCompare(b.time);
    });

  const sorted = guide ? sortByPriority(guide.recommendations) : [];
  const highCount = sorted.filter((r) => r.priority === "high").length;
  const medCount = sorted.filter((r) => r.priority === "medium").length;
  const lowCount = sorted.filter((r) => r.priority === "low").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header with tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20">
                <Brain className="w-6 h-6 text-accent-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  AI Study Guide
                </h1>
                <p className="text-dark-300 text-sm">
                  Personalized recommendations powered by AI
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchGuide(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-dark-800/60 border border-white/10 text-dark-200 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-dark-800/50 rounded-xl border border-white/5 w-fit">
          {[
            { id: "guide" as const, label: "Daily Guide", icon: Target },
            { id: "timetable" as const, label: "Timetable", icon: Calendar },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/20"
                    : "text-dark-400 hover:text-dark-200"
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "guide" ? (
          <motion.div
            key="guide"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* ── VARK Assessment Gate ── */}
            {learningStyle === undefined ? (
              /* Checking profile... */
              <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-12 text-center">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-accent-blue animate-spin mx-auto mb-3" />
                <p className="text-gray-500 dark:text-dark-400 text-sm">Loading your profile...</p>
              </div>
            ) : learningStyle === null && !varkResult ? (
              /* VARK quiz */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 shadow-sm dark:shadow-none overflow-hidden"
              >
                {varkQuestions.length === 0 ? (
                  /* Intro */
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Discover Your Learning Style
                    </h3>
                    <p className="text-gray-500 dark:text-dark-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                      Answer 5 quick questions based on the VARK model so SmartBuddy can personalize study recommendations to match how you learn best.
                    </p>
                    <div className="flex items-center justify-center gap-6 mb-6">
                      {Object.entries(VARK_INFO).map(([key, info]) => {
                        const VIcon = info.icon;
                        return (
                          <div key={key} className="flex flex-col items-center gap-1">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center`}>
                              <VIcon className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-dark-500 font-medium uppercase">{key.slice(0, 1)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={startVark}
                      disabled={varkLoading}
                      className="btn-gradient px-8 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {varkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {varkLoading ? "Loading..." : "Start Assessment"}
                    </button>
                  </div>
                ) : (
                  /* Questions */
                  <div className="p-6">
                    {/* Progress */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400 mb-2">
                      <span>Question {varkStep + 1} of {varkQuestions.length}</span>
                      <span>{Math.round(((varkStep + 1) / varkQuestions.length) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-6">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                        animate={{ width: `${((varkStep + 1) / varkQuestions.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={varkStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="text-gray-900 dark:text-white font-semibold text-base mb-5 leading-relaxed">
                          {varkQuestions[varkStep].text}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {varkQuestions[varkStep].options.map((opt) => {
                            const info = VARK_INFO[opt.value];
                            const VIcon = info?.icon || Brain;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleVarkAnswer(opt.value)}
                                className="group text-left p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-900/40 hover:border-purple-300 dark:hover:border-accent-purple/30 hover:bg-purple-50 dark:hover:bg-accent-purple/5 transition-all"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 group-hover:bg-purple-100 dark:group-hover:bg-accent-purple/10 transition-colors shrink-0 mt-0.5">
                                    <VIcon className="w-4 h-4 text-gray-400 dark:text-dark-400 group-hover:text-purple-600 dark:group-hover:text-accent-purple transition-colors" />
                                  </div>
                                  <span className="text-sm text-gray-700 dark:text-dark-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                    {opt.text}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            ) : varkResult && !learningStyle ? (
              /* VARK Result */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-8 text-center shadow-sm dark:shadow-none"
              >
                {(() => {
                  const info = VARK_INFO[varkResult];
                  const VIcon = info?.icon || Brain;
                  return (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1 }}
                        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${info?.color || "from-indigo-500 to-purple-600"} flex items-center justify-center mx-auto mb-4`}
                      >
                        <VIcon className="w-10 h-10 text-white" />
                      </motion.div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {info?.label || varkResult}
                      </h3>
                      <p className="text-gray-500 dark:text-dark-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                        Your learning style has been identified! SmartBuddy will now tailor study recommendations to match your preferences.
                      </p>
                      <button
                        onClick={finishVark}
                        className="btn-gradient px-8 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        View My Recommendations
                      </button>
                    </>
                  );
                })()}
              </motion.div>
            ) : (
              /* ── Guide Content (VARK completed) ── */
              <>
                {/* Inline loading */}
                {(loading || refreshing) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-8 shadow-sm dark:shadow-none"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative w-12 h-12 shrink-0">
                        <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-accent-blue/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 dark:border-t-accent-blue animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Brain className="w-5 h-5 text-blue-600 dark:text-accent-blue" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-gray-900 dark:text-white font-semibold">SmartBuddy is thinking...</h3>
                        <p className="text-gray-500 dark:text-dark-400 text-sm">
                          Analyzing your courses, timetable, and progress to create personalized recommendations.
                        </p>
                      </div>
                    </div>
                    {/* Skeleton cards */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-dark-900/30 p-5 animate-pulse">
                          <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/3 mb-3" />
                          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full mb-1" />
                          <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Error state */}
                {error && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-8 text-center"
                  >
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-red-500 dark:text-red-400" />
                    </div>
                    <p className="text-red-600 dark:text-red-400 mb-1 font-medium">
                      Failed to load recommendations
                    </p>
                    <p className="text-gray-500 dark:text-dark-400 text-sm mb-4">{error}</p>
                    <button
                      onClick={() => fetchGuide()}
                      className="btn-gradient px-5 py-2 rounded-xl text-sm font-medium"
                    >
                      Try again
                    </button>
                  </motion.div>
                )}

                {/* Guide content */}
                {!loading && !error && guide && (
                  <>
                    {/* Summary bar */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-dark-800/40 border border-gray-200 dark:border-white/5"
                    >
                      <div className="flex-1">
                        <p className="text-gray-500 dark:text-dark-400 text-sm">{getGreeting()}</p>
                        <p className="text-gray-900 dark:text-white font-semibold text-lg">
                          {getTodayDate()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Learning style badge */}
                        {learningStyle && VARK_INFO[learningStyle] && (() => {
                          const info = VARK_INFO[learningStyle];
                          const VIcon = info.icon;
                          return (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-accent-purple/10 text-purple-700 dark:text-accent-purple border border-purple-200 dark:border-accent-purple/20 font-medium">
                              <VIcon className="w-3 h-3" />
                              {info.label}
                            </span>
                          );
                        })()}
                        <span className="text-sm text-gray-500 dark:text-dark-300">
                          {sorted.length} task{sorted.length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          {highCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                              <Flame className="w-3 h-3" />
                              {highCount}
                            </span>
                          )}
                          {medCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <TrendingUp className="w-3 h-3" />
                              {medCount}
                            </span>
                          )}
                          {lowCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {lowCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Motivational banner */}
                    {guide.motivational_message && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-purple-50 dark:from-accent-purple/10 via-blue-50 dark:via-accent-blue/10 to-cyan-50 dark:to-accent-cyan/10 border border-gray-200 dark:border-white/5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-accent-amber/15 shrink-0">
                            <Sparkles className="w-5 h-5 text-amber-600 dark:text-accent-amber" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-amber-600 dark:text-accent-amber uppercase tracking-wider mb-1">
                              Daily Motivation
                            </p>
                            <p className="text-gray-700 dark:text-dark-200 leading-relaxed text-sm">
                              {guide.motivational_message}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Daily schedule summary */}
                    {guide.daily_schedule_summary && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-cyan-50 dark:from-accent-cyan/10 to-blue-50 dark:to-accent-blue/10 border border-gray-200 dark:border-white/5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-xl bg-cyan-100 dark:bg-accent-cyan/15 shrink-0">
                            <Calendar className="w-5 h-5 text-cyan-600 dark:text-accent-cyan" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-cyan-600 dark:text-accent-cyan uppercase tracking-wider mb-1">
                              Today&apos;s Schedule Plan
                            </p>
                            <p className="text-gray-700 dark:text-dark-200 leading-relaxed text-sm">
                              {guide.daily_schedule_summary}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Section header */}
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600 dark:text-accent-blue" />
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Today&apos;s Focus
                      </h2>
                    </div>

                    {/* Recommendation cards */}
                    {sorted.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-12 text-center"
                      >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          All caught up!
                        </h3>
                        <p className="text-gray-500 dark:text-dark-400 text-sm max-w-sm mx-auto">
                          No specific recommendations for today. Great job staying on track!
                        </p>
                      </motion.div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {sorted.map((rec, idx) => (
                          <RecommendationCard key={idx} rec={rec} idx={idx} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        ) : (
          /* ── Timetable Tab ── */
          <motion.div
            key="timetable"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* ── Upload / Input Card ── */}
            <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-accent-purple/15">
                  <Calendar className="w-5 h-5 text-purple-600 dark:text-accent-purple" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Timetable Analysis
                  </h2>
                  <p className="text-gray-500 dark:text-dark-400 text-sm">
                    Upload a PDF or paste your timetable to extract your class schedule
                  </p>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-dark-900/60 border border-gray-200 dark:border-white/10 w-fit mb-5">
                <button
                  onClick={() => setTimetableMode("pdf")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timetableMode === "pdf"
                      ? "bg-purple-100 dark:bg-accent-purple/20 text-purple-700 dark:text-accent-purple shadow-sm dark:shadow-none"
                      : "text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload PDF
                </button>
                <button
                  onClick={() => setTimetableMode("text")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timetableMode === "text"
                      ? "bg-purple-100 dark:bg-accent-purple/20 text-purple-700 dark:text-accent-purple shadow-sm dark:shadow-none"
                      : "text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Paste Text
                </button>
              </div>

              {timetableMode === "pdf" ? (
                <div className="mb-5">
                  {!pdfFile ? (
                    <label
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handlePdfDrop}
                      className={`flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                        dragOver
                          ? "border-purple-500 dark:border-accent-purple bg-purple-50 dark:bg-accent-purple/10"
                          : "border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-dark-900/40 hover:border-purple-300 dark:hover:border-accent-purple/30 hover:bg-purple-50/50 dark:hover:bg-dark-900/60"
                      }`}
                    >
                      <div className={`p-4 rounded-2xl transition-colors ${dragOver ? "bg-purple-100 dark:bg-accent-purple/20" : "bg-gray-100 dark:bg-white/5"}`}>
                        <Upload className={`w-10 h-10 ${dragOver ? "text-purple-600 dark:text-accent-purple" : "text-gray-400 dark:text-dark-400"}`} />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-700 dark:text-dark-200 font-medium">
                          Drop your timetable PDF here
                        </p>
                        <p className="text-gray-400 dark:text-dark-500 text-sm mt-1">
                          or click to browse &middot; PDF only &middot; Max 5MB
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfSelect}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-50 dark:bg-accent-purple/5 border border-purple-200 dark:border-accent-purple/20">
                      <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-accent-purple/15">
                        <FileText className="w-5 h-5 text-purple-600 dark:text-accent-purple" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 dark:text-dark-100 text-sm font-medium truncate">{pdfFile.name}</p>
                        <p className="text-gray-500 dark:text-dark-400 text-xs">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        onClick={() => { setPdfFile(null); setAnalysis(null); }}
                        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400 dark:text-dark-400" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={timetableText}
                  onChange={(e) => setTimetableText(e.target.value)}
                  placeholder={"Paste your timetable here...\n\nExample:\nMonday 8:00-10:00 Mathematics (Room 301)\nMonday 14:00-16:00 Physics (Lab 2)\nTuesday 10:00-12:00 Computer Science (Room 105)"}
                  rows={7}
                  className="w-full rounded-xl p-4 text-sm resize-none mb-5 bg-gray-50 dark:bg-dark-900/60 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:border-purple-400 dark:focus:border-accent-purple/40 focus:outline-none focus:ring-1 focus:ring-purple-200 dark:focus:ring-accent-purple/20 transition-all"
                />
              )}

              {/* Loading popup */}
              <AnimatePresence>
                {analyzing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
                    >
                      <div className="relative w-16 h-16 mx-auto mb-5">
                        <div className="absolute inset-0 rounded-full border-2 border-purple-200 dark:border-accent-purple/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-600 dark:border-t-accent-purple animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Calendar className="w-7 h-7 text-purple-600 dark:text-accent-purple" />
                        </div>
                      </div>
                      <h3 className="text-gray-900 dark:text-white text-lg font-semibold mb-2">
                        {timetableMode === "pdf" ? "Scanning PDF..." : "Extracting schedule..."}
                      </h3>
                      <p className="text-gray-500 dark:text-dark-300 text-sm leading-relaxed mb-4">
                        {timetableMode === "pdf"
                          ? "Reading your PDF and extracting class schedule data."
                          : "Parsing your timetable and extracting class schedule data."}
                      </p>
                      <div className="flex items-center justify-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-purple-600 dark:bg-accent-purple"
                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || (timetableMode === "text" ? !timetableText.trim() : !pdfFile)}
                  className="btn-gradient flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {analyzing ? "Extracting..." : "Extract Schedule"}
                </button>
                {((timetableMode === "text" && timetableText.trim()) || (timetableMode === "pdf" && pdfFile)) && !analyzing && (
                  <button
                    onClick={() => { setTimetableText(""); setPdfFile(null); setAnalysis(null); }}
                    className="text-gray-400 dark:text-dark-400 hover:text-gray-600 dark:hover:text-dark-200 text-sm transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {analysisError && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-3">{analysisError}</p>
              )}
            </div>

            {/* ── Extracted Results ── */}
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Schedule table */}
                {analysis.parsed_schedule.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-cyan-600 dark:text-accent-cyan" />
                      Extracted Schedule
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-dark-900/40">
                            <th className="text-left py-3 px-4 text-gray-500 dark:text-dark-400 font-medium text-xs uppercase tracking-wider">Day</th>
                            <th className="text-left py-3 px-4 text-gray-500 dark:text-dark-400 font-medium text-xs uppercase tracking-wider">Time</th>
                            <th className="text-left py-3 px-4 text-gray-500 dark:text-dark-400 font-medium text-xs uppercase tracking-wider">Subject</th>
                            <th className="text-left py-3 px-4 text-gray-500 dark:text-dark-400 font-medium text-xs uppercase tracking-wider">Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortSchedule(analysis.parsed_schedule).map((day, di) =>
                            day.classes.map((cls, ci) => (
                              <tr key={`${di}-${ci}`} className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                {ci === 0 && (
                                  <td rowSpan={day.classes.length} className="py-3 px-4 text-gray-900 dark:text-white font-semibold align-top border-r border-gray-100 dark:border-white/5">
                                    {day.day}
                                  </td>
                                )}
                                <td className="py-3 px-4 text-gray-700 dark:text-dark-200 font-mono text-xs">{cls.time}</td>
                                <td className="py-3 px-4 text-gray-700 dark:text-dark-200">{cls.subject}</td>
                                <td className="py-3 px-4 text-gray-500 dark:text-dark-400">
                                  {cls.location && (
                                    <span className="flex items-center gap-1.5">
                                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                                      {cls.location}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recommended study times */}
                {analysis.recommended_study_times && analysis.recommended_study_times.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-gray-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-accent-blue" />
                      Recommended Study Times
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sortStudyTimes(analysis.recommended_study_times).map((slot, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-xl border border-blue-200 dark:border-accent-blue/10 bg-blue-50 dark:bg-accent-blue/5 p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-900 dark:text-white font-medium text-sm">{slot.day}</span>
                            <span className="text-blue-600 dark:text-accent-blue text-xs font-mono bg-blue-100 dark:bg-accent-blue/10 px-2 py-0.5 rounded">
                              {slot.time}
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-dark-300 text-sm leading-relaxed">{slot.reason}</p>
                          <div className="flex items-center gap-1.5 mt-3 text-gray-400 dark:text-dark-400 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            {slot.duration_minutes} minutes
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save section */}
                <div className="rounded-2xl border border-purple-200 dark:border-accent-purple/10 bg-purple-50 dark:bg-accent-purple/5 p-6">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-2 flex items-center gap-2">
                    <Save className="w-5 h-5 text-purple-600 dark:text-accent-purple" />
                    Save Timetable
                  </h3>
                  <p className="text-gray-500 dark:text-dark-400 text-sm mb-4">
                    Label this timetable with your semester so the Daily Guide can use it for recommendations.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={semesterLabel}
                      onChange={(e) => setSemesterLabel(e.target.value)}
                      placeholder="e.g. Semester 6 2025/2026"
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-dark-900/60 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-dark-100 placeholder-gray-400 dark:placeholder-dark-500 focus:border-purple-400 dark:focus:border-accent-purple/40 focus:outline-none focus:ring-1 focus:ring-purple-200 dark:focus:ring-accent-purple/20 transition-all"
                    />
                    <button
                      onClick={handleSaveTimetable}
                      disabled={saving || !semesterLabel.trim()}
                      className="btn-gradient flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 whitespace-nowrap"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? "Saving..." : "Save Timetable"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Saved Timetables ── */}
            <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-dark-800/30 p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-gray-900 dark:text-white font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600 dark:text-accent-purple" />
                  Saved Timetables
                </h3>
                <span className="text-xs font-medium text-gray-400 dark:text-dark-500 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
                  {savedTimetables.length} saved
                </span>
              </div>
              <p className="text-gray-500 dark:text-dark-400 text-sm mb-5">
                These timetables are used by the Daily Guide and Smart Buddy for personalized recommendations.
              </p>

              {loadingSaved ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-purple-600 dark:text-accent-purple animate-spin" />
                </div>
              ) : savedTimetables.length === 0 ? (
                <div className="text-center py-10 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/5">
                  <Calendar className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-dark-400 text-sm font-medium">No timetables saved yet</p>
                  <p className="text-gray-400 dark:text-dark-500 text-xs mt-1">Upload and extract a timetable above, then save it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTimetables.map((tt, i) => {
                    const totalClasses = tt.parsed_schedule.reduce((sum, d) => sum + d.classes.length, 0);
                    const dayNames = tt.parsed_schedule.map((d) => d.day.slice(0, 3)).join(", ");
                    return (
                      <motion.div
                        key={tt.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-dark-900/40 hover:bg-gray-100 dark:hover:bg-dark-900/60 transition-all"
                      >
                        <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-accent-purple/10 shrink-0">
                          <Calendar className="w-5 h-5 text-purple-600 dark:text-accent-purple" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-white font-medium text-sm truncate">{tt.semester_label}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-dark-400">
                              <ClipboardList className="w-3 h-3" />
                              {totalClasses} classes
                            </span>
                            <span className="text-gray-300 dark:text-dark-600">&middot;</span>
                            <span className="text-xs text-gray-500 dark:text-dark-400">{dayNames}</span>
                            {tt.created_at && (
                              <>
                                <span className="text-gray-300 dark:text-dark-600">&middot;</span>
                                <span className="text-xs text-gray-400 dark:text-dark-500">
                                  {new Date(tt.created_at).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTimetable(tt.id)}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:text-dark-400 dark:hover:text-red-400 transition-all shrink-0"
                          title="Remove timetable"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
