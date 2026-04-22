"use client";

import { ReactNode, useState, useCallback, useEffect, useRef } from "react";
import { motion, useMotionValue, useAnimationFrame, useTransform } from "framer-motion";

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#3B82F6", "#8B5CF6", "#06B6D4"],
  animationSpeed = 8,
  showBorder = false,
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const duration = animationSpeed * 1000;

  useAnimationFrame((time) => {
    if (isPaused) { lastTimeRef.current = null; return; }
    if (lastTimeRef.current === null) { lastTimeRef.current = time; return; }
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += dt;
    const full = duration * 2;
    const ct = elapsedRef.current % full;
    progress.set(ct < duration ? (ct / duration) * 100 : 100 - ((ct - duration) / duration) * 100);
  });

  useEffect(() => { elapsedRef.current = 0; progress.set(0); }, [animationSpeed]);

  const bgPos = useTransform(progress, (p) => `${p}% 50%`);
  const gradientColors = [...colors, colors[0]].join(", ");
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${gradientColors})`,
    backgroundSize: "300% 100%",
    backgroundRepeat: "repeat" as const,
  };

  return (
    <motion.span
      className={`inline-block text-transparent bg-clip-text ${className}`}
      style={{ ...gradientStyle, backgroundPosition: bgPos, WebkitBackgroundClip: "text" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {children}
    </motion.span>
  );
}
