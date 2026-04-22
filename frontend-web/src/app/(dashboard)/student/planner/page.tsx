"use client";

import { useState, useEffect, useMemo } from "react";
import { remindersApi, assignmentsApi, progressApi, ReminderOut, AssignmentOut, CalendarEventOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, ChevronLeft, ChevronRight, AlertCircle, BookOpen,
  ExternalLink, FileText, GraduationCap, Brain, User, Zap, Minus,
  ArrowDown, CalendarDays, RotateCcw, HelpCircle, Bell, CheckCircle,
  ListTodo, Clock, CalendarCheck, Sparkles, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORIES = [
  { value: "Assignment", icon: FileText, color: "text-accent-blue", bg: "bg-accent-blue/10", activeBg: "bg-accent-blue/20 ring-2 ring-accent-blue/40" },
  { value: "Exam", icon: GraduationCap, color: "text-red-400", bg: "bg-red-500/10", activeBg: "bg-red-500/20 ring-2 ring-red-500/40" },
  { value: "Study", icon: Brain, color: "text-accent-purple", bg: "bg-accent-purple/10", activeBg: "bg-accent-purple/20 ring-2 ring-accent-purple/40" },
  { value: "Revision", icon: RotateCcw, color: "text-accent-cyan", bg: "bg-accent-cyan/10", activeBg: "bg-accent-cyan/20 ring-2 ring-accent-cyan/40" },
  { value: "Personal", icon: User, color: "text-accent-emerald", bg: "bg-accent-emerald/10", activeBg: "bg-accent-emerald/20 ring-2 ring-accent-emerald/40" },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgent", icon: Zap, color: "text-red-400", bg: "bg-red-500/10", activeBg: "bg-red-500/20 ring-2 ring-red-500/40" },
  { value: "normal", label: "Normal", icon: Minus, color: "text-accent-blue", bg: "bg-accent-blue/10", activeBg: "bg-accent-blue/20 ring-2 ring-accent-blue/40" },
  { value: "low", label: "Low", icon: ArrowDown, color: "text-gray-400 dark:text-dark-300", bg: "bg-gray-100 dark:bg-white/5", activeBg: "bg-gray-200 dark:bg-white/10 ring-2 ring-gray-300 dark:ring-white/20" },
];

const categoryIcons: Record<string, { icon: typeof FileText; color: string }> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, { icon: c.icon, color: c.color }])
);

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border border-red-500/20",
  normal: "bg-accent-blue/15 text-accent-blue border border-accent-blue/20",
  low: "bg-gray-200 dark:bg-dark-500 text-gray-600 dark:text-dark-200 border border-gray-300 dark:border-white/5",
};

const eventTypeColors: Record<string, { bg: string; text: string; icon: typeof FileText; dotColor: string }> = {
  assignment: { bg: "bg-accent-blue/10", text: "text-accent-blue", icon: FileText, dotColor: "bg-accent-blue" },
  quiz: { bg: "bg-accent-purple/10", text: "text-accent-purple", icon: HelpCircle, dotColor: "bg-accent-purple" },
  reminder: { bg: "bg-accent-amber/10", text: "text-accent-amber", icon: Bell, dotColor: "bg-accent-amber" },
  class: { bg: "bg-accent-emerald/10", text: "text-accent-emerald", icon: GraduationCap, dotColor: "bg-accent-emerald" },
  study_time: { bg: "bg-accent-cyan/10", text: "text-accent-cyan", icon: Brain, dotColor: "bg-accent-cyan" },
  study_plan: { bg: "bg-accent-pink/10", text: "text-accent-pink", icon: Sparkles, dotColor: "bg-accent-pink" },
};

