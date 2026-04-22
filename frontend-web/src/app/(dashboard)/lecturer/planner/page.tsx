"use client";

import { useState, useEffect } from "react";
import { remindersApi, ReminderOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { Plus, Trash2, ChevronLeft, ChevronRight, User, Zap, Minus, ArrowDown, CalendarDays, Presentation, ClipboardCheck, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CATEGORIES = [
  { value: "Lecture", icon: Presentation, color: "text-accent-purple", bg: "bg-accent-purple/10", activeBg: "bg-accent-purple/20 ring-2 ring-accent-purple/40" },
  { value: "Grading", icon: ClipboardCheck, color: "text-accent-amber", bg: "bg-accent-amber/10", activeBg: "bg-accent-amber/20 ring-2 ring-accent-amber/40" },
  { value: "Meeting", icon: Users, color: "text-accent-blue", bg: "bg-accent-blue/10", activeBg: "bg-accent-blue/20 ring-2 ring-accent-blue/40" },
  { value: "Deadline", icon: Clock, color: "text-red-400", bg: "bg-red-500/10", activeBg: "bg-red-500/20 ring-2 ring-red-500/40" },
  { value: "Personal", icon: User, color: "text-accent-emerald", bg: "bg-accent-emerald/10", activeBg: "bg-accent-emerald/20 ring-2 ring-accent-emerald/40" },
];
const PRIORITIES = [
  { value: "urgent", label: "Urgent", icon: Zap, color: "text-red-400", bg: "bg-red-500/10", activeBg: "bg-red-500/20 ring-2 ring-red-500/40" },
  { value: "normal", label: "Normal", icon: Minus, color: "text-accent-purple", bg: "bg-accent-purple/10", activeBg: "bg-accent-purple/20 ring-2 ring-accent-purple/40" },
  { value: "low", label: "Low", icon: ArrowDown, color: "text-gray-400 dark:text-dark-300", bg: "bg-gray-100 dark:bg-white/5", activeBg: "bg-gray-200 dark:bg-white/10 ring-2 ring-gray-300 dark:ring-white/20" },
];
const priorityColors: Record<string, string> = { urgent: "bg-red-500/10 text-red-400", normal: "bg-accent-purple/10 text-accent-purple", low: "bg-white/5 text-dark-300" };
const categoryIcons: Record<string, { icon: typeof Presentation; color: string }> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, { icon: c.icon, color: c.color }])
);

