"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Compass,
  RefreshCw,
  Sparkles,
  Heart,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { socialApi, type MapOut, type PublicProfileOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import MapFeedCard from "@/components/map-feed-card";
import FollowButton from "@/components/follow-button";
import PublicProfileLink from "@/components/public-profile-link";
import { resolveBackendUrl } from "@/lib/utils";

/**
 * Feed — public maps from students the viewer follows, newest-first.
 *
 * Phase 2 keeps this simple: single fetch, optional manual refresh. No
 * infinite scroll yet (backend caps limit at 50, which is plenty for a
 * classroom-scale population). The empty state nudges users to /explore
 * so the feed isn't a dead-end for brand-new accounts.
 */
export default function FeedPage() {
  const { user } = useAuth();
  const [maps, setMaps] = useState<MapOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // Suggested users shown inline when the feed is empty — saves the user a
  // click to /explore for brand-new accounts.
  const [suggested, setSuggested] = useState<PublicProfileOut[]>([]);
  // Avatars of people the viewer follows — rendered as a story-style rail at
  // the top of the feed so the page has a recognisable identity even when
  // scrolling between fetches.
  const [followingRail, setFollowingRail] = useState<PublicProfileOut[]>([]);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await socialApi.feed(30);
      setMaps(data);
      if (data.length === 0) {
        // Cheap follow-up; only fires when the feed is actually empty.
        socialApi.suggested(6).then(setSuggested).catch(() => {});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load the rail of people the viewer follows once we know the user id.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    socialApi
      .following(user.id, 24)
      .then((rows) => { if (!cancelled) setFollowingRail(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleFollowChange = (uid: string, followingNow: boolean) => {
    // If the viewer unfollowed someone mid-scroll, drop their maps from the
    // current feed — they shouldn't linger until the next refresh.
    if (!followingNow) {
      setMaps(prev => prev.filter(m => m.owner_id !== uid));
      setFollowingRail(prev => prev.filter(p => p.id !== uid));
    }
  };

  // Aggregate counters that make the header feel alive.
  const stats = useMemo(() => {
    const authors = new Set(maps.map(m => m.owner_id));
    const totalLikes = maps.reduce((sum, m) => sum + (m.like_count ?? 0), 0);
    const totalComments = maps.reduce((sum, m) => sum + (m.comment_count ?? 0), 0);
    return { authors: authors.size, likes: totalLikes, comments: totalComments };
  }, [maps]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-5"
    >
      {/* ── Hero header ───────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl glass-card p-5 sm:p-6">
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-accent-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-8 w-56 h-56 rounded-full bg-accent-purple/15 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Your Feed</h1>
              <p className="text-sm text-dark-300 mt-0.5">
                Public mind maps from classmates you follow
              </p>
            </div>
          </div>

          <button
            onClick={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-dark-100 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Inline stat chips — only when feed has data */}
        {!loading && !error && maps.length > 0 && (
          <div className="relative mt-4 flex items-center gap-2 flex-wrap">
            <StatChip
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label={`${maps.length} map${maps.length === 1 ? "" : "s"}`}
              tint="blue"
            />
            <StatChip
              icon={<Users className="w-3.5 h-3.5" />}
              label={`${stats.authors} creator${stats.authors === 1 ? "" : "s"}`}
              tint="purple"
            />
            <StatChip
              icon={<Heart className="w-3.5 h-3.5" />}
              label={`${stats.likes} like${stats.likes === 1 ? "" : "s"}`}
              tint="pink"
            />
            <StatChip
              icon={<MessageCircle className="w-3.5 h-3.5" />}
              label={`${stats.comments} comment${stats.comments === 1 ? "" : "s"}`}
              tint="cyan"
            />
          </div>
        )}
      </div>

      {/* ── Following rail ────────────────────────────────────── */}
      {followingRail.length > 0 && !loading && (
        <div className="relative">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] uppercase tracking-wider text-dark-400 font-semibold">
              People you follow
            </p>
            <Link
              href="/student/explore"
              className="text-[11px] text-accent-blue hover:underline inline-flex items-center gap-1"
            >
              Discover more <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
            <div className="flex items-start gap-3 min-w-max">
              {followingRail.map(p => (
                <FollowingAvatar key={p.id} user={p} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center">
          <p className="text-dark-200 text-sm">Couldn&apos;t load your feed.</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="mt-3 text-xs text-accent-blue hover:underline"
          >
            Try again
          </button>
        </div>
      ) : maps.length === 0 ? (
        <EmptyFeedState
          suggested={suggested}
          onFollowed={(uid) => setSuggested(prev => prev.filter(p => p.id !== uid))}
        />
      ) : (
        <div className="space-y-5">
          {maps.map(m => (
            <MapFeedCard
              key={m.id}
              map={m}
              currentUserId={user?.id}
              onFollowChange={handleFollowChange}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── *
 * Sub-components
 * ────────────────────────────────────────────────────────────── */

function StatChip({
  icon,
  label,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  tint: "blue" | "purple" | "pink" | "cyan";
}) {
  const tones: Record<typeof tint, string> = {
    blue: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
    purple: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
    pink: "bg-accent-pink/10 text-accent-pink border-accent-pink/20",
    cyan: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${tones[tint]}`}
    >
      {icon}
      {label}
    </span>
  );
}

function FollowingAvatar({ user }: { user: PublicProfileOut }) {
  const photo = user.photo_url
    ? (user.photo_url.startsWith("http") ? user.photo_url : resolveBackendUrl(user.photo_url))
    : "";
  const initial = (user.display_name || "?")[0]?.toUpperCase() ?? "?";
  return (
    <PublicProfileLink
      uid={user.id}
      className="flex flex-col items-center gap-1.5 w-16 group"
    >
      <span className="relative inline-flex items-center justify-center w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-accent-blue via-accent-purple to-accent-pink transition-transform group-hover:scale-105">
        <span className="block w-full h-full rounded-full bg-dark-900 p-[2px]">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo}
              alt={user.display_name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="w-full h-full rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </span>
          )}
        </span>
      </span>
      <span className="text-[10.5px] text-dark-200 group-hover:text-white truncate w-full text-center transition-colors">
        {user.display_name || "Unknown"}
      </span>
    </PublicProfileLink>
  );
}

function FeedCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 bg-white/10 rounded" />
          <div className="h-2.5 w-1/4 bg-white/10 rounded" />
        </div>
      </div>
      <div className="h-[240px] bg-white/5" />
      <div className="p-4 space-y-2">
        <div className="h-3.5 w-3/4 bg-white/10 rounded" />
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-3 w-2/3 bg-white/5 rounded" />
      </div>
    </div>
  );
}

function EmptyFeedState({
  suggested,
  onFollowed,
}: {
  suggested: PublicProfileOut[];
  onFollowed: (uid: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden glass-card p-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
        <div className="relative space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-white/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-accent-blue" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Your feed is quiet — for now</p>
            <p className="text-sm text-dark-300 mt-1 max-w-md mx-auto">
              Follow classmates to see their public mind maps appear here as soon as they share them.
            </p>
          </div>
          <Link
            href="/student/explore"
            className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium mt-2"
          >
            <Compass className="w-4 h-4" /> Explore creators
          </Link>
        </div>
      </div>

      {suggested.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-dark-400 font-semibold flex items-center gap-1.5 px-1">
            <Sparkles className="w-3 h-3 text-accent-purple" /> Suggested for you
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggested.map(p => (
              <SuggestedCard key={p.id} user={p} onFollowed={() => onFollowed(p.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestedCard({
  user,
  onFollowed,
}: {
  user: PublicProfileOut;
  onFollowed: () => void;
}) {
  const photo = user.photo_url
    ? (user.photo_url.startsWith("http") ? user.photo_url : resolveBackendUrl(user.photo_url))
    : "";
  const cover = user.cover_photo_url
    ? (user.cover_photo_url.startsWith("http") ? user.cover_photo_url : resolveBackendUrl(user.cover_photo_url))
    : "";
  return (
    <div className="relative overflow-hidden glass-card p-4">
      {/* Cover photo or gradient as background */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-br from-accent-blue/30 via-accent-purple/30 to-accent-pink/30 overflow-hidden">
        {cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={cover} alt="" className="w-full h-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(8,12,26,0.85)]" />
      </div>

      <div className="relative pt-8 flex items-end justify-between gap-3">
        <PublicProfileLink uid={user.id} className="flex items-end gap-3 min-w-0 flex-1 hover:opacity-90 transition-opacity">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo}
              alt=""
              className="w-12 h-12 rounded-full object-cover border-2 border-dark-900 shrink-0 shadow-md"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-blue/60 to-accent-purple/60 border-2 border-dark-900 flex items-center justify-center text-white text-base font-bold shrink-0 shadow-md">
              {(user.display_name || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 pb-0.5">
            <p className="text-sm font-semibold text-white truncate">{user.display_name || "Unknown"}</p>
            <p className="text-[11px] text-dark-300 truncate">
              {user.follower_count} follower{user.follower_count === 1 ? "" : "s"}
            </p>
          </div>
        </PublicProfileLink>
        <FollowButton
          targetUserId={user.id}
          initialFollowing={user.is_followed_by_me}
          size="sm"
          onChange={next => { if (next) onFollowed(); }}
        />
      </div>
      {user.bio && (
        <p className="text-[11.5px] text-dark-300 mt-2.5 line-clamp-2 leading-relaxed">
          {user.bio}
        </p>
      )}
    </div>
  );
}
