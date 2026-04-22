"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { groupTasksApi, GroupTaskSummary, GroupTaskDetail } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Users, ListTodo, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function StudentGroupsPage() {
  const { cid } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<GroupTaskSummary[]>([]);
  const [details, setDetails] = useState<Record<string, GroupTaskDetail>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const myId = user?.uid || user?.id;

  useEffect(() => {
    if (!cid) return;
    groupTasksApi.list(cid as string)
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cid]);

  const toggle = async (tid: string) => {
    setExpanded(prev => ({ ...prev, [tid]: !prev[tid] }));
    if (!details[tid] && cid) {
      try {
        const d = await groupTasksApi.get(cid as string, tid);
        setDetails(prev => ({ ...prev, [tid]: d }));
      } catch { /* ignore */ }
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  const myGroupInTask = (d: GroupTaskDetail) =>
    d.groups.find(g => g.members.some(m => m.student_id === myId));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ListTodo className="w-7 h-7 text-accent-blue" /> Group Tasks
        </h1>
        <p className="text-sm text-dark-400 mt-1">See which group you’re in for each task or project in this course.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-dark-400 text-sm">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="glass-card text-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto mb-4">
            <ListTodo className="w-8 h-8 text-accent-blue" />
          </div>
          <h3 className="text-white font-semibold mb-2">No group tasks yet</h3>
          <p className="text-dark-400 text-sm">Your lecturer hasn’t created any group tasks for this course.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(t => {
            const d = details[t.id];
            const myGroup = d ? myGroupInTask(d) : undefined;
            const isOpen = !!expanded[t.id];
            return (
              <div key={t.id} className="glass-card overflow-hidden">
                <button onClick={() => toggle(t.id)}
                  className="w-full flex items-start gap-3 p-5 text-left hover:bg-white/[0.03] transition">
                  <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center shrink-0">
                    <ListTodo className="w-5 h-5 text-accent-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{t.title}</h3>
                      {myGroup && (
                        <span className="px-2 py-0.5 text-[10px] rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                          You: {myGroup.name}
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-dark-400 mt-1 line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-dark-400">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> {t.group_count} group{t.group_count !== 1 ? "s" : ""}
                      </span>
                      {t.due_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Due {fmtDate(t.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-dark-400 shrink-0 mt-2" />
                    : <ChevronRight className="w-4 h-4 text-dark-400 shrink-0 mt-2" />}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
                      <div className="p-5 space-y-3">
                        {!d ? (
                          <p className="text-xs text-dark-400 text-center">Loading groups…</p>
                        ) : d.groups.length === 0 ? (
                          <p className="text-xs text-dark-400 text-center">No groups created yet.</p>
                        ) : (
                          d.groups.map(g => {
                            const isMine = g.members.some(m => m.student_id === myId);
                            return (
                              <div key={g.id}
                                className={`rounded-xl p-4 border ${isMine
                                  ? "bg-emerald-500/5 border-emerald-500/30"
                                  : "bg-white/[0.02] border-white/5"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold text-white text-sm">{g.name}</h4>
                                    {g.description && <p className="text-xs text-dark-400 mt-0.5">{g.description}</p>}
                                  </div>
                                  <span className="text-xs text-dark-400">
                                    {g.members.length} member{g.members.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                {g.members.length === 0 ? (
                                  <p className="text-xs text-dark-500 italic">No members assigned</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {g.members.map(m => (
                                      <div key={m.student_id}
                                        className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                                          m.student_id === myId
                                            ? "bg-emerald-500/15 border border-emerald-500/30"
                                            : "bg-white/5"
                                        }`}>
                                        <UserAvatar name={m.student_name || m.student_email} photoUrl={m.student_photo} size={20} role="student" />
                                        <span className="text-xs text-white">
                                          {m.student_name || m.student_email}
                                          {m.student_id === myId && <span className="text-emerald-400 ml-1">(you)</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