export default function LecturerPlannerPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ReminderOut[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", type: "Lecture", priority: "normal" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

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
    setNewTask({ title: "", type: "Lecture", priority: "normal" });
  };

  const toggleComplete = async (task: ReminderOut) => {
    const updated = await remindersApi.update(task.id, { is_completed: !task.is_completed });
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remindersApi.delete(deleteTarget);
    setTasks(prev => prev.filter(t => t.id !== deleteTarget));
    setDeleteTarget(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row gap-6">
      <div className="glass-card p-5 lg:w-[380px]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-1 hover:bg-white/10 rounded"><ChevronLeft className="w-5 h-5 text-dark-300" /></button>
          <h3 className="font-semibold text-white">{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-1 hover:bg-white/10 rounded"><ChevronRight className="w-5 h-5 text-dark-300" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS.map(d => <div key={d} className="text-xs font-medium text-dark-400 py-2">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            return (
              <button key={day} onClick={() => setSelectedDate(dateStr)}
                className={clsx("w-10 h-10 rounded-lg text-sm font-medium transition-colors mx-auto",
                  dateStr === selectedDate ? "bg-accent-purple text-white" : dateStr === today ? "bg-accent-purple/20 text-accent-purple" : "text-dark-100 hover:bg-white/10"
                )}>{day}</button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {selectedDate ? new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Select a Date"}
          </h2>
          {selectedDate && (
            <button onClick={() => setShowAdd(true)} className="w-9 h-9 btn-gradient relative z-10 rounded-full flex items-center justify-center">
              <span className="relative z-10"><Plus className="w-5 h-5" /></span>
            </button>
          )}
        </div>

        {/* Filter tabs */}
        {selectedDate && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {["All", "Urgent", "Normal", "Low", "Done"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx("px-3 py-1 rounded-full text-xs font-medium transition-all",
                  filter === f ? "bg-accent-purple text-white" : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200/50 dark:border-white/5"
                )}>
                {f}
              </button>
            ))}
          </div>
        )}

        {!selectedDate ? (
          <p className="text-gray-400 dark:text-dark-400 text-sm py-8 text-center">Click on a date to view tasks.</p>
        ) : (tasks.filter(t => {
          if (filter === "All") return true;
          if (filter === "Done") return t.is_completed;
          return t.priority === filter.toLowerCase();
        })).length === 0 ? (
          <p className="text-gray-400 dark:text-dark-400 text-sm py-8 text-center">No tasks for this date.</p>
        ) : (
          <div className="space-y-2">
            {tasks.filter(t => {
              if (filter === "All") return true;
              if (filter === "Done") return t.is_completed;
              return t.priority === filter.toLowerCase();
            }).map(task => {
              const catCfg = categoryIcons[task.type];
              const CatIcon = catCfg?.icon || Presentation;
              const catColor = catCfg?.color || "text-accent-purple";
              return (
                <div key={task.id} className={clsx("flex items-center gap-3 glass-card p-3 group", task.is_completed && "opacity-60")}>
                  <input type="checkbox" checked={task.is_completed} onChange={() => toggleComplete(task)} className="w-4 h-4 rounded border-dark-400 text-accent-purple bg-transparent" />
                  <CatIcon className={clsx("w-4 h-4 shrink-0", task.is_completed ? "text-dark-500" : catColor)} />
                  <span className={clsx("flex-1 text-sm", task.is_completed ? "line-through text-gray-400 dark:text-dark-400" : "text-gray-900 dark:text-dark-100")}>{task.title}</span>
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium", priorityColors[task.priority])}>{task.priority}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-dark-300 border border-gray-200/50 dark:border-white/5">{task.type}</span>
                  <button onClick={() => setDeleteTarget(task.id)} className="p-1 hover:bg-red-500/10 rounded text-gray-400 dark:text-dark-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Task Modal — Lecturer */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Schedule Task" maxWidth="max-w-lg">
        <div className="space-y-5">
          {/* Selected date indicator */}
          {selectedDate && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-purple/5 border border-accent-purple/10">
              <CalendarDays className="w-4 h-4 text-accent-purple" />
              <span className="text-sm text-gray-700 dark:text-dark-200">
                {new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}

          {/* Task name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1.5">Task</label>
            <input
              type="text"
              placeholder="e.g., Prepare midterm questions, Grade submissions..."
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              className="glass-input w-full px-4 py-2.5 text-sm"
              autoFocus
            />
          </div>

          {/* Category + Priority side by side */}
          <div className="grid grid-cols-5 gap-4">
            {/* Category picker — 3 cols */}
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-2">Category</label>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map(cat => {
                  const CatIcon = cat.icon;
                  const active = newTask.type === cat.value;
                  return (
                    <button key={cat.value} type="button"
                      onClick={() => setNewTask(p => ({ ...p, type: cat.value }))}
                      className={clsx(
                        "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-medium transition-all",
                        active ? cat.activeBg : `${cat.bg} hover:opacity-80`
                      )}>
                      <CatIcon className={clsx("w-4.5 h-4.5", cat.color)} />
                      <span className={clsx(active ? cat.color : "text-gray-600 dark:text-dark-200")}>{cat.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority picker — 2 cols */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-2">Priority</label>
              <div className="flex flex-col gap-1.5">
                {PRIORITIES.map(pri => {
                  const PriIcon = pri.icon;
                  const active = newTask.priority === pri.value;
                  return (
                    <button key={pri.value} type="button"
                      onClick={() => setNewTask(p => ({ ...p, priority: pri.value }))}
                      className={clsx(
                        "flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all",
                        active ? pri.activeBg : `${pri.bg} hover:opacity-80`
                      )}>
                      <PriIcon className={clsx("w-4 h-4", pri.color)} />
                      <span className={clsx(active ? pri.color : "text-gray-600 dark:text-dark-200")}>{pri.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick suggestion chips */}
          {newTask.title === "" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-2">Quick Add</label>
              <div className="flex flex-wrap gap-1.5">
                {["Prepare lecture slides", "Grade assignments", "Department meeting", "Set assignment deadline", "Review student maps", "Office hours"].map(s => (
                  <button key={s} type="button"
                    onClick={() => setNewTask(p => ({ ...p, title: s }))}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-dark-300 hover:bg-accent-purple/10 hover:text-accent-purple border border-gray-200/50 dark:border-white/5 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200/50 dark:border-white/5">
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleAddTask}
              disabled={!newTask.title.trim()}
              className={clsx(
                "btn-gradient px-5 py-2 text-sm text-white rounded-xl relative z-10 transition-opacity",
                !newTask.title.trim() && "opacity-40 cursor-not-allowed"
              )}>
              <span className="relative z-10">Schedule</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task">
        <p className="text-sm text-gray-600 dark:text-dark-200 mb-4">Delete this task?</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/30 transition-colors">Delete</button>
        </div>
      </Modal>
    </motion.div>
  );
}
