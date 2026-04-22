"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Send, Sparkles, BookOpen, Brain, Users, Clock, Loader2 } from "lucide-react";
import clsx from "clsx";

const QUICK_WINS = [
  { label: "Completed all assignments", icon: BookOpen },
  { label: "Studied with classmates", icon: Users },
  { label: "Created mind maps", icon: Brain },
  { label: "Managed my time well", icon: Clock },
  { label: "Learned something new", icon: Sparkles },
];

const STRUGGLES = [
  "Felt overwhelmed with workload",
  "Hard to stay focused",
  "Didn't understand some topics",
  "Missed some deadlines",
  "Needed more help from lecturer",
];

interface WeeklyReflectionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (confidence: number, notes: string) => void;
}

export default function WeeklyReflectionModal({ open, onClose, onSubmit }: WeeklyReflectionModalProps) {
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedWins, setSelectedWins] = useState<string[]>([]);
  const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);

  const toggleWin = (label: string) => {
    setSelectedWins((prev) =>
      prev.includes(label) ? prev.filter((w) => w !== label) : [...prev, label]
    );
  };

  const toggleStruggle = (label: string) => {
    setSelectedStruggles((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const parts: string[] = [];
    if (selectedWins.length > 0) parts.push("Wins: " + selectedWins.join(", "));
    if (selectedStruggles.length > 0) parts.push("Challenges: " + selectedStruggles.join(", "));
    if (notes.trim()) parts.push(notes.trim());
    await onSubmit(confidence, parts.join(" | "));
    setSubmitting(false);
    setConfidence(3);
    setNotes("");
    setSelectedWins([]);
    setSelectedStruggles([]);
    onClose();
  };

  const labels = ["Very Low", "Low", "Moderate", "High", "Very High"];
  const labelColors = [
    "text-red-400",
    "text-orange-400",
    "text-accent-amber",
    "text-emerald-400",
    "text-emerald-500",
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="modal-content rounded-2xl p-6 max-w-md mx-4 w-full relative border max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-dark-400 hover:text-dark-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-amber to-orange-500 flex items-center justify-center shadow-lg">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-dark-100">Weekly Reflection</h2>
                <p className="text-sm text-dark-300">How was your learning this week?</p>
              </div>
            </div>

            {/* Confidence Rating */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Confidence Level</p>
              <div className="flex items-center justify-center gap-3 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setConfidence(n)}
                    className="transition-all hover:scale-125 active:scale-95"
                  >
                    <Star
                      className={clsx(
                        "w-9 h-9 transition-colors",
                        n <= confidence
                          ? "text-accent-amber fill-accent-amber drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                          : "text-dark-500"
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className={clsx("text-center text-sm font-medium", labelColors[confidence - 1])}>
                {labels[confidence - 1]}
              </p>
            </div>

            {/* Quick Wins */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">What went well?</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_WINS.map((win) => {
                  const active = selectedWins.includes(win.label);
                  return (
                    <button
                      key={win.label}
                      onClick={() => toggleWin(win.label)}
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                        active
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                          : "reflection-chip-default"
                      )}
                    >
                      <win.icon className="w-3.5 h-3.5" />
                      {win.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Struggles */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Any challenges?</p>
              <div className="flex flex-wrap gap-2">
                {STRUGGLES.map((s) => {
                  const active = selectedStruggles.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStruggle(s)}
                      className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                        active
                          ? "bg-red-500/15 border-red-500/40 text-red-400"
                          : "reflection-chip-default"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Anything else? (optional)</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share your thoughts..."
                className="glass-input w-full h-20 resize-none text-sm p-3"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-gradient w-full py-3 rounded-xl text-sm text-white font-medium inline-flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 shadow-lg shadow-accent-blue/20"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin relative z-10" />
              ) : (
                <Send className="w-4 h-4 relative z-10" />
              )}
              <span className="relative z-10">{submitting ? "Submitting..." : "Submit Reflection"}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
