"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { groupTasksApi, coursesApi, GroupTaskDetail, GroupInTask, UserOut } from "@/lib/api";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Plus, Trash2, Users, Shuffle, UserPlus, X, Calendar, ListTodo } from "lucide-react";
import { motion } from "framer-motion";

export default function GroupTaskDetailPage() {
  const { cid, tid } = useParams();
  const router = useRouter();
  const [task, setTask] = useState<GroupTaskDetail | null>(null);
  const [students, setStudents] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [addTarget, setAddTarget] = useState<GroupInTask | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [autoCount, setAutoCount] = useState(4);
  const [showAuto, setShowAuto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GroupInTask | null>(null);

  const refresh = useCallback(async () => {
    if (!cid || !tid) return;
    const t = await groupTasksApi.get(cid as string, tid as string);
    setTask(t);
  }, [cid, tid]);

  useEffect(() => {
    if (!cid || !tid) return;
    Promise.all([
      groupTasksApi.get(cid as string, tid as string).then(setTask),
      coursesApi.getStudents(cid as string).then(setStudents),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [cid, tid]);

  const handleCreate = async () => {
    if (!groupName.trim() || !cid || !tid) return;
    await groupTasksApi.createGroup(cid as string, tid as string, {
      name: groupName.trim(),
      description: groupDesc.trim(),
    });
    await refresh();
    setShowCreate(false);
    setGroupName("");
    setGroupDesc("");
  };

  const handleDeleteGroup = async () => {
    if (!confirmDelete || !cid || !tid) return;
    await groupTasksApi.deleteGroup(cid as string, tid as string, confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
  };

  const handleAddMembers = async () => {
    if (!addTarget || !cid || !tid || selectedStudents.length === 0) return;
    await groupTasksApi.addMembers(cid as string, tid as string, addTarget.id, selectedStudents);
    setAddTarget(null);
    setSelectedStudents([]);
    await refresh();
  };

  const handleRemoveMember = async (gid: string, sid: string) => {
    if (!cid || !tid) return;
    await groupTasksApi.removeMember(cid as string, tid as string, gid, sid);
    await refresh();
  };

  const handleAutoAssign = async () => {
    if (!cid || !tid) return;
    await groupTasksApi.autoAssign(cid as string, tid as string, autoCount);
    setShowAuto(false);
    await refresh();
  };

  const groups = task?.groups || [];
  const assignedIds = new Set(groups.flatMap(g => g.members.map(m => m.student_id)));
  const totalMembers = groups.reduce((sum, g) => sum + g.members.length, 0);

  const fmtDate = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };

  if (loading) {
    return <div className="text-center py-12 text-dark-400 text-sm">Loading…</div>;
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-400 mb-4">Task not found.</p>
        <button onClick={() => router.back()} className="text-accent-blue text-sm hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.push(`/lecturer/course/${cid}/groups`)}
        className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> All Tasks
      </button>

      <div className="glass-card p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center shrink-0">
            <ListTodo className="w-6 h-6 text-accent-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{task.title}</h1>
            {task.description && <p className="text-sm text-dark-300 mt-1">{task.description}</p>}
            <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple">
                <Users className="w-3 h-3" /> {groups.length} group{groups.length !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue">
                {totalMembers} assigned
              </span>
              {task.due_date && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-dark-300">
                  <Calendar className="w-3 h-3" /> Due {fmtDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-white">Groups</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowAuto(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-accent-purple/20 text-accent-purple hover:bg-accent-purple/10 rounded-lg">
            <Shuffle className="w-4 h-4" /> Auto-Assign
          </button>
          <button onClick={() => setShowCreate(true)}
            className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Group</span>
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass-card text-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-accent-blue" />
          </div>
          <p className="text-white font-medium mb-1">No groups yet</p>
          <p className="text-dark-400 text-sm">Create groups manually or use auto-assign to distribute enrolled students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(g => (
            <div key={g.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{g.name}</h3>
                  {g.description && <p className="text-xs text-dark-400 mt-0.5">{g.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setAddTarget(g); setSelectedStudents([]); }}
                    className="p-2 hover:bg-accent-blue/10 rounded-lg text-dark-400 hover:text-accent-blue" title="Add Members">
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(g)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-dark-400 hover:text-red-400" title="Delete Group">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-dark-400 mb-2">{g.members.length} member{g.members.length !== 1 ? "s" : ""}</p>
              {g.members.length === 0 ? (
                <p className="text-xs text-dark-500 italic">No members yet</p>
              ) : (
                <div className="space-y-1">
                  {g.members.map(m => (
                    <div key={m.student_id} className="flex items-center justify-between py-1.5 px-2 bg-white/[0.03] rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={m.student_name || m.student_email} photoUrl={m.student_photo} size={24} role="student" />
                        <span className="text-sm text-dark-200 truncate">{m.student_name || m.student_email}</span>
                      </div>
                      <button onClick={() => handleRemoveMember(g.id, m.student_id)}
                        className="p-1 text-dark-500 hover:text-red-400 shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Group">
        <div className="space-y-3">
          <input type="text" placeholder="Group name" value={groupName}
            onChange={e => setGroupName(e.target.value)} className="glass-input w-full" />
          <input type="text" placeholder="Description (optional)" value={groupDesc}
            onChange={e => setGroupDesc(e.target.value)} className="glass-input w-full" />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={!groupName.trim()}
              className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              <span className="relative z-10">Create</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Members Modal */}
      <Modal open={!!addTarget} onClose={() => setAddTarget(null)} title={`Add to ${addTarget?.name || ""}`}>
        <p className="text-xs text-dark-400 mb-2">
          Each student can be in only one group per task — selecting a student who’s already in another group will move them here.
        </p>
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {students
            .filter(s => !addTarget?.members.some(m => m.student_id === s.id))
            .map(s => {
              const inOther = assignedIds.has(s.id);
              return (
                <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={selectedStudents.includes(s.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedStudents(prev => [...prev, s.id]);
                      else setSelectedStudents(prev => prev.filter(id => id !== s.id));
                    }}
                    className="accent-accent-purple" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{s.display_name || s.email}</span>
                    {inOther && <span className="text-xs text-amber-400 ml-2">(will be moved)</span>}
                  </div>
                </label>
              );
            })}
          {students.filter(s => !addTarget?.members.some(m => m.student_id === s.id)).length === 0 && (
            <p className="text-sm text-dark-400 text-center py-4">All enrolled students are already in this group.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setAddTarget(null)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
          <button onClick={handleAddMembers} disabled={selectedStudents.length === 0}
            className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            <span className="relative z-10">Add {selectedStudents.length} Student{selectedStudents.length !== 1 ? "s" : ""}</span>
          </button>
        </div>
      </Modal>

      {/* Auto-Assign Modal */}
      <Modal open={showAuto} onClose={() => setShowAuto(false)} title="Auto-Assign Groups">
        <div className="space-y-4">
          <p className="text-sm text-dark-200">
            Randomly distribute all enrolled students into groups for this task. This will replace existing groups within this task only.
          </p>
          <div>
            <label className="block text-sm text-dark-200 mb-1">Number of Groups</label>
            <input type="number" min={1} max={20} value={autoCount}
              onChange={e => setAutoCount(Number(e.target.value))}
              className="glass-input w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAuto(false)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleAutoAssign} className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm">
              <span className="relative z-10 flex items-center gap-1"><Shuffle className="w-3 h-3" /> Auto-Assign</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Group confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Group">
        <div className="space-y-4">
          <p className="text-sm text-dark-200">
            Delete <span className="font-semibold text-white">{confirmDelete?.name}</span>? Students in this group will be unassigned.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleDeleteGroup} className="px-4 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
