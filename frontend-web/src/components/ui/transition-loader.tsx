"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";

const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false }
);

const tips = [
  "Preparing your dashboard",
  "Loading your courses",
  "Setting up your workspace",
  "Almost there",
];

export default function TransitionLoader() {
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isDark, setIsDark] = useState(true);

  // Detect current theme from DOM
  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark") || !root.classList.contains("light"));

    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark") || !root.classList.contains("light"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 2500);
    return () => clearInterval(tipTimer);
  }, []);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev + 0.1;
        if (prev >= 70) return prev + 0.3;
        return prev + 1.2;
      });
    }, 50);
    return () => clearInterval(progressTimer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: isDark ? "#060a16" : "#f0f2f7" }}
    >
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[160px]"
          style={{
            top: "15%",
            left: "10%",
            background: isDark
              ? "radial-gradient(circle, rgba(30,64,175,0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(30,64,175,0.08) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[140px]"
          style={{
            bottom: "5%",
            right: "10%",
            background: isDark
              ? "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
          }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Center piece: Lottie blob + Logo */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex items-center justify-center"
      >
        {/* Lottie blob behind logo */}
        <div
          className="absolute w-[320px] h-[320px] flex items-center justify-center"
          style={{ opacity: isDark ? 0.35 : 0.5 }}
        >
          <DotLottieReact
            src="https://lottie.host/0922eb00-9199-4089-83ab-9b51bf700e35/iW2rp2zx32.lottie"
            loop
            autoplay
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Spinning glow ring */}
        <motion.div
          className="absolute w-[160px] h-[160px] rounded-full"
          style={{
            background: isDark
              ? "conic-gradient(from 0deg, transparent 0%, rgba(99,102,241,0.3) 25%, transparent 50%, rgba(59,130,246,0.3) 75%, transparent 100%)"
              : "conic-gradient(from 0deg, transparent 0%, rgba(99,102,241,0.15) 25%, transparent 50%, rgba(59,130,246,0.15) 75%, transparent 100%)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />

        {/* Solid backing circle behind logo for contrast */}
        <div
          className="absolute w-[120px] h-[120px] rounded-full"
          style={{
            background: isDark ? "#0f172a" : "#ffffff",
            boxShadow: isDark
              ? "0 0 60px rgba(30,64,175,0.25)"
              : "0 0 40px rgba(30,64,175,0.12), 0 2px 16px rgba(0,0,0,0.06)",
          }}
        />

        {/* Logo */}
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <Image
            src="/logo.png"
            alt="IPG"
            width={90}
            height={90}
            priority
            className={
              isDark
                ? "brightness-[1.8] contrast-[0.9] drop-shadow-[0_0_20px_rgba(100,140,255,0.4)]"
                : "drop-shadow-[0_0_12px_rgba(27,42,128,0.2)]"
            }
          />
        </motion.div>
      </motion.div>

      {/* Brand name */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="relative z-10 mt-10 text-center"
      >
        <h1 className="text-[26px] font-bold tracking-tight">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: isDark
                ? "linear-gradient(to right, #60a5fa, #818cf8, #a78bfa)"
                : "linear-gradient(to right, #1e40af, #4338ca, #6d28d9)",
            }}
          >
            MySmartStudy
          </span>
        </h1>
        <p
          className="text-[11px] mt-1.5 tracking-[0.2em] uppercase font-medium"
          style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)" }}
        >
          Institut Pendidikan Guru
        </p>
      </motion.div>

      {/* Progress section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="relative z-10 mt-10 flex flex-col items-center gap-4 w-56"
      >
        {/* Progress bar */}
        <div
          className="w-full h-[3px] rounded-full overflow-hidden"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(progress, 95)}%`,
              background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)",
            }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Cycling tip text */}
        <div className="h-5 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-center"
              style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}
            >
              {tips[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
