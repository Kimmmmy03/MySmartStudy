"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { quizzesApi, QuizOut, QuestionOut, QuizAttemptOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { ArrowLeft, Clock, HelpCircle, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

export default function StudentQuizzesPage() {
  const { cid } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptMap, setAttemptMap] = useState<Record<string, QuizAttemptOut | null>>({});

  // Taking quiz
  const [activeQuiz, setActiveQuiz] = useState<QuizOut | null>(null);
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Results
  const [showResults, setShowResults] = useState(false);
  const [resultQuestions, setResultQuestions] = useState<QuestionOut[]>([]);
  const [resultAttempt, setResultAttempt] = useState<QuizAttemptOut | null>(null);

  useEffect(() => {
    if (!cid) return;
    const load = async () => {
      const qList = await quizzesApi.list(cid as string);
      setQuizzes(qList);
      // Check existing attempts
      const map: Record<string, QuizAttemptOut | null> = {};
      await Promise.all(qList.map(async q => {
        try {
          map[q.id] = await quizzesApi.getMyAttempt(q.id);
        } catch {
          map[q.id] = null;
        }
      }));
      setAttemptMap(map);
      setLoading(false);
    };
    load();
  }, [cid]);

  const startQuiz = async (quiz: QuizOut) => {
    const qs = await quizzesApi.getQuestions(quiz.id);
    setActiveQuiz(quiz);
    setQuestions(qs);
    setAnswers({});
    if (quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  };

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Auto-submit on time up
  useEffect(() => {
    if (timeLeft === 0 && activeQuiz) {
      handleSubmit();
    }
  }, [timeLeft]);

  const handleSubmit = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const result = await quizzesApi.submitAttempt(activeQuiz.id, answers);
      setAttemptMap(prev => ({ ...prev, [activeQuiz.id]: result }));
      setResultAttempt(result);
      if (activeQuiz.show_results) {
        const rqs = await quizzesApi.getResults(activeQuiz.id);
        setResultQuestions(rqs);
      }
      setShowResults(true);
      setActiveQuiz(null);
      setTimeLeft(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const viewPastResults = async (quiz: QuizOut) => {
    const attempt = attemptMap[quiz.id];
    if (!attempt) return;
    setResultAttempt(attempt);
    if (quiz.show_results) {
      try {
        const rqs = await quizzesApi.getResults(quiz.id);
        setResultQuestions(rqs);
      } catch {
        setResultQuestions([]);
      }
    } else {
      setResultQuestions([]);
    }
    setShowResults(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Quizzes</h1>

      {loading ? (
        <p className="text-dark-400 text-center py-8">Loading...</p>
      ) : quizzes.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No quizzes available.</p>
      ) : (
        <div className="space-y-3">
          {quizzes.map(q => {
            const attempt = attemptMap[q.id];
            const isOpen = !q.deadline || new Date(q.deadline) > new Date();
            const completed = !!attempt;
            return (
              <div key={q.id} className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{q.title}</h3>
                    {q.description && <p className="text-sm text-dark-300 mt-1">{q.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {completed ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald">
                          Completed — {attempt.percentage}%
                        </span>
                      ) : isOpen ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber">
                          Not attempted
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                          Closed
                        </span>
                      )}
                      <span className="text-xs text-dark-400 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> {q.question_count} questions
                      </span>
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
                  <div>
                    {completed ? (
                      <button onClick={() => viewPastResults(q)}
                        className="px-4 py-2 text-sm border border-accent-blue/30 text-accent-blue rounded-lg hover:bg-accent-blue/10">
                        View Results
                      </button>
                    ) : isOpen ? (
                      <button onClick={() => startQuiz(q)}
                        className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm">
                        <span className="relative z-10">Start Quiz</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quiz Taking Modal */}
      <Modal open={!!activeQuiz} onClose={() => {}} title={activeQuiz?.title || "Quiz"}>
        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
          {timeLeft !== null && (
            <div className={clsx("sticky top-0 z-10 flex items-center justify-between p-3 rounded-lg",
              timeLeft < 60 ? "bg-red-500/20 text-red-400" : "bg-accent-blue/10 text-accent-blue"
            )}>
              <span className="text-sm font-medium flex items-center gap-1">
                <Clock className="w-4 h-4" /> Time remaining
              </span>
              <span className="text-lg font-bold">{formatTime(timeLeft)}</span>
            </div>
          )}

          {questions.map((q, idx) => (
            <div key={q.id} className="p-4 rounded-xl border border-white/5 bg-white/3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-400 font-medium">Question {idx + 1}</span>
                <span className="text-xs text-dark-400">{q.points} pt{q.points !== 1 ? "s" : ""}</span>
              </div>
              <p className="text-sm text-white font-medium">{q.text}</p>

              {q.type === "mcq" && (
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <label key={oIdx}
                      className={clsx("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        answers[q.id] === String(oIdx)
                          ? "border-accent-blue/40 bg-accent-blue/10"
                          : "border-white/5 hover:border-white/10"
                      )}>
                      <input type="radio" name={`q-${q.id}`}
                        checked={answers[q.id] === String(oIdx)}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.id]: String(oIdx) }))}
                        className="text-accent-blue" />
                      <span className="text-sm text-dark-200">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="flex gap-4">
                  {["true", "false"].map(val => (
                    <label key={val}
                      className={clsx("flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                        answers[q.id] === val
                          ? "border-accent-blue/40 bg-accent-blue/10"
                          : "border-white/5 hover:border-white/10"
                      )}>
                      <input type="radio" name={`q-${q.id}`}
                        checked={answers[q.id] === val}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.id]: val }))} />
                      <span className="text-sm text-dark-200">{val === "true" ? "True" : "False"}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "short_answer" && (
                <input type="text" placeholder="Your answer..."
                  value={answers[q.id] || ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  className="glass-input w-full text-sm" />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-dark-400">
              {Object.keys(answers).length}/{questions.length} answered
            </span>
            <div className="flex gap-2">
              <button onClick={() => { setActiveQuiz(null); setTimeLeft(null); }}
                className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                <span className="relative z-10">{submitting ? "Submitting..." : "Submit Quiz"}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal open={showResults} onClose={() => { setShowResults(false); setResultAttempt(null); setResultQuestions([]); }} title="Quiz Results">
        {resultAttempt && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="text-center p-6 rounded-xl bg-white/3 border border-white/5">
              <div className={clsx("text-4xl font-bold mb-1",
                resultAttempt.percentage >= 80 ? "text-accent-emerald" :
                resultAttempt.percentage >= 60 ? "text-accent-blue" :
                resultAttempt.percentage >= 40 ? "text-accent-amber" : "text-red-400"
              )}>
                {resultAttempt.percentage}%
              </div>
              <p className="text-sm text-dark-300">
                {resultAttempt.score} / {resultAttempt.total_points} points
              </p>
            </div>

            {resultQuestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">Question Review</h3>
                {resultQuestions.map((q, idx) => {
                  const studentAns = resultAttempt.answers[q.id] || "";
                  const correct = q.correct_answer || "";
                  let isCorrect = false;
                  if (q.type === "mcq" || q.type === "true_false") {
                    isCorrect = studentAns.toLowerCase() === correct.toLowerCase();
                  } else {
                    isCorrect = studentAns.toLowerCase().trim() === correct.toLowerCase().trim();
                  }

                  return (
                    <div key={q.id} className={clsx("p-3 rounded-xl border",
                      isCorrect ? "border-accent-emerald/20 bg-accent-emerald/5" : "border-red-500/20 bg-red-500/5"
                    )}>
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle className="w-4 h-4 text-accent-emerald mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-white">Q{idx + 1}: {q.text}</p>
                          <p className="text-xs text-dark-300 mt-1">
                            Your answer: {q.type === "mcq" && q.options.length > 0
                              ? q.options[parseInt(studentAns)] || "No answer"
                              : studentAns || "No answer"}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-accent-emerald mt-0.5">
                              Correct: {q.type === "mcq" && q.options.length > 0
                                ? q.options[parseInt(correct)] || correct
                                : correct}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
