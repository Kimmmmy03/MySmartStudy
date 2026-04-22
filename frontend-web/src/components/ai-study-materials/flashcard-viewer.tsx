"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Shuffle, RotateCcw } from "lucide-react";

const PASTEL_COLORS = [
  { front: "from-rose-200/20 to-rose-300/10 border-rose-300/30", back: "from-rose-300/20 to-rose-200/10 border-rose-400/30", accent: "text-rose-400" },
  { front: "from-sky-200/20 to-sky-300/10 border-sky-300/30", back: "from-sky-300/20 to-sky-200/10 border-sky-400/30", accent: "text-sky-400" },
  { front: "from-amber-200/20 to-amber-300/10 border-amber-300/30", back: "from-amber-300/20 to-amber-200/10 border-amber-400/30", accent: "text-amber-400" },
  { front: "from-emerald-200/20 to-emerald-300/10 border-emerald-300/30", back: "from-emerald-300/20 to-emerald-200/10 border-emerald-400/30", accent: "text-emerald-400" },
  { front: "from-violet-200/20 to-violet-300/10 border-violet-300/30", back: "from-violet-300/20 to-violet-200/10 border-violet-400/30", accent: "text-violet-400" },
  { front: "from-cyan-200/20 to-cyan-300/10 border-cyan-300/30", back: "from-cyan-300/20 to-cyan-200/10 border-cyan-400/30", accent: "text-cyan-400" },
  { front: "from-pink-200/20 to-pink-300/10 border-pink-300/30", back: "from-pink-300/20 to-pink-200/10 border-pink-400/30", accent: "text-pink-400" },
  { front: "from-lime-200/20 to-lime-300/10 border-lime-300/30", back: "from-lime-300/20 to-lime-200/10 border-lime-400/30", accent: "text-lime-400" },
];

interface Flashcard {
  front: string;
  back: string;
}

interface FlashcardViewerProps {
  content: string;
}

export default function FlashcardViewer({ content }: FlashcardViewerProps) {
  const cards: Flashcard[] = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return [];
    }
  }, [content]);

  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState(0);

  const currentCard = cards[order[currentIdx]];
  const pastel = PASTEL_COLORS[order[currentIdx] % PASTEL_COLORS.length];

  const goNext = useCallback(() => {
    if (currentIdx < order.length - 1) {
      setDirection(1);
      setFlipped(false);
      setCurrentIdx(prev => prev + 1);
    }
  }, [currentIdx, order.length]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setDirection(-1);
      setFlipped(false);
      setCurrentIdx(prev => prev - 1);
    }
  }, [currentIdx]);

  const handleShuffle = useCallback(() => {
    const newOrder = [...order];
    for (let i = newOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
    }
    setOrder(newOrder);
    setCurrentIdx(0);
    setFlipped(false);
  }, [order]);

  const handleReset = useCallback(() => {
    setOrder(cards.map((_, i) => i));
    setCurrentIdx(0);
    setFlipped(false);
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-dark-400">
        <p>No flashcards to display.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card counter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-dark-300">
          {currentIdx + 1} / {order.length}
        </span>
        <div className="flex gap-1">
          {order.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIdx ? `bg-gradient-to-r ${PASTEL_COLORS[order[i] % PASTEL_COLORS.length].accent.replace("text-", "bg-")}` : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Flashcard */}
      <div className="w-full max-w-lg" style={{ perspective: "1000px" }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${order[currentIdx]}-${currentIdx}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -100 }}
            transition={{ duration: 0.25 }}
          >
            <div
              onClick={() => setFlipped(!flipped)}
              className="relative w-full cursor-pointer"
              style={{ minHeight: "280px" }}
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, type: "spring", damping: 20 }}
                style={{ transformStyle: "preserve-3d" }}
                className="w-full"
              >
                {/* Front */}
                <div
                  className={`p-8 flex flex-col items-center justify-center text-center rounded-2xl border bg-gradient-to-br ${pastel.front} backdrop-blur-sm hover:scale-[1.01] transition-transform`}
                  style={{
                    minHeight: "280px",
                    backfaceVisibility: "hidden",
                  }}
                >
                  <span className={`text-[10px] uppercase tracking-widest ${pastel.accent} mb-4`}>Question</span>
                  <p className="text-lg text-gray-900 dark:text-white font-medium leading-relaxed">{currentCard?.front}</p>
                  <span className="text-xs text-dark-500 mt-6">Click to flip</span>
                </div>

                {/* Back */}
                <div
                  className={`p-8 flex flex-col items-center justify-center text-center rounded-2xl border bg-gradient-to-br ${pastel.back} backdrop-blur-sm absolute inset-0`}
                  style={{
                    minHeight: "280px",
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <span className={`text-[10px] uppercase tracking-widest ${pastel.accent} mb-4`}>Answer</span>
                  <p className="text-lg text-gray-800 dark:text-dark-100 leading-relaxed">{currentCard?.back}</p>
                  <span className="text-xs text-dark-500 mt-6">Click to flip back</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="p-2.5 rounded-xl glass border border-white/5 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5 text-dark-200" />
        </button>

        <button
          onClick={handleShuffle}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/5 hover:bg-white/5 transition-colors text-sm text-dark-200"
        >
          <Shuffle className="w-4 h-4" />
          Shuffle
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/5 hover:bg-white/5 transition-colors text-sm text-dark-200"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>

        <button
          onClick={goNext}
          disabled={currentIdx === order.length - 1}
          className="p-2.5 rounded-xl glass border border-white/5 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5 text-dark-200" />
        </button>
      </div>
    </div>
  );
}
