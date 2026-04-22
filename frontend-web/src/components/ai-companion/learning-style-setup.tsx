"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, BookOpen, Headphones, Eye, Hand, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { aiCompanionApi, LearningStyleQuestion } from "@/lib/api";

const STYLE_INFO: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
  visual: {
    icon: <Eye className="w-8 h-8" />,
    label: "Visual Learner",
    description: "You learn best through images, diagrams, and spatial understanding. Mind maps, charts, and color-coded notes work great for you!",
  },
  auditory: {
    icon: <Headphones className="w-8 h-8" />,
    label: "Auditory Learner",
    description: "You learn best through listening and discussion. Lectures, podcasts, and study groups are your strength!",
  },
  reading: {
    icon: <BookOpen className="w-8 h-8" />,
    label: "Reading/Writing Learner",
    description: "You learn best through reading and writing. Textbooks, notes, and written summaries help you retain information!",
  },
  kinesthetic: {
    icon: <Hand className="w-8 h-8" />,
    label: "Kinesthetic Learner",
    description: "You learn best through hands-on experience. Practice problems, labs, and real-world applications are your forte!",
  },
};

interface LearningStyleSetupProps {
  onComplete: (style: string) => void;
  lightMode?: boolean;
}

export default function LearningStyleSetup({ onComplete, lightMode }: LearningStyleSetupProps) {
  const [step, setStep] = useState<"intro" | "questions" | "result">("intro");
  const [questions, setQuestions] = useState<LearningStyleQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Light mode color classes
  const textPrimary = lightMode ? "text-gray-900" : "text-white";
  const textSecondary = lightMode ? "text-gray-500" : "text-gray-400";
  const textQuestion = lightMode ? "text-gray-800" : "text-white";
  const optionBg = lightMode
    ? "border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 text-gray-700 hover:text-gray-900"
    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent-blue/50 text-gray-300 hover:text-white";
  const progressBg = lightMode ? "bg-gray-200" : "bg-white/5";

  const startAssessment = async () => {
    setLoading(true);
    try {
      const data = await aiCompanionApi.assessStyle();
      setQuestions(data.questions);
      setStep("questions");
    } catch {
      setQuestions([
        { id: "1", text: "When studying a new topic, I prefer to:", options: [{ value: "visual", text: "Look at diagrams and charts" }, { value: "auditory", text: "Listen to explanations" }, { value: "reading", text: "Read detailed text" }, { value: "kinesthetic", text: "Try hands-on exercises" }] },
        { id: "2", text: "I remember things best when I:", options: [{ value: "visual", text: "See images or videos" }, { value: "auditory", text: "Hear them explained aloud" }, { value: "reading", text: "Write them down" }, { value: "kinesthetic", text: "Practice doing them" }] },
        { id: "3", text: "In class, I find it most helpful to:", options: [{ value: "visual", text: "Watch demonstrations" }, { value: "auditory", text: "Listen to the lecturer" }, { value: "reading", text: "Take detailed notes" }, { value: "kinesthetic", text: "Participate in activities" }] },
        { id: "4", text: "When preparing for exams, I prefer:", options: [{ value: "visual", text: "Creating mind maps and diagrams" }, { value: "auditory", text: "Discussing topics with friends" }, { value: "reading", text: "Re-reading notes and textbooks" }, { value: "kinesthetic", text: "Solving practice problems" }] },
        { id: "5", text: "I find it easiest to follow:", options: [{ value: "visual", text: "Visual presentations with images" }, { value: "auditory", text: "Verbal instructions" }, { value: "reading", text: "Written step-by-step guides" }, { value: "kinesthetic", text: "Learning by trial and error" }] },
      ]);
      setStep("questions");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      const counts: Record<string, number> = {};
      newAnswers.forEach((a) => {
        counts[a] = (counts[a] || 0) + 1;
      });
      const topStyle = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

      setLoading(true);
      try {
        await aiCompanionApi.updateLearningProfile({ learning_style: topStyle });
      } catch {
        // Continue even if save fails
      }
      setResult(topStyle);
      setStep("result");
      setLoading(false);
    }
  };

  const progress = questions.length > 0 ? ((currentQ + (step === "result" ? 1 : 0)) / questions.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-2">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>Discover Your Learning Style</h3>
            <p className={`text-sm ${textSecondary} leading-relaxed`}>
              Answer a few quick questions so SmartBuddy can personalize study recommendations just for you.
            </p>
            <button
              onClick={startAssessment}
              disabled={loading}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Let&apos;s Go <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === "questions" && questions.length > 0 && (
          <motion.div
            key={`q-${currentQ}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col flex-1 p-4"
          >
            {/* Progress bar */}
            <div className="mb-4">
              <div className={`flex items-center justify-between text-xs ${textSecondary} mb-1.5`}>
                <span>Question {currentQ + 1} of {questions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className={`h-1.5 ${progressBg} rounded-full overflow-hidden`}>
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                  initial={{ width: `${((currentQ) / questions.length) * 100}%` }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <p className={`text-sm font-medium ${textQuestion} mb-4 leading-relaxed`}>
              {questions[currentQ].text}
            </p>

            <div className="flex flex-col gap-2 flex-1">
              {questions[currentQ].options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  className={`text-left p-3 rounded-xl border transition-all text-sm ${optionBg}`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white"
            >
              {STYLE_INFO[result]?.icon || <Sparkles className="w-8 h-8" />}
            </motion.div>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>
              {STYLE_INFO[result]?.label || result}
            </h3>
            <p className={`text-sm ${textSecondary} leading-relaxed`}>
              {STYLE_INFO[result]?.description || "Your learning style has been identified!"}
            </p>
            <button
              onClick={() => onComplete(result)}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> View Recommendations
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
