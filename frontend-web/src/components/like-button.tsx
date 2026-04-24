"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import clsx from "clsx";
import { socialApi } from "@/lib/api";

/**
 * Optimistic like/unlike toggle. Flips the heart + count immediately and
 * rolls back on API failure. The backend is idempotent, so a spam-click
 * that lands while another is in flight just returns already_liked and the
 * UI stays consistent.
 */
export default function LikeButton({
  mapId,
  initialLiked,
  initialCount,
  size = "md",
  disabled,
  onChange,
  className,
}: {
  mapId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
  disabled?: boolean;
  onChange?: (likedNow: boolean, count: number) => void;
  className?: string;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (disabled || busy) return;
    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));
    // Optimistic flip
    setLiked(nextLiked);
    setCount(nextCount);
    setBusy(true);
    try {
      if (nextLiked) await socialApi.likeMap(mapId);
      else await socialApi.unlikeMap(mapId);
      onChange?.(nextLiked, nextCount);
    } catch {
      // Rollback
      setLiked(!nextLiked);
      setCount(count);
    } finally {
      setBusy(false);
    }
  };

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      disabled={disabled || busy}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors border",
        pad,
        liked
          ? "bg-accent-pink/15 text-accent-pink border-accent-pink/30 hover:bg-accent-pink/20"
          : "bg-white/5 text-dark-200 border-white/10 hover:bg-white/10 hover:text-white",
        (disabled || busy) && "opacity-70 cursor-not-allowed",
        className
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      {busy ? (
        <Loader2 className={clsx(iconSize, "animate-spin")} />
      ) : (
        <Heart className={clsx(iconSize, liked && "fill-accent-pink")} />
      )}
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}
