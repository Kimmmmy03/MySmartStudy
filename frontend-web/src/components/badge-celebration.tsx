"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import BadgeIcon from "@/components/badge-icon";

interface BadgeInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  lottie_url?: string;
  lottie_size?: number;
}

interface BadgeCelebrationProps {
  badges: BadgeInfo[];
  onClose: () => void;
}

export default function BadgeCelebration({ badges, onClose }: BadgeCelebrationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const open = badges.length > 0;
  const badge = badges[currentIndex];

  useEffect(() => {
    if (!open) return;
    // Confetti burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.55 },
      colors: ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ec4899"],
    });
    const t = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 120,
        origin: { y: 0.45, x: 0.3 },
        colors: ["#ec4899", "#f59e0b", "#6366f1"],
      });
    }, 400);
    const t2 = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 120,
        origin: { y: 0.45, x: 0.7 },
        colors: ["#10b981", "#06b6d4", "#8b5cf6"],
      });
    }, 700);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [open, currentIndex]);

  const handleNext = () => {
    if (currentIndex < badges.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
      onClose();
    }
  };

  if (!open || !badge) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="badge-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          key={badge.id}
          initial={{ scale: 0.2, opacity: 0, rotateY: -180 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          exit={{ scale: 0.2, opacity: 0, rotateY: 180 }}
          transition={{ type: "spring", damping: 14, stiffness: 180 }}
          className="relative max-w-sm w-full mx-4 overflow-hidden rounded-3xl"
          onClick={(e) => e.stopPropagation()}
          style={{ perspective: 1000 }}
        >
          {/* Gradient background card */}
          <div className="relative bg-dark-800 border border-white/10 rounded-3xl overflow-hidden">
            {/* Animated gradient header */}
            <div className={`relative h-56 bg-gradient-to-br ${badge.color} overflow-hidden`}>
              {/* Floating particles */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white/20"
                  style={{
                    width: 4 + Math.random() * 8,
                    height: 4 + Math.random() * 8,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -30 - Math.random() * 40],
                    opacity: [0, 0.8, 0],
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.25,
                    ease: "easeOut",
                  }}
                />
              ))}

              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`s${i}`}
                  className="absolute"
                  style={{
                    left: `${15 + Math.random() * 70}%`,
                    top: `${15 + Math.random() * 70}%`,
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                    rotate: [0, 180],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                    repeatDelay: 1,
                  }}
                >
                  <Sparkles className="w-4 h-4 text-white/50" />
                </motion.div>
              ))}

              {/* Badge icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotateY: [0, 0, 360, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                    ease: "easeInOut",
                  }}
                >
                  <div className="w-36 h-36 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl border border-white/30">
                    <BadgeIcon icon={badge.icon} size={badge.lottie_size || 96} animated className="text-white drop-shadow-lg" lottieUrl={badge.lottie_url} lottieDpr={8} />
                  </div>
                </motion.div>
              </div>

              {/* Shimmer */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["-100% 0", "200% 0"] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <motion.p
                className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-amber mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Badge Unlocked!
              </motion.p>

              <motion.h2
                className="text-2xl font-bold text-white mb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {badge.name}
              </motion.h2>

              <motion.p
                className="text-sm text-dark-300 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {badge.description}
              </motion.p>

              {/* Progress indicator for multiple badges */}
              {badges.length > 1 && (
                <motion.div
                  className="flex items-center justify-center gap-1.5 mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  {badges.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentIndex ? "bg-accent-purple w-6" : "bg-white/20"
                      }`}
                    />
                  ))}
                </motion.div>
              )}

              <motion.button
                onClick={handleNext}
                className={`w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${badge.color} shadow-lg hover:shadow-xl transition-shadow`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {currentIndex < badges.length - 1 ? "Next Badge" : "Awesome!"}
              </motion.button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition-all z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
