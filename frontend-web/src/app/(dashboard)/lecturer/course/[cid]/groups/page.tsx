"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { groupTasksApi, GroupTaskSummary } from "@/lib/api";
import Modal from "@/components/ui/modal";
import { ArrowLeft, Plus, Trash2, Users, ListTodo, Calendar, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function GroupTasksPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<GroupTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<GroupTaskSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cid) return;
    groupTasksApi.list(cid as string).then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, [cid]);

  const handleCreate = async () => {
    if (!title.trim() || !cid) return;
    setSubmitting(true);
    try {
      const t = await groupTasksApi.create(cid as string, {
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
      });
      setTasks(prev => [t, ...prev]);
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setDueDate("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || !cid) return;
    await groupTasksApi.delete(cid as string, confirmDelete.id);
    setTasks(prev => prev.filter(t => t.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  const isOverdue = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return !isNaN(d.getTime()) && d < new Date(new Date().toDateString());
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ListTodo className="w-7 h-7 text-accent-purple" /> Group Tasks
          </h1>
          <p className="text-sm text-dark-400 mt-1">Create tasks or projects, then organise students into groups for each one.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Task</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-dark-400 text-sm">Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="glass-card text-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center mx-auto mb-4">
            <ListTodo className="w-8 h-8 text-accent-purple" />
          </div>
          <h3 className="text-white font-semibold mb-2">No group tasks yet</h3>
          <p className="text-dark-400 text-sm mb-5">Create a task or project to start assigning groups of students.</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-gradient relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> Create First Task</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-card p-5 hover:bg-white/[0.04] transition group">
              <Link href={`/lecturer/course/${cid}/groups/${t.id}`} className="block">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{t.title}</h3>
                    {t.description && (
                      <p className="text-xs text-dark-400 mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-white shrink-0 mt-1" />
                </div>
                <div className="flex items-center gap-3 text-xs text-dark-400 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple">
                    <Users className="w-3 h-3" /> {t.group_count} group{t.group_count !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue">
                    {t.member_count} member{t.member_count !== 1 ? "s" : ""}
                  </span>
                  {t.due_date && (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${
                      isOverdue(t.due_date) ? "bg-red-500/10 text-red-400" : "bg-white/5 text-dark-300"
                    }`}>
                      <Calendar className="w-3 h-3" /> {fmtDate(t.due_date)}
                    </span>
                  )}
                </div>
              </Link>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                <button onClick={() => setConfirmDelete(t)}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-dark-400 hover:text-red-400" title="Delete Task">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Group Task">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-dark-300 mb-1">Title</label>
            <input type="text" placeholder="e.g. Final Project Proposal" value={title}
              onChange={e => setTitle(e.target.value)} className="glass-input w-full" />
          </div>
          <div>
            <label className="block text-xs text-dark-300 mb-1">Description (optional)</label>
            <textarea placeholder="Brief description of the task or project" value={description}
              onChange={e => setDescription(e.target.value)} rows={3} className="glass-input w-full resize-none" />
          </div>
          <div>
            <label className="block text-xs text-dark-300 mb-1">Due Date (optional)</label>
            <input type="date" value={dueDate}
              onChange={e => setDueDate(e.target.value)} className="glass-input w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={!title.trim() || submitting}
              className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              <span className="relative z-10">{submitting ? "Creating…" : "Create Task"}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Task">
        <div className="space-y-4">
          <p className="text-sm text-dark-200">
            Delete <span className="font-semibold text-white">{confirmDelete?.title}</span>?
            All groups inside this task will also be removed.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
