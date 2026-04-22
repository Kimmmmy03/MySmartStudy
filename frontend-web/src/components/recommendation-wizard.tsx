"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wand2, ChevronRight, Check,
  CircleDot, Circle, GitBranch, Workflow,
  Network, GitMerge, Layers, Building2,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

const GOALS: { id: string; label: string; template: string; displayName: string; icon: LucideIcon }[] = [
  { id: "compare", label: "Compare two things", template: "vennDiagram", displayName: "Venn Diagram", icon: CircleDot },
  { id: "define", label: "Define a concept", template: "bubble", displayName: "Bubble Map", icon: Circle },
  { id: "classify", label: "Classify or categorize", template: "tree", displayName: "Tree Map", icon: GitBranch },
  { id: "sequence", label: "Show a sequence/process", template: "flowchart", displayName: "Flowchart", icon: Workflow },
  { id: "describe", label: "Describe qualities", template: "spider", displayName: "Spider Map", icon: Network },
  { id: "cause-effect", label: "Cause and effect", template: "causeEffect", displayName: "Cause & Effect", icon: GitMerge },
  { id: "analogy", label: "Show relationships/analogies", template: "hierarchical", displayName: "Hierarchical Map", icon: Layers },
  { id: "part-whole", label: "Part-to-whole analysis", template: "orgChart", displayName: "Org Chart", icon: Building2 },
];

interface RecommendationWizardProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: string) => void;
}

export default function RecommendationWizard({ open, onClose, onSelect }: RecommendationWizardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleCreate = () => {
    if (selected) {
      const goal = GOALS.find((g) => g.id === selected);
      if (goal) onSelect(goal.template);
      onClose();
    }
  };

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
            className="modal-content rounded-2xl p-6 max-w-lg mx-4 w-full relative border"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-dark-400 hover:text-dark-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-dark-100">What are you trying to do?</h2>
                <p className="text-sm text-dark-300">We&apos;ll recommend the best map type</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {GOALS.map((g) => {
                const isSelected = selected === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g.id)}
                    className={clsx(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200",
                      isSelected
                        ? "rec-goal-selected"
                        : "rec-goal-default"
                    )}
                  >
                    <div className={clsx(
                      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      isSelected
                        ? "bg-accent-blue/20 text-accent-blue"
                        : "bg-white/5 text-dark-300"
                    )}>
                      <g.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        "text-sm font-medium",
                        isSelected ? "text-dark-100" : "text-dark-200"
                      )}>{g.label}</p>
                      <p className={clsx(
                        "text-xs",
                        isSelected ? "text-accent-blue" : "text-dark-400"
                      )}>{g.displayName}</p>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleCreate}
              disabled={!selected}
              className={clsx(
                "btn-gradient w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 relative z-10 transition-all",
                selected
                  ? "text-white shadow-lg shadow-accent-blue/25"
                  : "opacity-40 text-white cursor-not-allowed"
              )}
            >
              <span className="relative z-10">Create Map</span>
              <ChevronRight className="w-4 h-4 relative z-10" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