export default function PlannerPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ReminderOut[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", type: "Assignment", priority: "normal" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dueAssignments, setDueAssignments] = useState<(AssignmentOut & { course_name: string; submitted: boolean })[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventOut[]>([]);
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    setLoadingEvents(true);
    setLoadingAssignments(true);
    progressApi.calendar().then(setCalendarEvents).catch(() => {}).finally(() => setLoadingEvents(false));
    assignmentsApi.myUpcoming().then(setDueAssignments).catch(() => {}).finally(() => setLoadingAssignments(false));
  }, [user]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventOut[]> = {};
    calendarEvents.forEach(e => {
      const d = e.date.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [calendarEvents]);

  const selectedDateEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  // Stats
  const todayEvents = eventsByDate[today] || [];
  const upcomingEvents = calendarEvents.filter(e => e.date >= today && !e.is_completed);
  const pendingAssignments = dueAssignments.filter(a => !a.submitted).length;

  useEffect(() => {
    if (!selectedDate || !user) return;
    remindersApi.list(selectedDate).then(setTasks);
  }, [selectedDate, user]);

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !selectedDate || !user) return;
    const created = await remindersApi.create({
      date: selectedDate,
      title: newTask.title,
      type: newTask.type,
      priority: newTask.priority,
    });
    setTasks(prev => [...prev, created]);
    setShowAdd(false);
    setNewTask({ title: "", type: "Assignment", priority: "normal" });
  };

  const toggleComplete = async (task: ReminderOut) => {
    await remindersApi.update(task.id, { is_completed: !task.is_completed });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: !t.is_completed } : t));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remindersApi.delete(deleteTarget);
    setTasks(prev => prev.filter(t => t.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(today);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === "All") return true;
    if (filter === "Done") return t.is_completed;
    return t.priority === filter.toLowerCase();
  });

  const completedCount = tasks.filter(t => t.is_completed).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-accent-blue" />
            </div>
            Calendar & Planner
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1 ml-[46px]">
            Stay organized with your schedule and tasks
          </p>
        </div>
        <button
          onClick={goToToday}
          className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Today
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          className="glass-card p-4 flex items-center gap-4"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <div className="w-11 h-11 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            {loadingEvents ? (
              <div className="h-7 w-8 rounded bg-gray-200 dark:bg-white/5 animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayEvents.length}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-dark-400">Events Today</p>
          </div>
        </motion.div>

        <motion.div
          className="glass-card p-4 flex items-center gap-4"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <div className="w-11 h-11 rounded-xl bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-accent-amber" />
          </div>
          <div>
            {loadingEvents ? (
              <div className="h-7 w-8 rounded bg-gray-200 dark:bg-white/5 animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{upcomingEvents.length}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-dark-400">Upcoming</p>
          </div>
        </motion.div>

        <motion.div
          className="glass-card p-4 flex items-center gap-4"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            {loadingAssignments ? (
              <div className="h-7 w-8 rounded bg-gray-200 dark:bg-white/5 animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingAssignments}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-dark-400">Pending Assignments</p>
          </div>
        </motion.div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Calendar Panel ── */}
        <div className="lg:w-[400px] lg:flex-shrink-0 space-y-4">
          <div className="glass-card p-5">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-dark-300" />
              </button>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-500 dark:text-dark-300" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-gray-400 dark:text-dark-400 py-1.5 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const dayEvents = eventsByDate[dateStr] || [];
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={clsx(
                      "relative w-full aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5",
                      isSelected
                        ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/25"
                        : isToday
                          ? "bg-accent-blue/10 text-accent-blue font-bold ring-2 ring-accent-blue/30"
                          : hasEvents
                            ? "text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                            : "text-gray-500 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-white/5"
                    )}
                  >
                    {day}
                    {hasEvents && (
                      <div className="flex gap-0.5">
                        {dayEvents.slice(0, 3).map((e, j) => (
                          <span
                            key={j}
                            className={clsx(
                              "w-1 h-1 rounded-full",
                              isSelected
                                ? "bg-white/80"
                                : (eventTypeColors[e.type]?.dotColor || "bg-accent-amber")
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-gray-200 dark:border-white/5">
              {Object.entries(eventTypeColors).map(([type, config]) => (
                <span key={type} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-dark-400 capitalize">
                  <span className={clsx("w-2 h-2 rounded-full", config.dotColor)} />
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* Upcoming Events (when no date selected) */}
          {!selectedDate && upcomingEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5"
            >
              <h4 className="text-xs font-semibold text-gray-500 dark:text-dark-400 mb-3 uppercase tracking-wider">
                Upcoming Events
              </h4>
              <div className="space-y-2.5">
                {upcomingEvents.slice(0, 6).map(e => {
                  const config = eventTypeColors[e.type] || eventTypeColors.reminder;
                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", config.dotColor)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-dark-100 truncate">{e.title}</p>
                        {e.time && (
                          <p className="text-[10px] text-gray-500 dark:text-dark-300 truncate">{e.time}</p>
                        )}
                        {e.course_name && (
                          <p className="text-[10px] text-gray-400 dark:text-dark-400 truncate">{e.course_name}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-dark-400 flex-shrink-0 tabular-nums">
                        {new Date(e.date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="flex-1 space-y-5">
          {/* Due Assignments - Loading Skeleton */}
          {loadingAssignments && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="h-5 w-36 rounded-lg bg-gray-200 dark:bg-white/5 animate-pulse" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
                    <div className="w-4 h-4 rounded bg-gray-200 dark:bg-white/5 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-white/5 animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-white/5 animate-pulse" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Due Assignments */}
          {!loadingAssignments && dueAssignments.length > 0 && (() => {
            const pendingList = dueAssignments.filter(a => !a.submitted);
            const submittedList = dueAssignments.filter(a => a.submitted);

            const renderAssignment = (a: typeof dueAssignments[0], i: number) => {
              const deadlineDate = new Date(a.deadline);
              const now = new Date();
              const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysLeft <= 2;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={clsx(
                    "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                    a.submitted
                      ? "bg-gray-50/50 dark:bg-white/[0.02] border-gray-100/50 dark:border-white/[0.03]"
                      : "bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10"
                  )}
                >
                  <BookOpen className={clsx("w-4 h-4 shrink-0",
                    a.submitted ? "text-accent-emerald" : isUrgent ? "text-red-400" : "text-accent-blue"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx("text-sm font-medium truncate",
                      a.submitted ? "text-gray-400 dark:text-dark-400 line-through" : "text-gray-800 dark:text-dark-100"
                    )}>
                      {a.title}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-dark-400 truncate">{a.course_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.submitted ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                        Submitted
                      </span>
                    ) : (
                      <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        isUrgent ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      )}>
                        {daysLeft <= 0 ? "Due today" : `${daysLeft}d left`}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 dark:text-dark-400 tabular-nums">
                      {deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <Link
                      href={`/student/courses/course/${a.course_id}/assignments`}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-dark-400 hover:text-accent-blue transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            };

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Due Assignments</h2>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium ml-auto">
                    {pendingList.length} pending
                  </span>
                </div>

                {/* Pending Assignments */}
                {pendingList.length > 0 ? (
                  <div className="space-y-2">
                    {pendingList.map((a, i) => renderAssignment(a, i))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-dark-400 text-center py-3">All assignments submitted!</p>
                )}

                {/* Submitted - Collapsible */}
                {submittedList.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowSubmitted(prev => !prev)}
                      className={clsx(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                        "bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10",
                        "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Submitted ({submittedList.length})
                      </span>
                      <motion.div
                        animate={{ rotate: showSubmitted ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {showSubmitted && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-2">
                            {submittedList.map((a, i) => renderAssignment(a, i))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })()}

          {/* Calendar Events for Selected Date */}
          <AnimatePresence mode="wait">
            {selectedDate && selectedDateEvents.length > 0 && (
              <motion.div
                key={`events-${selectedDate}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card p-5"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-accent-blue" />
                  Events &mdash; {new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
                </h3>
                <div className="space-y-2">
                  {selectedDateEvents.map((e, i) => {
                    const config = eventTypeColors[e.type] || eventTypeColors.reminder;
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={clsx(
                          "p-3 rounded-xl border transition-colors",
                          "border-gray-100 dark:border-white/5",
                          config.bg
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <Icon className={clsx("w-4 h-4 mt-0.5 flex-shrink-0", config.text)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{e.title}</p>
                            {e.time && (
                              <p className="text-[11px] text-gray-600 dark:text-dark-300 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {e.time}
                              </p>
                            )}
                            {e.course_name && (
                              <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5 truncate">{e.course_name}</p>
                            )}
                            {e.location && (
                              <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5 flex items-center gap-1 truncate">
                                <CalendarDays className="w-3 h-3" /> {e.location}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={clsx("text-[10px] px-2 py-0.5 rounded-full capitalize font-medium", config.bg, config.text, "border", `border-current/10`)}>
                                {e.type === "study_time" ? "study time" : e.type === "study_plan" ? "exam plan" : e.type}
                              </span>
                              {e.is_completed && (
                                <span className="text-[10px] text-accent-emerald flex items-center gap-0.5 font-medium">
                                  <CheckCircle className="w-3 h-3" /> Done
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tasks Section ── */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                  <ListTodo className="w-4 h-4 text-accent-purple" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {selectedDate
                      ? new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                      : "Select a Date"}
                  </h2>
                  {selectedDate && tasks.length > 0 && (
                    <p className="text-[11px] text-gray-400 dark:text-dark-400">
                      {completedCount}/{tasks.length} completed
                    </p>
                  )}
                </div>
              </div>
              {selectedDate && (
                <motion.button
                  onClick={() => setShowAdd(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 btn-gradient rounded-xl flex items-center justify-center shadow-md"
                >
                  <Plus className="w-5 h-5 text-white relative z-10" />
                </motion.button>
              )}
            </div>

            {/* Progress Bar */}
            {selectedDate && tasks.length > 0 && (
              <div className="mb-4">
                <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-dark-600 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-purple"
                    initial={{ width: 0 }}
                    animate={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Filters */}
            {selectedDate && (
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {["All", "Urgent", "Normal", "Low", "Done"].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      filter === f
                        ? "bg-accent-blue text-white shadow-sm"
                        : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {/* Task List */}
            <AnimatePresence mode="wait">
              {!selectedDate ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="w-7 h-7 text-gray-300 dark:text-dark-400" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-dark-400 font-medium">Select a date to view tasks</p>
                  <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">Click any date on the calendar</p>
                </motion.div>
              ) : filteredTasks.length === 0 ? (
                <motion.div
                  key="no-tasks"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-10 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-accent-emerald" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-dark-400 font-medium">
                    {filter !== "All" ? `No ${filter.toLowerCase()} tasks` : "No tasks for this date"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                    {filter !== "All" ? "Try a different filter" : "Tap + to add a task"}
                  </p>
                </motion.div>
              ) : (
                <motion.div key="tasks" className="space-y-2">
                  {filteredTasks.map((task, i) => {
                    const catCfg = categoryIcons[task.type];
                    const CatIcon = catCfg?.icon || FileText;
                    const catColor = catCfg?.color || "text-accent-blue";
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ delay: i * 0.03 }}
                        className={clsx(
                          "flex items-center gap-3 p-3 rounded-xl transition-all group",
                          "bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5",
                          "hover:border-gray-200 dark:hover:border-white/10",
                          task.is_completed && "opacity-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => toggleComplete(task)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-dark-400 bg-white dark:bg-dark-700 text-accent-blue focus:ring-accent-blue/30 cursor-pointer"
                        />
                        <CatIcon className={clsx("w-4 h-4 shrink-0", task.is_completed ? "text-gray-300 dark:text-dark-500" : catColor)} />
                        <span className={clsx(
                          "flex-1 text-sm",
                          task.is_completed
                            ? "line-through text-gray-400 dark:text-dark-400"
                            : "text-gray-800 dark:text-dark-100"
                        )}>
                          {task.title}
                        </span>
                        <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", priorityColors[task.priority])}>
                          {task.priority}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-dark-300 border border-gray-200/50 dark:border-white/5">
                          {task.type}
                        </span>
                        <button
                          onClick={() => setDeleteTarget(task.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-300 dark:text-dark-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Add Task Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Plan Your Study" maxWidth="max-w-lg">
        <div className="space-y-5">
          {selectedDate && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-accent-blue/5 border border-accent-blue/10">
              <CalendarDays className="w-4 h-4 text-accent-blue" />
              <span className="text-sm text-gray-700 dark:text-dark-200 font-medium">
                {new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-dark-400 mb-1.5 uppercase tracking-wider">
              Task Name
            </label>
            <input
              type="text"
              placeholder="e.g., Complete Chapter 5 notes..."
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-900 dark:text-dark-100"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-dark-400 mb-2 uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map(cat => {
                const CatIcon = cat.icon;
                const active = newTask.type === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setNewTask(p => ({ ...p, type: cat.value }))}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-[11px] font-medium transition-all",
                      active ? cat.activeBg : `${cat.bg} hover:opacity-80`
                    )}
                  >
                    <CatIcon className={clsx("w-5 h-5", cat.color)} />
                    <span className={clsx(active ? cat.color : "text-gray-600 dark:text-dark-200")}>{cat.value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-dark-400 mb-2 uppercase tracking-wider">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map(pri => {
                const PriIcon = pri.icon;
                const active = newTask.priority === pri.value;
                return (
                  <button
                    key={pri.value}
                    type="button"
                    onClick={() => setNewTask(p => ({ ...p, priority: pri.value }))}
                    className={clsx(
                      "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium transition-all",
                      active ? pri.activeBg : `${pri.bg} hover:opacity-80`
                    )}
                  >
                    <PriIcon className={clsx("w-4 h-4", pri.color)} />
                    <span className={clsx(active ? pri.color : "text-gray-600 dark:text-dark-200")}>{pri.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {newTask.title === "" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-dark-400 mb-2 uppercase tracking-wider">
                Quick Add
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Read textbook chapter", "Practice problems", "Review lecture notes", "Work on assignment", "Prepare for quiz"].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewTask(p => ({ ...p, title: s }))}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-dark-300 hover:bg-accent-blue/10 hover:text-accent-blue border border-gray-200/50 dark:border-white/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200/50 dark:border-white/5">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTask}
              disabled={!newTask.title.trim()}
              className={clsx(
                "btn-gradient px-5 py-2 text-sm text-white rounded-xl relative z-10 transition-opacity shadow-md",
                !newTask.title.trim() && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className="relative z-10">Add Task</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task">
        <p className="text-sm text-gray-600 dark:text-dark-200 mb-5">Are you sure you want to delete this task? This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}
