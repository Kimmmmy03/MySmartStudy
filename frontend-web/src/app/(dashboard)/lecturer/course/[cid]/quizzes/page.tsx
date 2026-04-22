"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizzesApi, QuizOut, QuestionOut, QuizAttemptOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Users, X, Check, HelpCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

type QuestionForm = {
  type: string;
  text: string;
  options: string[];
  correct_answer: string;
  points: number;
};

const emptyQuestion: QuestionForm = { type: "mcq", text: "", options: ["", "", "", ""], correct_answer: "0", points: 1 };

export default function LecturerQuizzesPage() {
  const { cid } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizOut[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit Quiz
  const [showCreate, setShowCreate] = useState(false);
  const [quizForm, setQuizForm] = useState({ title: "", description: "", time_limit_minutes: "", deadline: "", shuffle_questions: false, show_results: true });
  const [questions, setQuestions] = useState<QuestionForm[]>([{ ...emptyQuestion }]);
  const [editTarget, setEditTarget] = useState<QuizOut | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // View attempts
  const [viewingQuiz, setViewingQuiz] = useState<QuizOut | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptOut[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  useEffect(() => {
    if (!cid) return;
    quizzesApi.list(cid as string).then(setQuizzes).finally(() => setLoading(false));
  }, [cid]);

  const resetForm = () => {
    setQuizForm({ title: "", description: "", time_limit_minutes: "", deadline: "", shuffle_questions: false, show_results: true });
    setQuestions([{ ...emptyQuestion }]);
    setEditTarget(null);
  };

  const handleSave = async () => {
    if (!quizForm.title.trim() || !cid) return;
    const validQuestions = questions.filter(q => q.text.trim());

    if (editTarget) {
      const updated = await quizzesApi.update(editTarget.id, {
        title: quizForm.title,
        description: quizForm.description,
        time_limit_minutes: quizForm.time_limit_minutes ? parseInt(quizForm.time_limit_minutes) : null,
        deadline: quizForm.deadline || null,
        shuffle_questions: quizForm.shuffle_questions,
        show_results: quizForm.show_results,
      });
      setQuizzes(prev => prev.map(q => q.id === editTarget.id ? updated : q));
    } else {
      const created = await quizzesApi.create({
        course_id: cid as string,
        title: quizForm.title,
        description: quizForm.description,
        time_limit_minutes: quizForm.time_limit_minutes ? parseInt(quizForm.time_limit_minutes) : null,
        deadline: quizForm.deadline || null,
        shuffle_questions: quizForm.shuffle_questions,
        show_results: quizForm.show_results,
        questions: validQuestions.map(q => ({
          type: q.type,
          text: q.text,
          options: q.type === "mcq" ? q.options.filter(o => o.trim()) : [],
          correct_answer: q.correct_answer,
          points: q.points,
        })),
      });
      setQuizzes(prev => [created, ...prev]);
    }
    setShowCreate(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await quizzesApi.delete(deleteTarget);
    setQuizzes(prev => prev.filter(q => q.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const viewAttempts = async (quiz: QuizOut) => {
    setViewingQuiz(quiz);
    setAttemptsLoading(true);
    try {
      const a = await quizzesApi.getAttempts(quiz.id);
      setAttempts(a);
    } catch {
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  };

  const addQuestion = () => setQuestions(prev => [...prev, { ...emptyQuestion }]);

  const updateQuestion = (idx: number, field: string, value: string | string[] | number) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const addOption = (qIdx: number) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: [...q.options, ""] } : q));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Quizzes</h1>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> Create Quiz</span>
        </button>
      </div>

      {loading ? (
        <p className="text-dark-400 text-center py-8">Loading...</p>
      ) : quizzes.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No quizzes yet.</p>
      ) : (
        <div className="space-y-3">
          {quizzes.map(q => {
            const isOpen = !q.deadline || new Date(q.deadline) > new Date();
            return (
              <div key={q.id} className="glass-card p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{q.title}</h3>
                  <p className="text-sm text-dark-300 mt-1 line-clamp-1">{q.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full",
                      isOpen ? "bg-accent-amber/10 text-accent-amber" : "bg-accent-emerald/10 text-accent-emerald"
                    )}>
                      {isOpen ? "Open" : "Closed"}
                    </span>
                    <span className="text-xs text-dark-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> {q.question_count} questions
                    </span>
                    <span className="text-xs text-dark-400">{q.total_points} pts</span>
                    {q.time_limit_minutes && (
                      <span className="text-xs text-dark-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {q.time_limit_minutes} min
                      </span>
                    )}
                    {q.deadline && (
                      <span className="text-xs text-dark-400">Due: {new Date(q.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => viewAttempts(q)} className="p-2 hover:bg-accent-blue/10 rounded-lg text-dark-400 hover:text-accent-blue" title="View Attempts">
                    <Users className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(q.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-dark-400 hover:text-red-400" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Quiz Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title={editTarget ? "Edit Quiz" : "Create Quiz"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <input type="text" placeholder="Quiz Title" value={quizForm.title}
            onChange={e => setQuizForm(p => ({ ...p, title: e.target.value }))}
            className="glass-input w-full" />
          <textarea placeholder="Description (optional)" value={quizForm.description} rows={2}
            onChange={e => setQuizForm(p => ({ ...p, description: e.target.value }))}
            className="glass-input w-full" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1">Time Limit (minutes)</label>
              <input type="number" placeholder="No limit" value={quizForm.time_limit_minutes}
                onChange={e => setQuizForm(p => ({ ...p, time_limit_minutes: e.target.value }))}
                className="glass-input w-full" />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Deadline</label>
              <input type="datetime-local" value={quizForm.deadline}
                onChange={e => setQuizForm(p => ({ ...p, deadline: e.target.value }))}
                className="glass-input w-full" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer">
              <input type="checkbox" checked={quizForm.shuffle_questions}
                onChange={e => setQuizForm(p => ({ ...p, shuffle_questions: e.target.checked }))}
                className="rounded" />
              Shuffle Questions
            </label>
            <label className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer">
              <input type="checkbox" checked={quizForm.show_results}
                onChange={e => setQuizForm(p => ({ ...p, show_results: e.target.checked }))}
                className="rounded" />
              Show Results
            </label>
          </div>

          {!editTarget && (
            <>
              <h3 className="text-sm font-semibold text-white pt-2">Questions</h3>
              {questions.map((q, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-white/5 bg-white/3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dark-400 font-medium">Q{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <select value={q.type} onChange={e => {
                        const t = e.target.value;
                        updateQuestion(idx, "type", t);
                        if (t === "true_false") {
                          updateQuestion(idx, "options", ["True", "False"]);
                          updateQuestion(idx, "correct_answer", "true");
                        } else if (t === "mcq") {
                          updateQuestion(idx, "options", ["", "", "", ""]);
                          updateQuestion(idx, "correct_answer", "0");
                        } else {
                          updateQuestion(idx, "options", []);
                          updateQuestion(idx, "correct_answer", "");
                        }
                      }} className="glass-input text-xs py-1 px-2">
                        <option value="mcq">Multiple Choice</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                      </select>
                      <input type="number" min={0.5} step={0.5} value={q.points}
                        onChange={e => updateQuestion(idx, "points", parseFloat(e.target.value) || 1)}
                        className="glass-input w-16 text-xs py-1 px-2" title="Points" />
                      {questions.length > 1 && (
                        <button onClick={() => removeQuestion(idx)} className="text-red-400 hover:text-red-300">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea placeholder="Question text" value={q.text} rows={2}
                    onChange={e => updateQuestion(idx, "text", e.target.value)}
                    className="glass-input w-full text-sm" />

                  {q.type === "mcq" && (
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input type="radio" name={`q${idx}-correct`}
                            checked={q.correct_answer === String(oIdx)}
                            onChange={() => updateQuestion(idx, "correct_answer", String(oIdx))}
                            className="text-accent-blue" />
                          <input type="text" placeholder={`Option ${oIdx + 1}`} value={opt}
                            onChange={e => updateOption(idx, oIdx, e.target.value)}
                            className="glass-input flex-1 text-sm py-1.5" />
                        </div>
                      ))}
                      <button onClick={() => addOption(idx)} className="text-xs text-accent-blue hover:text-accent-cyan">
                        + Add Option
                      </button>
                    </div>
                  )}

                  {q.type === "true_false" && (
                    <div className="flex gap-4">
                      {["true", "false"].map(val => (
                        <label key={val} className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer">
                          <input type="radio" name={`q${idx}-tf`}
                            checked={q.correct_answer === val}
                            onChange={() => updateQuestion(idx, "correct_answer", val)} />
                          {val === "true" ? "True" : "False"}
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === "short_answer" && (
                    <input type="text" placeholder="Correct answer" value={q.correct_answer}
                      onChange={e => updateQuestion(idx, "correct_answer", e.target.value)}
                      className="glass-input w-full text-sm" />
                  )}
                </div>
              ))}
              <button onClick={addQuestion}
                className="w-full py-2 border border-dashed border-white/10 rounded-xl text-sm text-dark-300 hover:text-white hover:border-white/20 transition-colors">
                + Add Question
              </button>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleSave} className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm">
              <span className="relative z-10">{editTarget ? "Update" : "Publish Quiz"}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Quiz">
        <p className="text-sm text-dark-200 mb-4">Delete this quiz and all attempts?</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/30">Delete</button>
        </div>
      </Modal>

      {/* Attempts Modal */}
      <Modal open={!!viewingQuiz} onClose={() => setViewingQuiz(null)} title={`Attempts — ${viewingQuiz?.title || ""}`}>
        {attemptsLoading ? (
          <p className="text-dark-400 text-sm text-center py-6">Loading...</p>
        ) : attempts.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-6">No attempts yet.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <div className="text-xs text-dark-400 mb-2">
              Average: {(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length).toFixed(1)}%
            </div>
            {attempts.map(a => (
              <div key={a.id} className="p-3 rounded-xl border border-white/5 bg-white/3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={a.student_name} photoUrl={a.student_photo_url} size={36} role="student" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{a.student_name}</p>
                    <p className="text-xs text-dark-400">{new Date(a.submitted_at).toLocaleString()}</p>
                  </div>
                </div>
                <span className={clsx("text-sm font-bold px-2.5 py-1 rounded-full",
                  a.percentage >= 80 ? "bg-accent-emerald/10 text-accent-emerald" :
                  a.percentage >= 60 ? "bg-accent-blue/10 text-accent-blue" :
                  a.percentage >= 40 ? "bg-accent-amber/10 text-accent-amber" :
                  "bg-red-500/10 text-red-400"
                )}>
                  {a.score}/{a.total_points} ({a.percentage}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
