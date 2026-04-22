"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, mapsApi, AssignmentOut, SubmissionOut, AccessCheck, MapOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Lock, FileQuestion, BookOpen, ClipboardList, FolderKanban, Map as MapIcon, X } from "lucide-react";
import clsx from "clsx";

interface AssignmentWithSubmission extends AssignmentOut {
  submission?: SubmissionOut | null;
  access?: AccessCheck;
}

export default function AssignmentsPage() {
  const { cid } = useParams();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([]);
  const [selected, setSelected] = useState<AssignmentWithSubmission | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitTab, setSubmitTab] = useState<"map" | "link" | "file">("map");
  const [shareCode, setShareCode] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [comments, setComments] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myMaps, setMyMaps] = useState<MapOut[]>([]);
  const [selectedMapId, setSelectedMapId] = useState("");

  useEffect(() => {
    if (!cid || !user) return;
    const load = async () => {
      const assnList = await assignmentsApi.list(cid as string);
      const items = await Promise.all(
        assnList.map(async (a) => {
          const [submission, access] = await Promise.all([
            assignmentsApi.getMySubmission(a.id),
            assignmentsApi.checkAccess(a.id),
          ]);
          return { ...a, submission, access } as AssignmentWithSubmission;
        })
      );
      setAssignments(items);
    };
    load();
  }, [cid, user]);

  // Load user's own maps when submit modal opens
  useEffect(() => {
    if (showSubmit && submitTab === "map" && myMaps.length === 0) {
      mapsApi.list().then(setMyMaps).catch(() => {});
    }
  }, [showSubmit, submitTab]);

  const getStatus = (a: AssignmentWithSubmission) => {
    if (a.submission) return "submitted";
    if (new Date(a.deadline) < new Date()) return "overdue";
    return "todo";
  };

  const handleSubmit = async () => {
    if (!selected || !user || !profile) return;

    if (submitTab === "file") {
      if (!uploadFile) { alert("Please select a file."); return; }
      setUploading(true);
      try {
        const res = await assignmentsApi.uploadFile(selected.id, uploadFile);
        if (res.ok) {
          const sub = await assignmentsApi.getMySubmission(selected.id);
          setAssignments(prev => prev.map(a => a.id === selected.id ? { ...a, submission: sub } : a));
        }
      } catch (e: any) {
        alert(e.message || "Upload failed");
      } finally {
        setUploading(false);
      }
      setShowSubmit(false);
      setSelected(null);
      setUploadFile(null);
      return;
    }

    let mapId: string | null = null;
    if (submitTab === "map") {
      if (selectedMapId) {
        mapId = selectedMapId;
      } else if (shareCode.trim()) {
        const results = await mapsApi.searchByCode(shareCode.toUpperCase());
        if (results.length === 0) { alert("Invalid share code."); return; }
        mapId = results[0].id;
      } else {
        alert("Please select a mind map or enter a share code."); return;
      }
    }
    const submission = await assignmentsApi.submit(selected.id, {
      submission_type: submitTab,
      map_id: mapId,
      external_link: submitTab === "link" ? externalLink : null,
      comments: comments || "",
    });
    setAssignments(prev => prev.map(a => a.id === selected.id ? { ...a, submission } : a));
    setShowSubmit(false);
    setSelected(null);
  };

  const statusBadge = (status: string) => {
    if (status === "submitted") return <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20 rounded-full"><CheckCircle className="w-3 h-3" /> Submitted</span>;
    if (status === "overdue") return <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full"><AlertCircle className="w-3 h-3" /> Overdue</span>;
    return <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-amber/10 text-accent-amber border border-accent-amber/20 rounded-full"><Clock className="w-3 h-3" /> To Do</span>;
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case "tutorial":
        return <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 rounded-full"><BookOpen className="w-3 h-3" /> Tutorial</span>;
      case "project":
        return <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-purple/10 text-accent-purple border border-accent-purple/20 rounded-full"><FolderKanban className="w-3 h-3" /> Project</span>;
      default:
        return <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-blue/10 text-accent-blue border border-accent-blue/20 rounded-full"><ClipboardList className="w-3 h-3" /> Assignment</span>;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Assignments</h1>

      {assignments.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No assignments yet.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const status = getStatus(a);
            const locked = a.access && !a.access.accessible;
            return (
              <div key={a.id} className={clsx("glass-card p-5 flex items-center justify-between", locked && "opacity-60")} style={{ borderRadius: "16px" }}>
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    {locked && <Lock className="w-4 h-4 text-dark-500" />}
                    {a.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {locked ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-dark-700 text-dark-400 border border-white/5 rounded-full">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    ) : statusBadge(status)}
                    {typeBadge(a.assignment_type)}
                    {a.quiz_id && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-pink/10 text-accent-pink border border-accent-pink/20 rounded-full">
                        <FileQuestion className="w-3 h-3" /> Quiz Assignment
                      </span>
                    )}
                    <span className="text-xs text-dark-400">Due: {new Date(a.deadline).toLocaleDateString()}</span>
                  </div>
                  {locked && a.access?.reasons && (
                    <div className="mt-2 space-y-0.5">
                      {a.access.reasons.map((r, i) => (
                        <p key={i} className="text-xs text-dark-500">{r}</p>
                      ))}
                    </div>
                  )}
                </div>
                {!locked && (
                  a.quiz_id ? (
                    status === "submitted" ? (
                      <button onClick={() => { setSelected(a); setShowSubmit(true); }}
                        className="btn-gradient px-4 py-2 text-sm text-white rounded-xl relative z-10">
                        <span className="relative z-10">View</span>
                      </button>
                    ) : (
                      <button onClick={() => router.push(`/student/course/${cid}/quizzes`)}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-accent-pink to-accent-purple px-4 py-2 text-sm text-white rounded-xl relative z-10 hover:opacity-90 transition-opacity">
                        <FileQuestion className="w-4 h-4" />
                        <span>Take Quiz</span>
                      </button>
                    )
                  ) : (
                    <button onClick={() => { setSelected(a); setShowSubmit(true); }}
                      className="btn-gradient px-4 py-2 text-sm text-white rounded-xl relative z-10">
                      <span className="relative z-10">{status === "submitted" ? "View" : "Submit"}</span>
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showSubmit} onClose={() => { setShowSubmit(false); setSelected(null); }} maxWidth="max-w-4xl" noPadding>
        {selected && (
          <div className="flex flex-col lg:flex-row min-h-[420px] relative">
            {/* Close button */}
            <button onClick={() => { setShowSubmit(false); setSelected(null); }}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/5 transition-colors">
              <X className="w-4 h-4 text-gray-400 dark:text-dark-300" />
            </button>
            {/* Left panel — Assignment info */}
            <div className="lg:w-[280px] shrink-0 p-6 border-b lg:border-b-0 lg:border-r border-gray-200/10 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex flex-col lg:rounded-l-2xl">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  {typeBadge(selected.assignment_type)}
                  {statusBadge(getStatus(selected))}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{selected.title}</h3>
                {selected.description && (
                  <p className="text-sm text-gray-600 dark:text-dark-300 mb-4 leading-relaxed">{selected.description}</p>
                )}
                <div className="space-y-2 mt-auto">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Due: {new Date(selected.deadline).toLocaleString()}</span>
                  </div>
                  {(() => {
                    const deadline = new Date(selected.deadline);
                    const now = new Date();
                    const hoursLeft = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
                    if (selected.submission) return null;
                    if (hoursLeft <= 0) return <p className="text-xs text-red-400 font-medium">Past due</p>;
                    if (hoursLeft <= 48) return <p className="text-xs text-red-400 font-medium">{hoursLeft}h remaining</p>;
                    const daysLeft = Math.ceil(hoursLeft / 24);
                    return <p className="text-xs text-accent-amber font-medium">{daysLeft} days remaining</p>;
                  })()}
                </div>
              </div>

              {/* Submission summary when already submitted */}
              {selected.submission && (
                <div className="mt-4 pt-4 border-t border-gray-200/10 dark:border-white/5">
                  <p className="text-[10px] font-medium text-gray-400 dark:text-dark-500 uppercase tracking-wider mb-2">Submission Info</p>
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      Type: <span className="text-gray-700 dark:text-dark-200 font-medium capitalize">{selected.submission.submission_type}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-400">
                      Submitted: <span className="text-gray-700 dark:text-dark-200 font-medium">{new Date(selected.submission.submitted_at).toLocaleDateString()}</span>
                    </p>
                    {selected.submission.comments && (
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        Notes: <span className="text-gray-700 dark:text-dark-200">{selected.submission.comments}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — Submission form or result */}
            <div className="flex-1 p-6 flex flex-col">
              {selected.submission ? (
                <div className="flex-1 flex flex-col">
                  {/* Grade & feedback */}
                  <div className="flex-1 space-y-4">
                    {selected.submission.grade !== undefined && selected.submission.grade !== null ? (
                      <div className="text-center py-4">
                        <div className={clsx(
                          "inline-flex items-center justify-center w-20 h-20 rounded-2xl text-2xl font-bold mb-3",
                          selected.submission.grade >= 80 ? "bg-accent-emerald/10 text-accent-emerald" :
                          selected.submission.grade >= 60 ? "bg-accent-blue/10 text-accent-blue" :
                          selected.submission.grade >= 40 ? "bg-accent-amber/10 text-accent-amber" :
                          "bg-red-500/10 text-red-400"
                        )}>
                          {selected.submission.grade}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-dark-400">out of 100</p>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="w-8 h-8 text-accent-emerald" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Submitted Successfully</p>
                        <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Awaiting grade from lecturer</p>
                      </div>
                    )}

                    {selected.submission.feedback && (
                      <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/5 rounded-xl p-4">
                        <p className="text-xs font-medium text-gray-500 dark:text-dark-400 mb-2">Lecturer Feedback</p>
                        <p className="text-sm text-gray-700 dark:text-dark-200 leading-relaxed">{selected.submission.feedback}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-200/10 dark:border-white/5">
                    <button onClick={() => { setShowSubmit(false); setSelected(null); }}
                      className="px-5 py-2.5 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Submission type tabs */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 border border-gray-200/50 dark:border-white/5 mb-5">
                    {(["map", "link", "file"] as const).map(t => (
                      <button key={t} onClick={() => setSubmitTab(t)}
                        className={clsx("flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                          submitTab === t ? "bg-white dark:bg-accent-blue text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-dark-100 hover:bg-white/50 dark:hover:bg-white/5"
                        )}>
                        {t === "map" ? "Mind Map" : t === "link" ? "Link" : "File"}
                      </button>
                    ))}
                  </div>

                  {/* Submission inputs */}
                  <div className="flex-1 space-y-4">
                    {submitTab === "map" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-dark-300 mb-1.5">
                            <MapIcon className="w-3.5 h-3.5 inline mr-1" />Select from My Maps
                          </label>
                          <select
                            value={selectedMapId}
                            onChange={e => { setSelectedMapId(e.target.value); if (e.target.value) setShareCode(""); }}
                            className="glass-input w-full px-4 py-2.5 text-sm"
                          >
                            <option value="">Choose a mind map...</option>
                            {myMaps.map(m => (
                              <option key={m.id} value={m.id}>{m.title} ({m.share_code})</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                          <span className="text-xs text-gray-400 dark:text-dark-500">or enter code</span>
                          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-dark-300 mb-1.5">Mind Map Share Code</label>
                          <input type="text" placeholder="Enter share code" value={shareCode}
                            onChange={e => { setShareCode(e.target.value.toUpperCase()); if (e.target.value) setSelectedMapId(""); }}
                            className="glass-input w-full px-4 py-2.5 text-sm font-mono uppercase" />
                        </div>
                      </div>
                    )}
                    {submitTab === "link" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-300 mb-1.5">External Link</label>
                        <input type="url" placeholder="https://..." value={externalLink}
                          onChange={e => setExternalLink(e.target.value)}
                          className="glass-input w-full px-4 py-2.5 text-sm" />
                      </div>
                    )}
                    {submitTab === "file" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-300 mb-1.5">Upload File</label>
                        <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 text-center hover:border-accent-blue/30 transition-colors">
                          <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                            className="glass-input w-full px-4 py-2.5 text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-accent-blue/20 file:text-accent-blue" />
                        </div>
                        {uploadFile && (
                          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-accent-blue/5 border border-accent-blue/10">
                            <ClipboardList className="w-3.5 h-3.5 text-accent-blue" />
                            <span className="text-xs text-gray-700 dark:text-dark-200 flex-1 truncate">{uploadFile.name}</span>
                            <span className="text-xs text-gray-400 dark:text-dark-400">{(uploadFile.size / 1024).toFixed(1)} KB</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-300 mb-1.5">Comments (optional)</label>
                      <textarea placeholder="Add any notes for your lecturer..." value={comments}
                        onChange={e => setComments(e.target.value)}
                        className="glass-input w-full px-4 py-2.5 text-sm" rows={3} />
                    </div>
                  </div>

                  {/* Submit actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200/10 dark:border-white/5 mt-auto">
                    <button onClick={() => { setShowSubmit(false); setSelected(null); }}
                      className="px-5 py-2.5 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={uploading}
                      className="btn-gradient px-6 py-2.5 text-sm text-white rounded-xl relative z-10 disabled:opacity-50 font-medium">
                      <span className="relative z-10">{uploading ? "Uploading..." : "Confirm Submission"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
