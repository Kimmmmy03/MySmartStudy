"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { PREVIEWS, SHAPE_LABELS } from "./shape-meta";

interface SwapShapePromptProps {
  /** Screen-space anchor (cursor position from the drop event). */
  x: number;
  y: number;
  currentShape: string;
  newShape: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ShapeThumb({ shape }: { shape: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-dark-100">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {PREVIEWS[shape]}
        </svg>
      </div>
      <span className="text-[10px] text-dark-300 leading-none">
        {SHAPE_LABELS[shape] || shape}
      </span>
    </div>
  );
}

/**
 * Floating confirmation shown when a shape is dropped from the palette onto
 * an existing node. Anchored to the cursor; dismisses on Esc / click-outside.
 */
export default function SwapShapePrompt({
  x,
  y,
  currentShape,
  newShape,
  onConfirm,
  onCancel,
}: SwapShapePromptProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Esc closes; Enter confirms.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  // Click outside closes.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    // Defer so the drop event that just fired doesn't immediately close us.
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onCancel]);

  // Keep the popup on-screen — clamp to the viewport with a small margin.
  const W = 260;
  const H = 160;
  const margin = 8;
  const left = Math.min(Math.max(x + 12, margin), window.innerWidth - W - margin);
  const top = Math.min(Math.max(y + 12, margin), window.innerHeight - H - margin);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ duration: 0.12 }}
      style={{ position: "fixed", left, top, width: W, zIndex: 1000 }}
      className="glass-card rounded-xl border border-white/10 shadow-2xl p-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-dark-100">Swap shape?</h3>
        <button
          onClick={onCancel}
          className="p-0.5 rounded hover:bg-white/5 text-dark-400 hover:text-dark-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-3 py-2">
        <ShapeThumb shape={currentShape} />
        <ArrowRight className="w-4 h-4 text-dark-400" />
        <ShapeThumb shape={newShape} />
      </div>
      <p className="text-[10.5px] text-dark-300 leading-snug mt-1 mb-3">
        Label, position, colour and connections stay the same.
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 rounded-md text-[11px] text-dark-200 hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          autoFocus
          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-accent-blue/90 hover:bg-accent-blue transition-colors"
        >
          Swap
        </button>
      </div>
    </motion.div>
  );
}
