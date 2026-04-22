"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, ChevronRight, X } from "lucide-react";
import type { Node } from "@xyflow/react";

const KEYWORD_MAP: Record<string, { template: string; description: string }> = {
  compare: { template: "Double Bubble Map", description: "Compare and contrast two concepts" },
  contrast: { template: "Double Bubble Map", description: "Compare and contrast two concepts" },
  difference: { template: "Double Bubble Map", description: "Compare and contrast two concepts" },
  similar: { template: "Double Bubble Map", description: "Compare and contrast two concepts" },
  define: { template: "Circle Map", description: "Define a concept in context" },
  meaning: { template: "Circle Map", description: "Define a concept in context" },
  context: { template: "Circle Map", description: "Define a concept in context" },
  classify: { template: "Tree Map", description: "Classify items into groups" },
  categorize: { template: "Tree Map", description: "Classify items into groups" },
  group: { template: "Tree Map", description: "Classify items into groups" },
  types: { template: "Tree Map", description: "Classify items into groups" },
  sequence: { template: "Flow Map", description: "Show steps in a process" },
  process: { template: "Flow Map", description: "Show steps in a process" },
  steps: { template: "Flow Map", description: "Show steps in a process" },
  order: { template: "Flow Map", description: "Show steps in a process" },
  describe: { template: "Bubble Map", description: "Describe qualities or attributes" },
  qualities: { template: "Bubble Map", description: "Describe qualities or attributes" },
  adjective: { template: "Bubble Map", description: "Describe qualities or attributes" },
  cause: { template: "Multi-Flow Map", description: "Analyze causes and effects" },
  effect: { template: "Multi-Flow Map", description: "Analyze causes and effects" },
  result: { template: "Multi-Flow Map", description: "Analyze causes and effects" },
  analogy: { template: "Bridge Map", description: "Show relationships and analogies" },
  relationship: { template: "Bridge Map", description: "Show relationships and analogies" },
  part: { template: "Brace Map", description: "Break down parts of a whole" },
  whole: { template: "Brace Map", description: "Break down parts of a whole" },
  component: { template: "Brace Map", description: "Break down parts of a whole" },
};

interface RecommendationSidebarProps {
  nodes: Node[];
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (templateName: string) => void;
}

export default function RecommendationSidebar({ nodes, open, onClose, onApplyTemplate }: RecommendationSidebarProps) {
  const [recommendations, setRecommendations] = useState<{ template: string; description: string; score: number }[]>([]);

  useEffect(() => {
    // Extract all text from nodes
    const allText = nodes
      .map((n) => String((n.data as Record<string, unknown>).label || ""))
      .join(" ")
      .toLowerCase();

    // Score templates by keyword matches
    const scores = new Map<string, { description: string; score: number }>();
    for (const [keyword, { template, description }] of Object.entries(KEYWORD_MAP)) {
      if (allText.includes(keyword)) {
        const existing = scores.get(template);
        if (existing) {
          existing.score += 1;
        } else {
          scores.set(template, { description, score: 1 });
        }
      }
    }

    const sorted = Array.from(scores.entries())
      .map(([template, { description, score }]) => ({ template, description, score }))
      .sort((a, b) => b.score - a.score);

    setRecommendations(sorted);
  }, [nodes]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full border-l border-white/5 bg-dark-800/90 overflow-hidden flex-shrink-0"
        >
          <div className="p-4 w-[280px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-accent-purple" />
                <h3 className="text-sm font-semibold text-white">Recommendations</h3>
              </div>
              <button onClick={onClose} className="text-dark-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {recommendations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-dark-400">Add nodes with keywords like &quot;compare&quot;, &quot;define&quot;, &quot;classify&quot; to get template suggestions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((r) => (
                  <div
                    key={r.template}
                    className="glass-card p-3 cursor-pointer hover:border-accent-purple/30 transition-colors"
                    onClick={() => onApplyTemplate(r.template)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{r.template}</span>
                      <ChevronRight className="w-4 h-4 text-dark-400" />
                    </div>
                    <p className="text-xs text-dark-400 mt-1">{r.description}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-purple rounded-full"
                          style={{ width: `${Math.min(r.score * 25, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-dark-400">{r.score} match{r.score !== 1 ? "es" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
