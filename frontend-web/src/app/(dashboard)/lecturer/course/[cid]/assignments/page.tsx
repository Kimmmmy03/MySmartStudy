"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, AssignmentOut, SubmissionOut, rubricsApi, RubricOut, RubricCriterion, quizzesApi, QuizOut, mapsApi, aiGradingApi, GradingCalibration } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import SimilarityReport from "@/components/similarity-report";
import FullPlagiarismReportView from "@/components/full-plagiarism-report";
import AiPlagiarismReport from "@/components/ai-plagiarism-report";
import AiGradeRecommendation from "@/components/ai-grade-recommendation";
import { ArrowLeft, Plus, Pencil, Trash2, ClipboardList, X, Check, MessageSquare, Search, ListChecks, Lock, ChevronDown, ChevronUp, Clock, Users, FileText, Link2, Map as MapIcon, ExternalLink, CheckCircle, Upload, Image, Paperclip, Globe, Loader2, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

export default function LecturerAssignmentsPage() {
  const { cid } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentOut[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignmentOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", deadline: "",
    available_from: "", available_until: "", prerequisite_id: "", min_grade: "",
    assignment_type: "assignment", quiz_id: "",
    attachments: [] as { name: string; url: string; type: string }[],
    peer_review_enabled: false,
  });
  const [showConditions, setShowConditions] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  // Submissions state
  const [viewingAssignment, setViewingAssignment] = useState<AssignmentOut | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionOut[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [gradingTarget, setGradingTarget] = useState<SubmissionOut | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", feedback: "" });
  // AI grade for the submission being graded (null = no AI recommendation in play),
  // and an optional override reason captured for the calibration audit trail.
  const [aiGradeForTarget, setAiGradeForTarget] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [similarityAssignment, setSimilarityAssignment] = useState<AssignmentOut | null>(null);
  const [plagiarismReportAssignment, setPlagiarismReportAssignment] = useState<AssignmentOut | null>(null);
  const [subsSearch, setSubsSearch] = useState("");

  // Rubric state
  const [rubricTarget, setRubricTarget] = useState<AssignmentOut | null>(null);
  const [rubric, setRubric] = useState<RubricOut | null>(null);
  const [rubricTitle, setRubricTitle] = useState("");
  const [rubricCriteria, setRubricCriteria] = useState<{ name: string; description: string; max_points: number }[]>([
    { name: "", description: "", max_points: 10 },
  ]);

  // Rubric grading
  const [rubricGradingTarget, setRubricGradingTarget] = useState<SubmissionOut | null>(null);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [rubricFeedback, setRubricFeedback] = useState("");
  const [activeRubric, setActiveRubric] = useState<RubricOut | null>(null);

  // Quizzes for linking
  const [quizzes, setQuizzes] = useState<QuizOut[]>([]);

  useEffect(() => {
    if (!cid) return;
    assignmentsApi.list(cid as string).then(setAssignments);
    quizzesApi.list(cid as string).then(setQuizzes).catch(() => setQuizzes([]));
  }, [cid]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.deadline || !user || !cid) return;
    const conditions = {
      available_from: form.available_from || null,
      available_until: form.available_until || null,
      prerequisite_id: form.prerequisite_id || null,
      min_grade: form.min_grade ? parseFloat(form.min_grade) : null,
    };
    const typeFields = {
      assignment_type: form.assignment_type,
      quiz_id: form.assignment_type === "assignment" && form.quiz_id ? form.quiz_id : null,
    };
    if (editTarget) {
      const updated = await assignmentsApi.update(editTarget.id, {
        title: form.title,
        description: form.description,
        deadline: form.deadline,
        ...conditions,
        ...typeFields,
        attachments: form.attachments,
        peer_review_enabled: form.peer_review_enabled,
      });
      setAssignments(prev => prev.map(a => a.id === editTarget.id ? updated : a));
    } else {
      const created = await assignmentsApi.create({
        course_id: cid as string,
        title: form.title,
        description: form.description,
        deadline: form.deadline,
        ...conditions,
        ...typeFields,
        attachments: form.attachments,
        peer_review_enabled: form.peer_review_enabled,
      });
      setAssignments(prev => [...prev, created]);
    }
    setShowModal(false);
    setEditTarget(null);
    setShowConditions(false);
    setLinkInput("");
    setForm({ title: "", description: "", deadline: "", available_from: "", available_until: "", prerequisite_id: "", min_grade: "", assignment_type: "assignment", quiz_id: "", attachments: [], peer_review_enabled: false });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await assignmentsApi.delete(deleteTarget);
    setAssignments(prev => prev.filter(a => a.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const openEdit = (a: AssignmentOut) => {
    setForm({
      title: a.title, description: a.description, deadline: a.deadline,
      available_from: a.available_from || "", available_until: a.available_until || "",
      prerequisite_id: a.prerequisite_id || "", min_grade: a.min_grade != null ? String(a.min_grade) : "",
      assignment_type: a.assignment_type || "assignment", quiz_id: a.quiz_id || "",
      attachments: a.attachments || [],
      peer_review_enabled: a.peer_review_enabled || false,
    });
    setLinkInput("");
    setShowConditions(!!(a.available_from || a.available_until || a.prerequisite_id));
    setEditTarget(a);
    setShowModal(true);
  };

  const viewSubmissions = async (a: AssignmentOut) => {
    setViewingAssignment(a);
    setSubsSearch("");
    setSubsLoading(true);
    try {
      const subs = await assignmentsApi.getSubmissions(a.id);
      setSubmissions(subs);
    } catch {
      setSubmissions([]);
    } finally {
      setSubsLoading(false);
    }
  };

  const openGrading = (s: SubmissionOut) => {
    setGradingTarget(s);
    setAiGradeForTarget(null);
    setOverrideReason("");
    setGradeForm({
      grade: s.grade != null ? String(s.grade) : "",
      feedback: s.feedback || "",
    });
  };

  const handleGrade = async () => {
    if (!gradingTarget || !viewingAssignment) return;
    const gradeNum = parseFloat(gradeForm.grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) return;
    try {
      const updated = await assignmentsApi.grade(viewingAssignment.id, gradingTarget.id, {
        grade: gradeNum,
        feedback: gradeForm.feedback,
      });
      // If an AI recommendation was in play, record the human decision for the
      // calibration audit trail (accepted when the saved grade matches the AI's).
      if (aiGradeForTarget != null) {
        const accepted = Math.abs(aiGradeForTarget - gradeNum) < 0.5;
        aiGradingApi.review({
          submission_id: gradingTarget.id,
          ai_grade: aiGradeForTarget,
          final_grade: gradeNum,
          action: accepted ? "accepted" : "overridden",
          reason: accepted ? undefined : (overrideReason || undefined),
          apply: false,
        }).catch(() => { /* non-fatal */ });
      }
      setSubmissions(prev => prev.map(s => s.id === gradingTarget.id ? updated : s));
      setGradingTarget(null);
    } catch { /* silent */ }
  };

  const handleAiGrade = (sub: SubmissionOut, grade: number) => {
    setGradingTarget(sub);
    setAiGradeForTarget(grade);
    setOverrideReason("");
    setGradeForm({
      grade: String(grade),
      feedback: sub.feedback || "",
    });
  };

  // Rubric handlers
  const openRubricEditor = async (a: AssignmentOut) => {
    setRubricTarget(a);
    try {
      const existing = await rubricsApi.get(a.id);
      if (existing) {
        setRubric(existing);
        setRubricTitle(existing.title);
        setRubricCriteria(existing.criteria.map((c: any) => ({
          name: c.name || "", description: c.description || "", max_points: c.max_points || 10,
        })));
      } else {
        setRubric(null);
        setRubricTitle(`${a.title} Rubric`);
        setRubricCriteria([{ name: "", description: "", max_points: 10 }]);
      }
    } catch {
      setRubric(null);
      setRubricTitle(`${a.title} Rubric`);
      setRubricCriteria([{ name: "", description: "", max_points: 10 }]);
    }
  };

  const handleSaveRubric = async () => {
    if (!rubricTarget) return;
    const validCriteria = rubricCriteria.filter(c => c.name.trim());
    if (!rubricTitle.trim() || validCriteria.length === 0) return;
    try {
      const saved = await rubricsApi.create({
        assignment_id: rubricTarget.id,
        title: rubricTitle,
        criteria: validCriteria,
      });
      setRubric(saved);
      setRubricTarget(null);
    } catch { /* silent */ }
  };

  const openRubricGrading = async (s: SubmissionOut) => {
    if (!viewingAssignment) return;
    try {
      const r = await rubricsApi.get(viewingAssignment.id);
      if (!r) return;
      setActiveRubric(r);
      setRubricGradingTarget(s);
      const scores: Record<string, number> = {};
      r.criteria.forEach((c: any) => { scores[c.name] = 0; });
      setRubricScores(scores);
      setRubricFeedback("");
    } catch { /* silent */ }
  };

  const handleRubricGrade = async () => {
    if (!rubricGradingTarget || !viewingAssignment || !activeRubric) return;
    try {
      const res = await rubricsApi.gradeWithRubric(viewingAssignment.id, rubricGradingTarget.id, {
        criterion_scores: rubricScores,
        feedback: rubricFeedback,
      });
      if (res.ok) {
        setSubmissions(prev => prev.map(s => s.id === rubricGradingTarget.id
          ? { ...s, grade: res.grade, feedback: res.feedback } : s));
      }
      setRubricGradingTarget(null);
      setActiveRubric(null);
    } catch { /* silent */ }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Assignments</h1>
        <button onClick={() => { setForm({ title: "", description: "", deadline: "", available_from: "", available_until: "", prerequisite_id: "", min_grade: "", assignment_type: "assignment", quiz_id: "", attachments: [], peer_review_enabled: false }); setLinkInput(""); setEditTarget(null); setShowConditions(false); setShowModal(true); }}
          className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> Create Assignment</span>
        </button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No assignments yet.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const isOpen = new Date(a.deadline) > new Date();
            return (
              <div key={a.id} className="glass-card p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{a.title}</h3>
                  <p className="text-sm text-dark-300 mt-1 line-clamp-1">{a.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isOpen ? "bg-accent-amber/10 text-accent-amber" : "bg-accent-emerald/10 text-accent-emerald"}`}>
                      {isOpen ? "Open" : "Closed"}
                    </span>
                    <span className="text-xs text-dark-400">Due: {new Date(a.deadline).toLocaleDateString()}</span>
                    {a.assignment_type && a.assignment_type !== "assignment" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue capitalize">{a.assignment_type}</span>
                    )}
                    {(a.available_from || a.available_until || a.prerequisite_id) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple">Restricted</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => viewSubmissions(a)} className="p-2 hover:bg-accent-blue/10 rounded-lg text-dark-400 hover:text-accent-blue" title="View Submissions">
                    <ClipboardList className="w-4 h-4" />
                  </button>
                  <button onClick={() => openRubricEditor(a)} className="p-2 hover:bg-accent-purple/10 rounded-lg text-dark-400 hover:text-accent-purple" title="Rubric">
                    <ListChecks className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSimilarityAssignment(a)} className="p-2 hover:bg-accent-cyan/10 rounded-lg text-dark-400 hover:text-accent-cyan" title="Check Similarity">
                    <Search className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(a)} className="p-2 hover:bg-accent-amber/10 rounded-lg text-dark-400 hover:text-accent-amber"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteTarget(a.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-dark-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Assignment Modal — Landscape */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditTarget(null); }} maxWidth="max-w-[80vw]" noPadding>
        <div className="flex flex-col lg:flex-row min-h-[520px] max-h-[85vh]">
          {/* Left — Preview panel */}
          <div className="lg:w-[280px] shrink-0 p-6 border-b lg:border-b-0 lg:border-r border-gray-200/10 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex flex-col lg:rounded-l-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{editTarget ? "Edit Assignment" : "New Assignment"}</h3>
              <button onClick={() => { setShowModal(false); setEditTarget(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/5 transition-colors">
                <X className="w-4 h-4 text-gray-400 dark:text-dark-300" />
              </button>
            </div>

            {/* Live preview */}
            <div className="flex-1 space-y-4">
              <div className="p-4 rounded-xl border border-gray-200/20 dark:border-white/5 bg-white/50 dark:bg-white/[0.02]">
                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1 truncate">
                  {form.title || "Untitled Assignment"}
                </h4>
                {form.description && (
                  <p className="text-xs text-gray-500 dark:text-dark-400 line-clamp-3 mb-3">{form.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <span className={clsx("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize",
                    form.assignment_type === "tutorial" ? "bg-accent-cyan/10 text-accent-cyan" :
                    form.assignment_type === "project" ? "bg-accent-purple/10 text-accent-purple" :
                    "bg-accent-blue/10 text-accent-blue"
                  )}>{form.assignment_type}</span>
                  {form.deadline && (
                    <span className="text-[10px] text-gray-400 dark:text-dark-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(form.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Attachments preview */}
              {form.attachments.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 dark:text-dark-500 uppercase tracking-wider mb-2">
                    {form.attachments.length} Attachment{form.attachments.length !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1.5">
                    {form.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-dark-300 truncate">
                        {att.type === "pdf" ? <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" /> :
                         att.type === "image" ? <Image className="w-3.5 h-3.5 text-accent-emerald shrink-0" /> :
                         att.type === "link" ? <Globe className="w-3.5 h-3.5 text-accent-blue shrink-0" /> :
                         <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        <span className="truncate">{att.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons at bottom */}
            <div className="pt-4 mt-4 border-t border-gray-200/10 dark:border-white/5 space-y-2">
              <button onClick={handleSave}
                disabled={!form.title.trim() || !form.deadline}
                className={clsx("w-full btn-gradient relative z-10 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity",
                  (!form.title.trim() || !form.deadline) && "opacity-40 cursor-not-allowed"
                )}>
                <span className="relative z-10">{editTarget ? "Update Assignment" : "Publish Assignment"}</span>
              </button>
              <button onClick={() => { setShowModal(false); setEditTarget(null); }}
                className="w-full px-4 py-2 text-sm text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>

          {/* Right — Form */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-5 max-w-2xl">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1.5">Title</label>
                <input type="text" placeholder="e.g. Week 3 Tutorial" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 text-sm" autoFocus />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1.5">Description</label>
                <textarea placeholder="Describe the assignment requirements, instructions, marking criteria..." value={form.description} rows={4}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="glass-input w-full px-4 py-2.5 text-sm" />
              </div>

              {/* Type + Deadline row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1.5">Type</label>
                  <div className="flex gap-1.5">
                    {[
                      { v: "assignment", label: "Assignment", icon: ClipboardList, color: "accent-blue" },
                      { v: "tutorial", label: "Tutorial", icon: FileText, color: "accent-cyan" },
                      { v: "project", label: "Project", icon: MapIcon, color: "accent-purple" },
                    ].map(t => (
                      <button key={t.v} type="button" onClick={() => setForm(p => ({ ...p, assignment_type: t.v, quiz_id: "" }))}
                        className={clsx("flex flex-col items-center gap-1 py-2 px-2 rounded-xl text-[10px] font-medium transition-all flex-1",
                          form.assignment_type === t.v
                            ? `bg-${t.color}/20 ring-2 ring-${t.color}/40 text-${t.color}`
                            : `bg-${t.color}/5 text-gray-500 dark:text-dark-300 hover:bg-${t.color}/10`
                        )}>
                        <t.icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1.5">Deadline</label>
                  <input type="datetime-local" value={form.deadline}
                    onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                    className="glass-input w-full px-4 py-2.5 text-sm" />
                </div>
              </div>

              {/* Link Quiz */}
              {form.assignment_type === "assignment" && quizzes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1.5">Link Quiz (optional)</label>
                  <select value={form.quiz_id}
                    onChange={e => setForm(p => ({ ...p, quiz_id: e.target.value }))}
                    className="glass-input w-full px-4 py-2.5 text-sm">
                    <option value="">None</option>
                    {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>
                </div>
              )}

              {/* Attachments */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-2">
                  <Paperclip className="w-3.5 h-3.5 inline mr-1" />Attachments
                </label>

                {/* Existing attachments */}
                {form.attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {form.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200/20 dark:border-white/5 group">
                        {att.type === "pdf" ? <FileText className="w-4 h-4 text-red-400 shrink-0" /> :
                         att.type === "image" ? <Image className="w-4 h-4 text-accent-emerald shrink-0" /> :
                         att.type === "link" ? <Globe className="w-4 h-4 text-accent-blue shrink-0" /> :
                         <Paperclip className="w-4 h-4 text-gray-400 dark:text-dark-400 shrink-0" />}
                        <span className="flex-1 text-sm text-gray-700 dark:text-dark-200 truncate">{att.name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-dark-500 uppercase font-medium">{att.type}</span>
                        <button type="button"
                          onClick={() => setForm(p => ({ ...p, attachments: p.attachments.filter((_, idx) => idx !== i) }))}
                          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add attachment actions */}
                <div className="grid grid-cols-2 gap-3">
                  {/* File upload */}
                  <label className={clsx(
                    "flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center",
                    attachUploading
                      ? "border-accent-purple/30 bg-accent-purple/5 cursor-wait"
                      : "border-gray-200 dark:border-white/10 hover:border-accent-purple/30 hover:bg-accent-purple/5"
                  )}>
                    {attachUploading ? (
                      <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-gray-400 dark:text-dark-400" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-dark-300 font-medium">
                      {attachUploading ? "Uploading..." : "Upload PDF, Image, or File"}
                    </span>
                    <input type="file" className="hidden" disabled={attachUploading}
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAttachUploading(true);
                        try {
                          // For new assignments, use a temp ID; for edits, use real ID
                          const targetId = editTarget?.id || "temp";
                          const res = await assignmentsApi.uploadAttachment(targetId, file);
                          setForm(p => ({ ...p, attachments: [...p.attachments, { name: res.name, url: res.url, type: res.type }] }));
                        } catch (err: any) {
                          alert(err.message || "Upload failed");
                        } finally {
                          setAttachUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>

                  {/* Add link */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input type="url" placeholder="Paste a URL..."
                        value={linkInput} onChange={e => setLinkInput(e.target.value)}
                        className="glass-input flex-1 px-3 py-2 text-xs"
                        onKeyDown={e => {
                          if (e.key === "Enter" && linkInput.trim()) {
                            e.preventDefault();
                            const name = linkInput.replace(/^https?:\/\//, "").split("/")[0] || linkInput;
                            setForm(p => ({ ...p, attachments: [...p.attachments, { name, url: linkInput, type: "link" }] }));
                            setLinkInput("");
                          }
                        }}
                      />
                      <button type="button" disabled={!linkInput.trim()}
                        onClick={() => {
                          if (!linkInput.trim()) return;
                          const name = linkInput.replace(/^https?:\/\//, "").split("/")[0] || linkInput;
                          setForm(p => ({ ...p, attachments: [...p.attachments, { name, url: linkInput, type: "link" }] }));
                          setLinkInput("");
                        }}
                        className={clsx("px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                          linkInput.trim() ? "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20" : "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-dark-500"
                        )}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-dark-500">Add reference links, external resources, video URLs</p>
                  </div>
                </div>
              </div>

              {/* Access Conditions — individual toggles */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-3.5 h-3.5 text-accent-purple" />
                  <label className="text-xs font-medium text-gray-500 dark:text-dark-400">Access Conditions</label>
                </div>
                <div className="space-y-3">
                  {/* Schedule: Available From */}
                  <div className="rounded-xl border border-gray-200/20 dark:border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-dark-200">Schedule Start</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-500">Only available after a specific date</p>
                      </div>
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, available_from: p.available_from ? "" : new Date().toISOString().slice(0, 16) }))}
                        className={clsx("relative w-10 h-5.5 rounded-full transition-colors duration-200",
                          form.available_from ? "bg-accent-purple" : "bg-gray-300 dark:bg-dark-600"
                        )}>
                        <span className={clsx("absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                          form.available_from && "translate-x-[18px]"
                        )} />
                      </button>
                    </div>
                    {form.available_from && (
                      <div className="px-4 pb-3">
                        <input type="datetime-local" value={form.available_from}
                          onChange={e => setForm(p => ({ ...p, available_from: e.target.value }))}
                          className="glass-input w-full px-3 py-2 text-sm" />
                      </div>
                    )}
                  </div>

                  {/* Schedule: Available Until */}
                  <div className="rounded-xl border border-gray-200/20 dark:border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-dark-200">Schedule End</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-500">Close submissions after a specific date</p>
                      </div>
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, available_until: p.available_until ? "" : (p.deadline || new Date().toISOString().slice(0, 16)) }))}
                        className={clsx("relative w-10 h-5.5 rounded-full transition-colors duration-200",
                          form.available_until ? "bg-accent-purple" : "bg-gray-300 dark:bg-dark-600"
                        )}>
                        <span className={clsx("absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                          form.available_until && "translate-x-[18px]"
                        )} />
                      </button>
                    </div>
                    {form.available_until && (
                      <div className="px-4 pb-3">
                        <input type="datetime-local" value={form.available_until}
                          onChange={e => setForm(p => ({ ...p, available_until: e.target.value }))}
                          className="glass-input w-full px-3 py-2 text-sm" />
                      </div>
                    )}
                  </div>

                  {/* Prerequisite */}
                  <div className="rounded-xl border border-gray-200/20 dark:border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-dark-200">Require Prerequisite</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-500">Must complete another assignment first</p>
                      </div>
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, prerequisite_id: p.prerequisite_id ? "" : "", min_grade: p.prerequisite_id ? "" : p.min_grade })) }
                        className={clsx("relative w-10 h-5.5 rounded-full transition-colors duration-200",
                          form.prerequisite_id ? "bg-accent-purple" : "bg-gray-300 dark:bg-dark-600"
                        )}>
                        <span className={clsx("absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                          form.prerequisite_id && "translate-x-[18px]"
                        )} />
                      </button>
                    </div>
                    {/* Always show the prerequisite select so they can pick one to enable it */}
                    <div className="px-4 pb-3 space-y-2">
                      <select value={form.prerequisite_id}
                        onChange={e => setForm(p => ({ ...p, prerequisite_id: e.target.value }))}
                        className="glass-input w-full px-3 py-2 text-sm">
                        <option value="">Select an assignment...</option>
                        {assignments.filter(a => a.id !== editTarget?.id).map(a => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                      </select>
                      {form.prerequisite_id && (
                        <input type="number" min={0} max={100} value={form.min_grade}
                          onChange={e => setForm(p => ({ ...p, min_grade: e.target.value }))}
                          className="glass-input w-full px-3 py-2 text-sm" placeholder="Minimum grade % (optional)" />
                      )}
                    </div>
                  </div>

                  {/* Peer Review */}
                  <div className="rounded-xl border border-gray-200/20 dark:border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="group/pr relative">
                        <p className="text-sm font-medium text-gray-700 dark:text-dark-200">Enable Peer Review</p>
                        <p className="text-[10px] text-gray-400 dark:text-dark-500">Students can view and review each other&apos;s work</p>
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-xl bg-dark-800 border border-white/10 text-xs text-dark-200 leading-relaxed shadow-xl opacity-0 pointer-events-none group-hover/pr:opacity-100 group-hover/pr:pointer-events-auto transition-opacity z-50">
                          When enabled, students can see other students&apos; submissions after the deadline and leave ratings and comments. This encourages collaborative learning and critical thinking.
                        </div>
                      </div>
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, peer_review_enabled: !p.peer_review_enabled }))}
                        className={clsx("relative w-10 h-5.5 rounded-full transition-colors duration-200",
                          form.peer_review_enabled ? "bg-accent-purple" : "bg-gray-300 dark:bg-dark-600"
                        )}>
                        <span className={clsx("absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                          form.peer_review_enabled && "translate-x-[18px]"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Assignment Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Assignment">
        <p className="text-sm text-dark-200 mb-6">Are you sure you want to delete this assignment? All submissions will be lost.</p>
        <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
          <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleDelete} className="px-5 py-2.5 text-sm bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/30 font-medium transition-colors">Delete</button>
        </div>
      </Modal>

      {/* Submissions Panel — Full-width landscape */}
      <Modal open={!!viewingAssignment} onClose={() => { setViewingAssignment(null); setGradingTarget(null); }} maxWidth="max-w-[90vw]" noPadding>
        {viewingAssignment && (
          <div className="flex flex-col lg:flex-row h-[85vh]">
            {/* Left sidebar — Assignment info */}
            <div className="lg:w-[300px] shrink-0 p-6 border-b lg:border-b-0 lg:border-r border-gray-200/10 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex flex-col lg:rounded-l-2xl overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full capitalize",
                  viewingAssignment.assignment_type === "tutorial" ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                  : viewingAssignment.assignment_type === "project" ? "bg-accent-purple/10 text-accent-purple border border-accent-purple/20"
                  : "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                )}>
                  {viewingAssignment.assignment_type || "assignment"}
                </span>
                <button onClick={() => { setViewingAssignment(null); setGradingTarget(null); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/5 transition-colors">
                  <X className="w-4 h-4 text-gray-400 dark:text-dark-300" />
                </button>
              </div>

              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{viewingAssignment.title}</h2>
              {viewingAssignment.description && (
                <p className="text-sm text-gray-600 dark:text-dark-300 mb-4 leading-relaxed">{viewingAssignment.description}</p>
              )}

              <div className="space-y-3 mt-auto">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Due: {new Date(viewingAssignment.deadline).toLocaleString()}</span>
                </div>
                {(() => {
                  const isOpen = new Date(viewingAssignment.deadline) > new Date();
                  return (
                    <span className={clsx("inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                      isOpen ? "bg-accent-amber/10 text-accent-amber border border-accent-amber/20" : "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20"
                    )}>
                      {isOpen ? "Open" : "Closed"}
                    </span>
                  );
                })()}

                {/* Stats summary */}
                <div className="pt-4 mt-4 border-t border-gray-200/10 dark:border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-dark-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Total</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{submissions.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-dark-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Graded</span>
                    <span className="text-sm font-bold text-accent-emerald">{submissions.filter(s => s.grade != null).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-dark-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Ungraded</span>
                    <span className="text-sm font-bold text-accent-amber">{submissions.filter(s => s.grade == null).length}</span>
                  </div>
                  {submissions.filter(s => s.grade != null).length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/10 dark:border-white/5">
                      <span className="text-xs text-gray-500 dark:text-dark-400">Average</span>
                      <span className="text-sm font-bold text-accent-blue">
                        {Math.round(submissions.filter(s => s.grade != null).reduce((sum, s) => sum + (s.grade || 0), 0) / submissions.filter(s => s.grade != null).length)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="pt-4 mt-2 border-t border-gray-200/10 dark:border-white/5 space-y-2">
                  <button onClick={() => { setSimilarityAssignment(viewingAssignment); }}
                    className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/10 border border-accent-cyan/10 transition-colors font-medium">
                    <Search className="w-3.5 h-3.5" /> Similarity Check
                  </button>
                  <button onClick={() => setPlagiarismReportAssignment(viewingAssignment)}
                    className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-accent-purple/5 text-accent-purple hover:bg-accent-purple/10 border border-accent-purple/10 transition-colors font-medium">
                    <FileText className="w-3.5 h-3.5" /> Full Plagiarism Report
                  </button>
                  {viewingAssignment.assignment_type === "tutorial" && (
                    <GradingCalibrationCard assignmentId={viewingAssignment.id} />
                  )}
                </div>
              </div>
            </div>

            {/* Right panel — Submissions list */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header bar with search */}
              <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200/10 dark:border-white/5 shrink-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">Submissions</h3>
                <div className="flex-1 relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-dark-500" />
                  <input
                    type="text"
                    placeholder="Search student name or email..."
                    value={subsSearch}
                    onChange={e => setSubsSearch(e.target.value)}
                    className="glass-input w-full pl-9 pr-3 py-1.5 text-xs rounded-lg"
                  />
                </div>
                <span className="text-xs text-gray-400 dark:text-dark-400 shrink-0">
                  {submissions.filter(s => {
                    if (!subsSearch.trim()) return true;
                    const q = subsSearch.toLowerCase();
                    return s.student_name?.toLowerCase().includes(q) || (s as any).student_email?.toLowerCase().includes(q);
                  }).length} of {submissions.length}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {subsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-20">
                    <ClipboardList className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-dark-400 font-medium">No submissions yet</p>
                    <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">Submissions will appear here once students submit their work</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.filter(s => {
                      if (!subsSearch.trim()) return true;
                      const q = subsSearch.toLowerCase();
                      return s.student_name?.toLowerCase().includes(q) || (s as any).student_email?.toLowerCase().includes(q);
                    }).map(s => {
                      const typeIcon = s.submission_type === "map" ? MapIcon : s.submission_type === "link" ? Link2 : FileText;
                      const TypeIcon = typeIcon;
                      return (
                        <div key={s.id} className="rounded-2xl border border-gray-200/10 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02] overflow-hidden">
                          {/* Submission header */}
                          <div className="flex items-center gap-4 px-5 py-4">
                            <UserAvatar name={s.student_name} photoUrl={s.student_photo_url} size={40} role="student" className="!rounded-xl shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.student_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <TypeIcon className="w-3 h-3 text-gray-400 dark:text-dark-400" />
                                <span className="text-xs text-gray-500 dark:text-dark-400 capitalize">{s.submission_type === "map" ? "Mind Map" : s.submission_type === "link" ? "External Link" : "File Upload"}</span>
                                <span className="text-gray-300 dark:text-dark-600">·</span>
                                <span className="text-xs text-gray-400 dark:text-dark-500">{new Date(s.submitted_at).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {s.grade != null ? (
                                <span className={clsx("text-sm font-bold px-3 py-1.5 rounded-xl",
                                  s.grade >= 80 ? "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20" :
                                  s.grade >= 60 ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20" :
                                  s.grade >= 40 ? "bg-accent-amber/10 text-accent-amber border border-accent-amber/20" :
                                  "bg-red-500/10 text-red-400 border border-red-500/20"
                                )}>
                                  {s.grade}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-dark-500 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200/50 dark:border-white/5">Ungraded</span>
                              )}
                              <button onClick={() => openGrading(s)} className="p-2 hover:bg-accent-blue/10 rounded-xl text-gray-400 dark:text-dark-400 hover:text-accent-blue transition-colors" title="Quick Grade">
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              <button onClick={() => openRubricGrading(s)} className="p-2 hover:bg-accent-purple/10 rounded-xl text-gray-400 dark:text-dark-400 hover:text-accent-purple transition-colors" title="Grade with Rubric">
                                <ListChecks className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Submission body */}
                          <div className="px-5 pb-4 space-y-3">
                            {s.comments && (
                              <p className="text-xs text-gray-500 dark:text-dark-300 italic border-l-2 border-gray-200 dark:border-white/10 pl-3">&quot;{s.comments}&quot;</p>
                            )}

                            {/* Actions row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {s.submission_type === "map" && s.map_id && (
                                <button onClick={() => router.push(`/lecturer/view-map/${s.map_id}`)}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors border border-accent-blue/20 font-medium">
                                  <ExternalLink className="w-3 h-3" /> View Map
                                </button>
                              )}
                              {s.submission_type === "link" && s.external_link && (
                                <a href={s.external_link} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors border border-accent-blue/20 font-medium">
                                  <ExternalLink className="w-3 h-3" /> Open Link
                                </a>
                              )}
                              <AiPlagiarismReport submissionId={s.id} />
                              {viewingAssignment?.assignment_type === "tutorial" && (
                                <AiGradeRecommendation submissionId={s.id} onApply={(grade) => handleAiGrade(s, grade)} />
                              )}
                            </div>

                            {/* Feedback */}
                            {s.feedback && (
                              <div className="bg-accent-blue/5 border border-accent-blue/10 rounded-xl p-3">
                                <p className="text-[10px] font-medium text-gray-400 dark:text-dark-500 uppercase tracking-wider mb-1">Your Feedback</p>
                                <p className="text-xs text-gray-700 dark:text-dark-200">{s.feedback}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Similarity Report Modal */}
      <Modal open={!!similarityAssignment} onClose={() => setSimilarityAssignment(null)} title={`Similarity Report — ${similarityAssignment?.title || ""}`} maxWidth="max-w-5xl">
        {similarityAssignment && <SimilarityReport assignmentId={similarityAssignment.id} />}
      </Modal>

      {/* Full Plagiarism Report Modal */}
      <Modal open={!!plagiarismReportAssignment} onClose={() => setPlagiarismReportAssignment(null)} title="" maxWidth="max-w-[90vw]" noPadding>
        {plagiarismReportAssignment && (
          <div className="h-[85vh]">
            <FullPlagiarismReportView
              assignmentId={plagiarismReportAssignment.id}
              assignmentTitle={plagiarismReportAssignment.title}
              onClose={() => setPlagiarismReportAssignment(null)}
            />
          </div>
        )}
      </Modal>

      {/* Grading Modal */}
      <Modal open={!!gradingTarget} onClose={() => setGradingTarget(null)} title={`Grade — ${gradingTarget?.student_name || ""}`} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Grade (0-100)</label>
            <input type="number" min={0} max={100} value={gradeForm.grade}
              onChange={e => setGradeForm(p => ({ ...p, grade: e.target.value }))}
              className="glass-input w-full px-4 py-2.5 text-sm" placeholder="e.g. 85" />
          </div>
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Feedback</label>
            <textarea rows={4} value={gradeForm.feedback}
              onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))}
              className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Write feedback for the student..." />
          </div>
          {/* Override reason — only when overriding a non-matching AI recommendation */}
          {aiGradeForTarget != null && gradeForm.grade !== "" && Math.abs(aiGradeForTarget - parseFloat(gradeForm.grade || "0")) >= 0.5 && (
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">
                Override reason <span className="text-dark-500">(AI suggested {aiGradeForTarget} — optional, logged for AI calibration)</span>
              </label>
              <input type="text" value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Why you're departing from the AI recommendation..." />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <button onClick={() => setGradingTarget(null)} className="px-5 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleGrade} className="btn-gradient relative z-10 px-5 py-2.5 rounded-xl text-sm font-medium">
              <span className="relative z-10 flex items-center gap-1.5"><Check className="w-4 h-4" /> Save Grade</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Rubric Creation/Edit Modal */}
      <Modal open={!!rubricTarget} onClose={() => setRubricTarget(null)} title={`Rubric — ${rubricTarget?.title || ""}`} maxWidth="max-w-lg">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Rubric Title</label>
            <input type="text" placeholder="e.g. Assignment 1 Rubric" value={rubricTitle}
              onChange={e => setRubricTitle(e.target.value)} className="glass-input w-full px-4 py-2.5 text-sm" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-dark-200 font-medium">Criteria</label>
              <button onClick={() => setRubricCriteria(prev => [...prev, { name: "", description: "", max_points: 10 }])}
                className="text-xs text-accent-purple hover:text-white flex items-center gap-1 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Criterion
              </button>
            </div>
            {rubricCriteria.map((c, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Criterion name" value={c.name}
                    onChange={e => setRubricCriteria(prev => prev.map((cr, idx) => idx === i ? { ...cr, name: e.target.value } : cr))}
                    className="glass-input flex-1 px-3 py-2 text-sm" />
                  <input type="number" min={1} max={100} value={c.max_points}
                    onChange={e => setRubricCriteria(prev => prev.map((cr, idx) => idx === i ? { ...cr, max_points: Number(e.target.value) } : cr))}
                    className="glass-input w-20 px-3 py-2 text-sm text-center" />
                  <span className="text-xs text-dark-400">pts</span>
                  {rubricCriteria.length > 1 && (
                    <button onClick={() => setRubricCriteria(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1.5 text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <input type="text" placeholder="Description (optional)" value={c.description}
                  onChange={e => setRubricCriteria(prev => prev.map((cr, idx) => idx === i ? { ...cr, description: e.target.value } : cr))}
                  className="glass-input w-full px-3 py-1.5 text-xs" />
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-accent-purple/5 border border-accent-purple/10 text-sm font-medium text-dark-200">
            Total: {rubricCriteria.reduce((s, c) => s + (c.max_points || 0), 0)} points
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <button onClick={() => setRubricTarget(null)} className="px-5 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSaveRubric} className="btn-gradient relative z-10 px-5 py-2.5 rounded-xl text-sm font-medium">
              <span className="relative z-10">{rubric ? "Update Rubric" : "Create Rubric"}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Rubric-Based Grading Modal */}
      <Modal open={!!rubricGradingTarget} onClose={() => { setRubricGradingTarget(null); setActiveRubric(null); }}
        title={`Rubric Grade — ${rubricGradingTarget?.student_name || ""}`} maxWidth="max-w-lg">
        {activeRubric ? (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <p className="text-xs text-dark-400 font-medium">{activeRubric.title}</p>
            {activeRubric.criteria.map((c: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    {c.description && <p className="text-xs text-dark-400 mt-0.5">{c.description}</p>}
                  </div>
                  <span className="text-sm font-bold text-dark-200">{rubricScores[c.name] || 0} / {c.max_points}</span>
                </div>
                <input type="range" min={0} max={c.max_points} step={1}
                  value={rubricScores[c.name] || 0}
                  onChange={e => setRubricScores(prev => ({ ...prev, [c.name]: Number(e.target.value) }))}
                  className="w-full accent-accent-purple" />
              </div>
            ))}

            <div className="p-4 rounded-xl border border-accent-purple/20 bg-accent-purple/5">
              <p className="text-sm font-semibold text-white">
                Total: {Object.values(rubricScores).reduce((s, v) => s + v, 0)} / {activeRubric.criteria.reduce((s: number, c: any) => s + (c.max_points || 0), 0)}
                <span className="text-dark-400 ml-2 font-normal">
                  ({activeRubric.criteria.reduce((s: number, c: any) => s + (c.max_points || 0), 0) > 0
                    ? Math.round(Object.values(rubricScores).reduce((s, v) => s + v, 0) / activeRubric.criteria.reduce((s: number, c: any) => s + (c.max_points || 0), 0) * 100)
                    : 0}%)
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Additional Feedback</label>
              <textarea rows={3} value={rubricFeedback}
                onChange={e => setRubricFeedback(e.target.value)}
                className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Optional feedback..." />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button onClick={() => { setRubricGradingTarget(null); setActiveRubric(null); }}
                className="px-5 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleRubricGrade} className="btn-gradient relative z-10 px-5 py-2.5 rounded-xl text-sm font-medium">
                <span className="relative z-10 flex items-center gap-1.5"><Check className="w-4 h-4" /> Save Rubric Grade</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <ListChecks className="w-10 h-10 text-dark-500 mx-auto mb-3" />
            <p className="text-dark-400 text-sm">No rubric found for this assignment. Create one first.</p>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}

/** AI↔human grade agreement for this assignment (QWK + MAE), built from the
 *  lecturer's accept/override decisions. Turns "trust the AI" into a measured claim. */
function GradingCalibrationCard({ assignmentId }: { assignmentId: string }) {
  const [cal, setCal] = useState<GradingCalibration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    aiGradingApi.calibration(assignmentId)
      .then(c => { if (alive) setCal(c); })
      .catch(() => { /* non-fatal */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [assignmentId]);

  if (!loaded || !cal || cal.reviewed_count === 0) return null;

  const qwk = cal.qwk;
  const qwkLabel = qwk == null ? "—"
    : qwk >= 0.8 ? "near-perfect" : qwk >= 0.6 ? "substantial" : qwk >= 0.4 ? "moderate" : "weak";
  const qwkColor = qwk == null ? "text-dark-400"
    : qwk >= 0.6 ? "text-accent-emerald" : qwk >= 0.4 ? "text-accent-amber" : "text-red-400";

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-dark-200 uppercase tracking-wide">
        <BarChart3 className="w-3.5 h-3.5 text-accent-cyan" /> AI Grading Accuracy
      </p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-dark-400">Agreement (QWK)</span>
        <span className={clsx("font-semibold tabular-nums", qwkColor)}>
          {qwk == null ? "—" : qwk.toFixed(2)} <span className="text-dark-500 font-normal">{qwkLabel}</span>
        </span>
      </div>
      {cal.mae != null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-dark-400">Mean error</span>
          <span className="text-dark-200 tabular-nums">{cal.mae} pts</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-dark-400">Reviewed</span>
        <span className="text-dark-200 tabular-nums">{cal.reviewed_count} · {cal.override_count} overridden</span>
      </div>
      <p className="text-[10px] text-dark-500 pt-0.5">Measured against your confirmed grades.</p>
    </div>
  );
}
