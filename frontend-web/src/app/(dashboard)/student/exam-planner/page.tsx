"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  aiStudyPlanApi,
  coursesApi,
  CourseOut,
  ExamPlan,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Calendar,
  Clock,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Search,
  Brain,
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react";

interface ExamEntry {
  course_id: string;
  course_name: string;
  exam_date: string;
  topics: string[];
  topicsText: string;
}

const courseColors = [
  "border-l-accent-blue",
  "border-l-accent-purple",
  "border-l-accent-cyan",
  "border-l-accent-pink",
  "border-l-accent-emerald",
  "border-l-accent-amber",
];

export default function ExamPlannerPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Form state
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [exams, setExams] = useState<ExamEntry[]>([]);

  // Custom dropdown state
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const courseSearchRef = useRef<HTMLInputElement>(null);

  // Custom date picker state
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setCourseDropdownOpen(false);
        setCourseSearch("");
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Plan generation state
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [generatedPlan, setGeneratedPlan] = useState<ExamPlan | null>(null);
  const [generateError, setGenerateError] = useState("");

  const generatingSteps = [
    { icon: Brain, label: "Analyzing your exams & topics..." },
    { icon: Target, label: "Calculating optimal study schedule..." },
    { icon: Calendar, label: "Building your daily plan..." },
    { icon: Lightbulb, label: "Generating personalized tips..." },
    { icon: Sparkles, label: "Finalizing your study plan..." },
  ];

  // Saved plans state
  const [savedPlans, setSavedPlans] = useState<ExamPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [c, p] = await Promise.all([
          coursesApi.enrolled(),
          aiStudyPlanApi.getExamPlans(),
        ]);
        setCourses(c);
        setSavedPlans(p);
      } catch {
        // silent
      } finally {
        setLoadingCourses(false);
        setLoadingPlans(false);
      }
    };
    load();
  }, [user]);

  const handleAddExam = () => {
    if (!selectedCourseId || !examDate || !topicsText.trim()) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;

    const topics = topicsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setExams((prev) => [
      ...prev,
      {
        course_id: course.id,
        course_name: course.course_name,
        exam_date: examDate,
        topics,
        topicsText,
      },
    ]);
    setSelectedCourseId("");
    setExamDate("");
    setTopicsText("");
  };

  const handleRemoveExam = (idx: number) => {
    setExams((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (exams.length === 0) return;
    setGenerating(true);
    setGeneratingStep(0);
    setGenerateError("");
    setGeneratedPlan(null);

    // Cycle through steps while waiting for the API
    const stepInterval = setInterval(() => {
      setGeneratingStep((prev) => (prev < generatingSteps.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const payload = exams.map(({ course_id, course_name, exam_date, topics }) => ({
        course_id,
        course_name,
        exam_date,
        topics,
      }));
      const plan = await aiStudyPlanApi.createExamPlan(payload);
      clearInterval(stepInterval);
      setGeneratedPlan(plan);
      const plans = await aiStudyPlanApi.getExamPlans();
      setSavedPlans(plans);
    } catch (err) {
      clearInterval(stepInterval);
      setGenerateError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
      setGeneratingStep(0);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setDeletingPlan(planId);
    try {
      await aiStudyPlanApi.deleteExamPlan(planId);
      setSavedPlans((prev) => prev.filter((p) => p.id !== planId));
      if (expandedPlan === planId) setExpandedPlan(null);
    } catch {
      // silent
    } finally {
      setDeletingPlan(null);
    }
  };

  // Calendar helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const formatDate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const displayDate = examDate
    ? new Date(examDate + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const getCourseColor = (courseName: string, planExams?: ExamPlan["exams"]) => {
    const names = planExams
      ? planExams.map((e) => e.course_name)
      : exams.map((e) => e.course_name);
    const unique = [...new Set(names)];
    const idx = unique.indexOf(courseName);
    return courseColors[idx >= 0 ? idx % courseColors.length : 0];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Exam Planner</h1>
        <p className="text-dark-300 mt-1">
          Add your upcoming exams and let AI generate a personalized study plan
        </p>
      </motion.div>

      {/* Add Exam Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-accent-blue" />
          Add Exam
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div ref={courseDropdownRef} className="relative">
            <label className="block text-sm text-dark-300 mb-1.5">Course</label>
            <button
              type="button"
              onClick={() => {
                if (loadingCourses) return;
                setCourseDropdownOpen((v) => {
                  if (!v) setTimeout(() => courseSearchRef.current?.focus(), 50);
                  else setCourseSearch("");
                  return !v;
                });
              }}
              disabled={loadingCourses}
              className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between gap-2"
            >
              <span className={selectedCourseId ? "text-white" : "text-white/30"}>
                {loadingCourses
                  ? "Loading courses..."
                  : courses.find((c) => c.id === selectedCourseId)?.course_name || "Select a course"}
              </span>
              <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transition-transform ${courseDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {courseDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-50 mt-1.5 w-full rounded-xl border border-white/10 bg-dark-800 shadow-xl shadow-black/30 overflow-hidden course-dropdown"
                >
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                    <Search className="w-3.5 h-3.5 text-dark-400 shrink-0" />
                    <input
                      ref={courseSearchRef}
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search courses..."
                      className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none course-search-input"
                    />
                  </div>
                  <ul className="max-h-44 overflow-y-auto py-1">
                    {courses.length === 0 ? (
                      <li className="px-4 py-2.5 text-sm text-dark-400">No enrolled courses</li>
                    ) : (
                      courses
                        .filter((c) => c.course_name.toLowerCase().includes(courseSearch.toLowerCase()))
                        .map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourseId(c.id);
                                setCourseDropdownOpen(false);
                                setCourseSearch("");
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 ${
                                selectedCourseId === c.id ? "text-accent-blue bg-white/5" : "text-white"
                              }`}
                            >
                              {c.course_name}
                            </button>
                          </li>
                        ))
                    )}
                    {courses.length > 0 && courses.filter((c) => c.course_name.toLowerCase().includes(courseSearch.toLowerCase())).length === 0 && (
                      <li className="px-4 py-2.5 text-sm text-dark-400">No matching courses</li>
                    )}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div ref={datePickerRef} className="relative">
            <label className="block text-sm text-dark-300 mb-1.5">Exam Date</label>
            <button
              type="button"
              onClick={() => {
                if (!datePickerOpen && examDate) {
                  const d = new Date(examDate + "T00:00");
                  setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
                }
                setDatePickerOpen((v) => !v);
              }}
              className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between gap-2"
            >
              <span className={examDate ? "text-white" : "text-white/30"}>
                {displayDate || "Select a date"}
              </span>
              <Calendar className="w-4 h-4 text-white/50 shrink-0" />
            </button>
            <AnimatePresence>
              {datePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-50 mt-1.5 w-72 rounded-xl border border-white/10 bg-dark-800 shadow-xl shadow-black/30 p-3 exam-date-picker"
                >
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth((p) =>
                          p.month === 0
                            ? { year: p.year - 1, month: 11 }
                            : { ...p, month: p.month - 1 }
                        )
                      }
                      className="p-1 rounded-lg hover:bg-white/10 text-dark-300 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-white">
                      {monthNames[calendarMonth.month]} {calendarMonth.year}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth((p) =>
                          p.month === 11
                            ? { year: p.year + 1, month: 0 }
                            : { ...p, month: p.month + 1 }
                        )
                      }
                      className="p-1 rounded-lg hover:bg-white/10 text-dark-300 hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Day labels */}
                  <div className="grid grid-cols-7 mb-1">
                    {dayLabels.map((d) => (
                      <span key={d} className="text-center text-[10px] font-medium text-dark-400 py-1">
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstDayOfMonth(calendarMonth.year, calendarMonth.month) }).map((_, i) => (
                      <span key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth(calendarMonth.year, calendarMonth.month) }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = formatDate(calendarMonth.year, calendarMonth.month, day);
                      const isSelected = examDate === dateStr;
                      const isToday = dateStr === new Date().toISOString().split("T")[0];
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setExamDate(dateStr);
                            setDatePickerOpen(false);
                          }}
                          className={`w-8 h-8 mx-auto rounded-lg text-xs font-medium transition-colors flex items-center justify-center
                            ${isSelected
                              ? "bg-accent-blue text-white"
                              : isToday
                                ? "bg-white/10 text-accent-blue"
                                : "text-dark-200 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label className="block text-sm text-dark-300 mb-1.5">Topics (comma-separated)</label>
            <input
              type="text"
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              placeholder="e.g. Sorting, Trees, Graphs"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleAddExam}
          disabled={!selectedCourseId || !examDate || !topicsText.trim()}
          className="mt-4 btn-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Exam
        </button>
      </motion.div>

      {/* Added Exams */}
      {exams.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h2 className="text-lg font-semibold text-white">
            Exams to Plan ({exams.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-dark-800/50 border border-white/10 rounded-2xl p-4 border-l-4 ${getCourseColor(exam.course_name)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium text-sm">{exam.course_name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-dark-400 text-xs">
                      <Calendar className="w-3 h-3" />
                      {exam.exam_date}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveExam(idx)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-dark-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {exam.topics.map((topic, ti) => (
                    <span
                      key={ti}
                      className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-dark-200"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-gradient flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Generate Study Plan"}
          </button>

          {generateError && (
            <p className="text-red-400 text-sm">{generateError}</p>
          )}
        </motion.div>
      )}

      {/* AI Generating Progress */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-6 overflow-hidden relative"
          >
            {/* Animated gradient bg */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-r from-accent-blue via-accent-purple to-accent-cyan animate-pulse" />
            </div>

            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-accent-blue animate-pulse" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">AI is crafting your study plan</h3>
                  <p className="text-dark-400 text-xs">Analyzing {exams.length} exam{exams.length > 1 ? "s" : ""} across {new Set(exams.map(e => e.course_name)).size} course{new Set(exams.map(e => e.course_name)).size > 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Progress steps */}
              <div className="space-y-3">
                {generatingSteps.map((step, i) => {
                  const StepIcon = step.icon;
                  const isActive = i === generatingStep;
                  const isDone = i < generatingStep;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: isDone || isActive ? 1 : 0.3, x: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.3 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                        isDone
                          ? "bg-emerald-500/20"
                          : isActive
                            ? "bg-accent-blue/20"
                            : "bg-white/5"
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isActive ? (
                          <StepIcon className="w-3.5 h-3.5 text-accent-blue animate-pulse" />
                        ) : (
                          <StepIcon className="w-3.5 h-3.5 text-dark-500" />
                        )}
                      </div>
                      <span className={`text-sm transition-colors duration-300 ${
                        isDone ? "text-emerald-400" : isActive ? "text-white" : "text-dark-500"
                      }`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <Loader2 className="w-3 h-3 text-accent-blue animate-spin ml-auto" />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-purple"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((generatingStep + 1) / generatingSteps.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated Plan */}
      {generatedPlan && !generating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Plan header */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Your Study Plan</h2>
                  <p className="text-dark-400 text-xs mt-0.5">
                    {generatedPlan.plan.length} day{generatedPlan.plan.length !== 1 ? "s" : ""} &middot;{" "}
                    {generatedPlan.plan.reduce((sum, d) => sum + d.sessions.length, 0)} sessions &middot;{" "}
                    {generatedPlan.plan.reduce((sum, d) => sum + d.sessions.reduce((s, sess) => s + sess.duration_minutes, 0), 0)} min total
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(generatedPlan.exams || []).map((e, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                  >
                    {e.course_name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-accent-blue/40 via-accent-purple/40 to-accent-blue/10" />

            <div className="space-y-4">
              {generatedPlan.plan.map((day, di) => {
                const totalMinutes = day.sessions.reduce((s, sess) => s + sess.duration_minutes, 0);
                return (
                  <motion.div
                    key={di}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: di * 0.07 }}
                    className="relative pl-12"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-3 top-5 w-5 h-5 rounded-full bg-dark-800 border-2 border-accent-blue flex items-center justify-center z-10">
                      <span className="w-2 h-2 rounded-full bg-accent-blue" />
                    </div>

                    <div className="bg-dark-800/50 border border-white/10 rounded-2xl overflow-hidden">
                      {/* Day header */}
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2.5">
                          <Calendar className="w-4 h-4 text-accent-blue" />
                          <span className="text-white font-semibold text-sm">{day.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-dark-400 text-xs">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {day.sessions.length} session{day.sessions.length !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {totalMinutes >= 60
                              ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ""}`
                              : `${totalMinutes}m`}
                          </span>
                        </div>
                      </div>

                      {/* Sessions */}
                      <div className="p-3 space-y-2">
                        {day.sessions.map((session, si) => (
                          <motion.div
                            key={si}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: di * 0.07 + si * 0.03 }}
                            className={`flex items-stretch gap-3 p-3 rounded-xl bg-dark-900/40 border-l-3 ${getCourseColor(session.course, generatedPlan.exams || [])} group hover:bg-dark-900/60 transition-colors`}
                          >
                            {/* Duration badge */}
                            <div className="flex flex-col items-center justify-center shrink-0 w-14 rounded-lg bg-white/5 py-1.5">
                              <Clock className="w-3 h-3 text-dark-400 mb-0.5" />
                              <span className="text-white text-xs font-semibold">{session.duration_minutes}m</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent-blue/10 text-accent-blue font-medium">
                                  {session.course}
                                </span>
                              </div>
                              <p className="text-white text-sm font-medium leading-snug">{session.topic}</p>
                              <p className="text-dark-300 text-xs mt-1 leading-relaxed">{session.activity}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Tips */}
          {generatedPlan.tips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-amber/20 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-accent-amber" />
                </div>
                <h3 className="text-white font-semibold text-sm">Study Tips</h3>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {generatedPlan.tips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/10"
                  >
                    <span className="w-5 h-5 rounded-md bg-accent-amber/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-accent-amber text-xs font-bold">{i + 1}</span>
                    </span>
                    <p className="text-dark-200 text-sm leading-relaxed">{tip}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* My Plans */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-purple/20 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-accent-purple" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">My Plans</h2>
              {!loadingPlans && savedPlans.length > 0 && (
                <p className="text-dark-400 text-xs">{savedPlans.length} saved plan{savedPlans.length !== 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
        </div>

        {loadingPlans ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-dark-800/50 animate-pulse" />
            ))}
          </div>
        ) : savedPlans.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-dark-700/50 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-7 h-7 text-dark-400" />
            </div>
            <h3 className="text-white font-medium mb-1">No study plans yet</h3>
            <p className="text-dark-400 text-sm">Add your exams above and generate your first AI-powered study plan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedPlans.map((plan, planIdx) => {
              const isExpanded = expandedPlan === plan.id;
              const totalSessions = plan.plan.reduce((sum, d) => sum + d.sessions.length, 0);
              const totalMinutes = plan.plan.reduce((sum, d) => sum + d.sessions.reduce((s, sess) => s + sess.duration_minutes, 0), 0);
              const planExams = plan.exams || [];
              const accentColors = ["from-accent-blue to-accent-cyan", "from-accent-purple to-accent-pink", "from-accent-emerald to-accent-cyan", "from-accent-amber to-accent-pink"];
              const accent = accentColors[planIdx % accentColors.length];

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: planIdx * 0.05 }}
                  className="bg-dark-800/50 border border-white/10 rounded-2xl overflow-hidden"
                >
                  {/* Card header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedPlan(isExpanded ? null : plan.id); }}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    {/* Accent icon */}
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shrink-0 opacity-90`}>
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {planExams.map((e, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-white font-medium"
                          >
                            {e.course_name}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-dark-400 text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {plan.plan.length} day{plan.plan.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {totalSessions} session{totalSessions !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {totalMinutes >= 60
                            ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ""}`
                            : `${totalMinutes}m`}
                        </span>
                        {plan.created_at && (
                          <>
                            <span className="text-dark-500">|</span>
                            <span>{new Date(plan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id);
                        }}
                        disabled={deletingPlan === plan.id}
                        className="p-2 rounded-lg hover:bg-white/10 text-dark-500 hover:text-red-400 transition-colors"
                      >
                        {deletingPlan === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <div className={`p-1.5 rounded-lg text-dark-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-white/5">
                          {/* Mini timeline */}
                          <div className="relative pt-4">
                            <div className="absolute left-[18px] top-8 bottom-4 w-px bg-gradient-to-b from-accent-blue/30 to-transparent" />

                            <div className="space-y-4">
                              {plan.plan.map((day, di) => {
                                const dayMinutes = day.sessions.reduce((s, sess) => s + sess.duration_minutes, 0);
                                return (
                                  <div key={di} className="relative pl-10">
                                    {/* Dot */}
                                    <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-dark-800 border-2 border-accent-blue z-10" />

                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-white text-sm font-medium flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 text-accent-blue" />
                                          {day.date}
                                        </h4>
                                        <span className="text-dark-500 text-[10px] flex items-center gap-1">
                                          <Clock className="w-2.5 h-2.5" />
                                          {dayMinutes >= 60
                                            ? `${Math.floor(dayMinutes / 60)}h ${dayMinutes % 60 > 0 ? `${dayMinutes % 60}m` : ""}`
                                            : `${dayMinutes}m`}
                                        </span>
                                      </div>

                                      <div className="space-y-1.5">
                                        {day.sessions.map((s, si) => (
                                          <div
                                            key={si}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-900/40 border-l-2 ${getCourseColor(s.course, planExams)}`}
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-accent-blue font-medium">
                                                  {s.course}
                                                </span>
                                                <span className="text-white text-xs font-medium truncate">{s.topic}</span>
                                              </div>
                                              {s.activity && (
                                                <p className="text-dark-400 text-[11px] mt-0.5 truncate">{s.activity}</p>
                                              )}
                                            </div>
                                            <span className="text-dark-500 text-[10px] font-medium shrink-0">{s.duration_minutes}m</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Tips */}
                          {plan.tips.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-white/5">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Lightbulb className="w-3.5 h-3.5 text-accent-amber" />
                                <span className="text-white text-xs font-medium">Tips</span>
                              </div>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {plan.tips.map((tip, i) => (
                                  <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-accent-amber/5">
                                    <span className="text-accent-amber text-[10px] font-bold mt-px">{i + 1}.</span>
                                    <p className="text-dark-300 text-[11px] leading-relaxed">{tip}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
