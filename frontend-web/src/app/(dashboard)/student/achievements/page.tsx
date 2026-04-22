"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { badgesApi, type BadgeDefinition } from "@/lib/api";
import { resolveBadge } from "@/lib/utils";
import { motion } from "framer-motion";
import { Award, Flame, Trophy, Coins, Lock, CheckCircle } from "lucide-react";
import clsx from "clsx";
import BadgeIcon from "@/components/badge-icon";

function BadgeCard({ badge, earned, index }: { badge: BadgeDefinition; earned: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: "spring", damping: 15, stiffness: 200 }}
      whileHover={earned ? {
        scale: 1.06,
        y: -4,
        transition: { type: "spring", damping: 12, stiffness: 300 },
      } : { scale: 1.02 }}
      className={clsx(
        "glass-card p-5 text-center relative overflow-hidden group cursor-default",
        !earned && "opacity-40 grayscale"
      )}
    >
      {/* Hover glow for earned badges */}
      {earned && (
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15), transparent 70%)`,
          }}
        />
      )}

      {/* Badge icon */}
      <motion.div
        className="relative mx-auto mb-3"
        animate={earned ? {
          rotateY: [0, 0, 360, 360],
          scale: [1, 1, 1.1, 1],
        } : {}}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatDelay: 6 + index * 0.5,
          ease: "easeInOut",
        }}
      >
        <div className={clsx(
          "w-30 h-30 rounded-2xl flex items-center justify-center mx-auto",
          earned
            ? `bg-gradient-to-br ${badge.color} shadow-lg`
            : "bg-gray-200 dark:bg-dark-700"
        )}>
          <BadgeIcon icon={badge.icon} size={badge.lottie_size || 70} animated={earned} colored={!earned} className={clsx(earned ? "text-white drop-shadow-lg" : "opacity-60")} lottieUrl={badge.lottie_url} />
        </div>

        {/* Shimmer for earned */}
        {earned && (
          <motion.div
            className="absolute inset-0 rounded-2xl mx-auto w-30"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)",
              backgroundSize: "200% 100%",
            }}
            animate={{ backgroundPosition: ["-100% 0", "200% 0"] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 4 + index * 0.8,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.div>

      <h4 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">{badge.name}</h4>
      <p className="text-[10px] text-gray-500 dark:text-dark-400 mt-1 leading-relaxed">{badge.description}</p>

      <motion.div
        className="mt-2.5"
        animate={earned ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      >
        {earned ? (
          <CheckCircle className="w-4 h-4 text-accent-emerald mx-auto" />
        ) : (
          <Lock className="w-4 h-4 text-gray-400 dark:text-dark-400 mx-auto" />
        )}
      </motion.div>
    </motion.div>
  );
}

export default function AchievementsPage() {
  const { profile, refreshProfile } = useAuth();
  const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const hasRefreshedRef = useRef(false);

  const earnedBadges = profile?.badges || [];
  const points = profile?.points || 0;
  const streak = profile?.streak || 0;
  const level = Math.floor(points / 100) + 1;
  const xpInLevel = points % 100;

  // On mount: trigger server-side badge checks, refresh profile, load definitions
  useEffect(() => {
    const init = async () => {
      try {
        // Trigger server-side badge auto-award check
        if (!hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          await badgesApi.checkMyBadges();
          await refreshProfile();
        }
        const defs = await badgesApi.definitions();
        // Merge any legacy badge IDs the user has that aren't in definitions
        const defIds = new Set(defs.map(d => d.id));
        const earned = profile?.badges || [];
        const merged = [...defs];
        for (const badgeId of earned) {
          if (!defIds.has(badgeId)) {
            const legacy = resolveBadge(badgeId, []);
            merged.push({
              id: badgeId,
              name: legacy.name,
              description: legacy.description,
              icon: legacy.icon,
              color: "from-amber-500 to-yellow-400",
              condition_type: "",
              condition_value: 0,
              points_reward: 0,
              is_default: false,
            });
          }
        }
        setAllBadges(merged);
      } catch {}
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sort: earned first, then unearned
  const sortedBadges = [...allBadges].sort((a, b) => {
    const aEarned = earnedBadges.includes(a.id) ? 0 : 1;
    const bEarned = earnedBadges.includes(b.id) ? 0 : 1;
    return aEarned - bEarned;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <motion.div
          className="glass-card p-5 text-center"
          whileHover={{ scale: 1.03, y: -2 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <motion.div
            className="w-12 h-12 mx-auto mb-2 rounded-xl bg-accent-amber/10 flex items-center justify-center"
            animate={{ rotate: [0, -10, 10, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
          >
            <Coins className="w-6 h-6 text-accent-amber" />
          </motion.div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{points}</p>
          <p className="text-sm text-gray-500 dark:text-dark-300">Total Points</p>
        </motion.div>
        <motion.div
          className="glass-card p-5 text-center"
          whileHover={{ scale: 1.03, y: -2 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <motion.div
            className="w-12 h-12 mx-auto mb-2 rounded-xl bg-accent-pink/10 flex items-center justify-center"
            animate={streak > 0 ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Flame className="w-6 h-6 text-accent-pink" />
          </motion.div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{streak}</p>
          <p className="text-sm text-gray-500 dark:text-dark-300">Day Streak</p>
        </motion.div>
        <motion.div
          className="glass-card p-5 text-center"
          whileHover={{ scale: 1.03, y: -2 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <motion.div
            className="w-12 h-12 mx-auto mb-2 rounded-xl bg-accent-purple/10 flex items-center justify-center"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
          >
            <Trophy className="w-6 h-6 text-accent-purple" />
          </motion.div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">Lvl {level}</p>
          <div className="w-full bg-gray-200 dark:bg-dark-600 rounded-full h-2 mt-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-accent-blue to-accent-purple h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${xpInLevel}%` }}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-dark-400 mt-1">{100 - xpInLevel} XP to Lvl {level + 1}</p>
        </motion.div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-4">
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 5 }}
        >
          <Award className="w-5 h-5 text-accent-amber" />
        </motion.div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Badges</h2>
        <span className="text-xs text-gray-500 dark:text-dark-400 ml-auto">
          {earnedBadges.length}/{allBadges.length} earned
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {sortedBadges.map((badge, i) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              earned={earnedBadges.includes(badge.id)}
              index={i}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
