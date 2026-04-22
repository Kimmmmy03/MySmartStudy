"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy } from "lucide-react";

interface QuizQuestion {
  question: string;
  type: "mcq" | "true_false";
  options: string[];
  correct_answer: string;
  explanation: string;
}

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  percentage: number;
  createdAt: string;
}

interface PracticeQuizProps {
  content: string;
  onComplete?: (score: number, total: number, percentage: number) => void;
  attempts?: QuizAttempt[];
}

export default function PracticeQuiz({ content, onComplete, attempts = [] }: PracticeQuizProps) {
  const questions: QuizQuestion[] = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return [];
    }
  }, [content]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentIdx];
  const isCorrect = submitted && selectedAnswer === currentQuestion?.correct_answer;
  const isLastQuestion = currentIdx === questions.length - 1;

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    setSubmitted(true);
    setAnsweredCount(prev => prev + 1);
    if (selectedAnswer === currentQuestion.correct_answer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResults(true);
      const finalScore = selectedAnswer === currentQuestion.correct_answer ? score + 1 : score;
      const pct = Math.round((finalScore / questions.length) * 100);
      onComplete?.(finalScore, questions.length, pct);
    } else {
      setCurrentIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setSubmitted(false);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setSubmitted(false);
    setScore(0);
    setAnsweredCount(0);
    setShowResults(false);
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-dark-400">
        <p>No quiz questions to display.</p>
      </div>
    );
  }

  // Final results screen
  if (showResults) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 text-center"
      >
        <Trophy className={`w-16 h-16 mx-auto mb-4 ${pct >= 70 ? "text-amber-400" : "text-dark-400"}`} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quiz Complete!</h2>
        <p className="text-dark-300 mb-6">Here are your results</p>

        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 border-accent-blue/30 mb-6">
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{pct}%</div>
            <div className="text-xs text-dark-400">{score}/{questions.length}</div>
          </div>
        </div>

        <p className="text-dark-200 mb-6">
          {pct >= 90 ? "Excellent work! You have a strong grasp of this material." :
           pct >= 70 ? "Good job! You understand most of the key concepts." :
           pct >= 50 ? "Not bad, but there is room for improvement. Review the material and try again." :
           "Keep studying! Review the material and give it another shot."}
        </p>

        <button
          onClick={handleRestart}
          className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>

        {/* Attempt history */}
        {attempts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-sm font-semibold text-dark-200 mb-3">Previous Attempts</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {attempts.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/3 text-sm">
                  <span className="text-dark-300">
                    #{attempts.length - i} &middot; {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className={`font-medium ${a.percentage >= 70 ? "text-emerald-400" : a.percentage >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {a.score}/{a.total} ({a.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  const isTrueFalse = currentQuestion.type === "true_false";
  const options = isTrueFalse ? ["True", "False"] : currentQuestion.options;

  return (
    <div className="space-y-6">
      {/* Score tracker */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-dark-300">
          Question {currentIdx + 1} of {questions.length}
        </span>
        <span className="text-sm text-dark-300">
          Score: <span className="text-gray-900 dark:text-white font-semibold">{score}</span>/{answeredCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-blue rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="glass-card p-6">
            <p className="text-gray-900 dark:text-white text-lg font-medium mb-6 leading-relaxed">
              {currentQuestion.question}
            </p>

            {/* Options */}
            <div className="space-y-3">
              {options.map((option, i) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = submitted && option === currentQuestion.correct_answer;
                const isWrongSelected = submitted && isSelected && !isCorrect;

                return (
                  <button
                    key={i}
                    onClick={() => !submitted && setSelectedAnswer(option)}
                    disabled={submitted}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                      isCorrectOption
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : isWrongSelected
                        ? "border-red-500/50 bg-red-500/10"
                        : isSelected
                        ? "border-accent-blue/50 bg-accent-blue/10"
                        : "border-white/5 hover:border-white/10 hover:bg-white/5"
                    } ${submitted ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {/* Option indicator */}
                    {isTrueFalse ? null : (
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold shrink-0 ${
                        isCorrectOption
                          ? "border-emerald-500 text-emerald-400"
                          : isWrongSelected
                          ? "border-red-500 text-red-400"
                          : isSelected
                          ? "border-accent-blue text-accent-blue"
                          : "border-white/20 text-dark-400"
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                    )}

                    <span className={`text-sm flex-1 ${
                      isCorrectOption ? "text-emerald-300" :
                      isWrongSelected ? "text-red-300" :
                      isSelected ? "text-gray-900 dark:text-white" : "text-dark-200"
                    }`}>
                      {option}
                    </span>

                    {submitted && isCorrectOption && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    {isWrongSelected && (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {submitted && currentQuestion.explanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5"
              >
                <p className="text-xs uppercase tracking-wider text-dark-400 mb-1">Explanation</p>
                <p className="text-sm text-dark-200 leading-relaxed">{currentQuestion.explanation}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors text-sm font-medium"
          >
            {isLastQuestion ? "View Results" : "Next Question"}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
