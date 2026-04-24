"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import clsx from "clsx";
import { socialApi } from "@/lib/api";

interface FollowButtonProps {
  targetUserId: string;
  initialFollowing: boolean;
  /** Disable the button when the target user is the current viewer. */
  disabled?: boolean;
  /** Visual size: "sm" for inline cards, "md" for profile header. */
  size?: "sm" | "md";
  /** Fires once the backend confirms (useful for parent follower-count counters). */
  onChange?: (followingNow: boolean) => void;
  className?: string;
}

/**
 * One-way follow/unfollow button with optimistic toggle and error rollback.
 *
 * Reused across the map viewer, public profile header, feed cards, explore
 * cards, and any comment author row. Keeps its own loading state; the parent
 * only needs to react to the `onChange` callback if it caches follower counts.
 */
export default function FollowButton({
  targetUserId,
  initialFollowing,
  disabled,
  size = "md",
  onChange,
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (disabled || loading) return;
    const prev = following;
    const next = !prev;
    // Optimistic flip.
    setFollowing(next);
    setLoading(true);
    try {
      if (next) {
        await socialApi.follow(targetUserId);
      } else {
        await socialApi.unfollow(targetUserId);
      }
      onChange?.(next);
    } catch {
      // Rollback on failure.
      setFollowing(prev);
    } finally {
      setLoading(false);
    }
  };

  const isFollowing = following;
  const paddingY = size === "sm" ? "py-1" : "py-2";
  const paddingX = size === "sm" ? "px-2.5" : "px-4";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={toggle}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
        paddingX,
        paddingY,
        fontSize,
        isFollowing
          ? "bg-white/5 text-dark-200 hover:bg-red-500/10 hover:text-red-400 border border-white/10"
          : "btn-gradient text-white shadow-md",
        (disabled || loading) && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <Loader2 className={clsx(iconSize, "animate-spin")} />
      ) : isFollowing ? (
        <UserCheck className={iconSize} />
      ) : (
        <UserPlus className={iconSize} />
      )}
      <span>{isFollowing ? "Following" : "Follow"}</span>
    </motion.button>
  );
}
