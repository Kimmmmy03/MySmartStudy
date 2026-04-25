"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  TrendingUp,
  Sparkles,
  Search,
  X,
  Loader2,
  Users,
  Heart,
  MessageCircle,
  Trophy,
  Map as MapIcon,
  ArrowUpRight,
  Flame,
} from "lucide-react";
import { socialApi, type MapOut, type PublicProfileOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { resolveBackendUrl, formatDateTime } from "@/lib/utils";
import clsx from "clsx";
import FollowButton from "@/components/follow-button";
import PublicProfileLink from "@/components/public-profile-link";
import VisibilityBadge from "@/components/visibility-badge";

type Tab = "trending" | "suggested";

/**
 * Explore — discovery surface for the followers feature.
 *
 * Two tabs: Trending public maps (last 30 days, globally by like count) and
 * Suggested students (highest follower counts among students I don't follow).
 * Search box at the top does typeahead on student names + emails.
 */
export default function ExplorePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("trending");

  // Trending
  const [trending, setTrending] = useState<MapOut[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingDays, setTrendingDays] = useState<7 | 30 | 90>(30);

  // Suggested
  const [suggested, setSuggested] = useState<PublicProfileOut[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);

  // Search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfileOut[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTrending = useCallback(async (days: number) => {
    setTrendingLoading(true);
    try {
      const data = await socialApi.trending(days, 24);
      setTrending(data);
    } catch {
      setTrending([]);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  const loadSuggested = useCallback(async () => {
    setSuggestedLoading(true);
    try {
      const data = await socialApi.suggested(12);
      setSuggested(data);
    } catch {
      setSuggested([]);
    } finally {
      setSuggestedLoading(false);
    }
  }, []);

  useEffect(() => { loadTrending(trendingDays); }, [loadTrending, trendingDays]);
  useEffect(() => { loadSuggested(); }, [loadSuggested]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await socialApi.searchUsers(q, 15);
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  // When the viewer follows/unfollows, patch the local lists so UI stays in
  // sync without a re-fetch.
  const patchFollowFlag = (uid: string, followingNow: boolean) => {
    setSuggested(prev => prev.filter(p => p.id !== uid || !followingNow));
    setSearchResults(prev => prev.map(p => p.id === uid ? { ...p, is_followed_by_me: followingNow } : p));
    setTrending(prev => prev.map(m => m.owner_id === uid ? { ...m, owner_is_followed_by_me: followingNow } : m));
  };

  // Top trending map sits in a hero card above the grid; the grid renders
  // the rest. Falls back gracefully when the list is short.
  const featured = trending[0];
  const restTrending = trending.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-5"
    >
      {/* ── Hero header with search ──────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl glass-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full bg-accent-purple/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-accent-blue/20 blur-3xl" />

        <div className="relative flex items-start gap-4">
          <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-pink items-center justify-center shadow-lg shadow-accent-purple/20">
            <Compass className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Explore
            </h1>
            <p className="text-sm text-dark-300 mt-1">
              Discover trending mind maps and rising creators across MySmartStudy
            </p>

            {/* Inline search */}
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search classmates by name or email…"
                className="glass-input w-full pl-11 pr-10 py-3 text-sm rounded-xl"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-white p-1 rounded-md hover:bg-white/5"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search results panel */}
        <AnimatePresence>
          {query.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden relative"
            >
              <div className="mt-4 border-t border-white/5 pt-4">
                <p className="text-[11px] uppercase tracking-wider text-dark-400 font-semibold mb-2">
                  Search results
                </p>
                {searching ? (
                  <div className="flex items-center gap-2 text-xs text-dark-300 py-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-dark-300 py-3">No students match that search.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResults.map(p => (
                      <UserRow
                        key={p.id}
                        user={p}
                        canFollow={p.id !== user?.id}
                        onFollowChange={next => patchFollowFlag(p.id, next)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        <div className="flex items-center gap-1">
          {([
            { key: "trending", label: "Trending", icon: TrendingUp, count: trending.length },
            { key: "suggested", label: "Creators", icon: Sparkles, count: suggested.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.key ? "text-white" : "text-dark-300 hover:text-white"
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              {t.count > 0 && (
                <span className={clsx(
                  "ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                  tab === t.key
                    ? "bg-accent-purple/20 text-accent-purple"
                    : "bg-white/5 text-dark-300"
                )}>
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <motion.div
                  layoutId="explore-tab-underline"
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-gradient-to-r from-accent-blue to-accent-purple rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trending tab ─────────────────────────────────────── */}
      {tab === "trending" && (
        <div className="space-y-5">
          {/* Window selector */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-dark-200">
              <Flame className="w-4 h-4 text-accent-pink" />
              <p className="text-sm font-medium">
                Top maps from the last <span className="text-white">{trendingDays}</span> days
              </p>
            </div>
            <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
              {([7, 30, 90] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setTrendingDays(d)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-w-[58px]",
                    trendingDays === d
                      ? "bg-gradient-to-br from-accent-blue to-accent-purple text-white shadow-md"
                      : "text-dark-200 hover:text-white hover:bg-white/5"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {trendingLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map(i => <TrendingCardSkeleton key={i} />)}
            </div>
          ) : trending.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                <TrendingUp className="w-8 h-8 text-dark-400" />
              </div>
              <p className="text-white font-semibold">No trending maps yet</p>
              <p className="text-xs text-dark-300 mt-1">
                Try a wider window, or post a public map of your own.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Featured top map */}
              {featured && (
                <FeaturedTrendingCard
                  map={featured}
                  currentUserId={user?.id}
                  onFollowChange={patchFollowFlag}
                />
              )}

              {/* Rest in a 3-column grid */}
              {restTrending.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {restTrending.map((m, idx) => (
                    <TrendingMapCard
                      key={m.id}
                      map={m}
                      rank={idx + 2}
                      currentUserId={user?.id}
                      onFollowChange={patchFollowFlag}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Suggested creators tab ───────────────────────────── */}
      {tab === "suggested" && (
        suggestedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => <CreatorCardSkeleton key={i} />)}
          </div>
        ) : suggested.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Users className="w-8 h-8 text-dark-400" />
            </div>
            <p className="text-white font-semibold">You&apos;re following everyone active!</p>
            <p className="text-xs text-dark-300 mt-1">Check back later for new creators.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggested.map(p => (
              <CreatorCard
                key={p.id}
                user={p}
                canFollow={p.id !== user?.id}
                onFollowChange={next => patchFollowFlag(p.id, next)}
              />
            ))}
          </div>
        )
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── *
 * Sub-components
 * ────────────────────────────────────────────────────────────── */

function FeaturedTrendingCard({
  map,
  currentUserId,
  onFollowChange,
}: {
  map: MapOut;
  currentUserId?: string;
  onFollowChange: (uid: string, followingNow: boolean) => void;
}) {
  const ownerId = map.owner_id;
  const isOwnMap = !!currentUserId && currentUserId === ownerId;
  const ownerName = map.owner_name || map.owner_email?.split("@")[0] || "Unknown";
  const teaser = (map.nodes_text || "").replace(/\s+/g, " ").trim();
  const teaserShort = teaser.length > 200 ? teaser.slice(0, 200) + "…" : teaser;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden glass-card group"
    >
      {/* Rank ribbon */}
      <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white text-[11px] font-bold shadow-lg">
        <Trophy className="w-3 h-3" /> #1 Trending
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
        {/* Thumbnail */}
        <Link
          href={`/view-map/${map.id}`}
          className="md:col-span-3 block relative bg-dark-700"
        >
          <div className="h-[220px] md:h-[300px] overflow-hidden">
            {map.thumbnail ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={map.thumbnail}
                alt={map.title}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapIcon className="w-16 h-16 text-dark-400" />
              </div>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <VisibilityBadge visibility={map.visibility} size="sm" />
          </div>
        </Link>

        {/* Body */}
        <div className="md:col-span-2 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <PublicProfileLink uid={ownerId} className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
              {map.owner_photo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={map.owner_photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-xs font-bold">
                  {ownerName[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{ownerName}</p>
                <p className="text-[10.5px] text-dark-400">
                  {map.published_at ? formatDateTime(map.published_at) : formatDateTime(map.last_modified)}
                </p>
              </div>
            </PublicProfileLink>
            {!isOwnMap && ownerId && (
              <FollowButton
                targetUserId={ownerId}
                initialFollowing={!!map.owner_is_followed_by_me}
                size="sm"
                onChange={next => onFollowChange(ownerId, next)}
              />
            )}
          </div>

          <Link href={`/view-map/${map.id}`} className="block">
            <h3 className="text-lg font-bold text-white group-hover:text-accent-blue transition-colors line-clamp-2">
              {map.title}
            </h3>
          </Link>

          {teaserShort && (
            <p className="text-xs text-dark-300 line-clamp-3 leading-relaxed">{teaserShort}</p>
          )}

          <div className="mt-auto flex items-center justify-between pt-2">
            <div className="flex items-center gap-3 text-xs text-dark-300">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent-pink/10 text-accent-pink border border-accent-pink/20 font-semibold">
                <Heart className={`w-3.5 h-3.5 ${map.is_liked_by_me ? "fill-current" : ""}`} />
                {map.like_count ?? 0}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                {map.comment_count ?? 0}
              </span>
            </div>
            <Link
              href={`/view-map/${map.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-blue hover:underline"
            >
              Open <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function TrendingMapCard({
  map,
  rank,
  currentUserId,
  onFollowChange,
}: {
  map: MapOut;
  rank: number;
  currentUserId?: string;
  onFollowChange: (uid: string, followingNow: boolean) => void;
}) {
  const ownerId = map.owner_id;
  const isOwnMap = !!currentUserId && currentUserId === ownerId;
  const ownerName = map.owner_name || map.owner_email?.split("@")[0] || "Unknown";
  const isPodium = rank <= 3;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative glass-card overflow-hidden flex flex-col group"
    >
      {/* Rank badge */}
      <div className={clsx(
        "absolute top-3 left-3 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shadow-md",
        isPodium
          ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
          : "bg-dark-900/80 backdrop-blur-md text-white border border-white/10"
      )}>
        {rank}
      </div>

      <Link href={`/view-map/${map.id}`} className="block relative">
        <div className="h-[160px] bg-dark-700 overflow-hidden">
          {map.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={map.thumbnail}
              alt={map.title}
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapIcon className="w-10 h-10 text-dark-400" />
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3">
          <VisibilityBadge visibility={map.visibility} size="sm" />
        </div>
      </Link>

      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        <Link href={`/view-map/${map.id}`} className="block">
          <h3 className="text-sm font-semibold text-white group-hover:text-accent-blue transition-colors line-clamp-2 leading-snug min-h-[2.5em]">
            {map.title}
          </h3>
        </Link>

        <div className="flex items-center justify-between gap-2 mt-auto">
          <PublicProfileLink uid={ownerId} className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity">
            {map.owner_photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={map.owner_photo_url} alt="" className="w-5 h-5 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-[9px] font-bold">
                {ownerName[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-[11px] text-dark-200 truncate">{ownerName}</p>
          </PublicProfileLink>
          {!isOwnMap && ownerId && (
            <FollowButton
              targetUserId={ownerId}
              initialFollowing={!!map.owner_is_followed_by_me}
              size="sm"
              onChange={next => onFollowChange(ownerId, next)}
            />
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-dark-300 pt-1.5 border-t border-white/5">
          <span className="inline-flex items-center gap-1">
            <Heart className={`w-3 h-3 ${map.is_liked_by_me ? "fill-accent-pink text-accent-pink" : ""}`} />
            {map.like_count ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {map.comment_count ?? 0}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function CreatorCard({
  user,
  canFollow,
  onFollowChange,
}: {
  user: PublicProfileOut;
  canFollow: boolean;
  onFollowChange: (next: boolean) => void;
}) {
  const photo = user.photo_url
    ? (user.photo_url.startsWith("http") ? user.photo_url : resolveBackendUrl(user.photo_url))
    : "";
  const cover = user.cover_photo_url
    ? (user.cover_photo_url.startsWith("http") ? user.cover_photo_url : resolveBackendUrl(user.cover_photo_url))
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden glass-card group"
    >
      {/* Cover photo header */}
      <div className="relative h-24 bg-gradient-to-br from-accent-blue/40 via-accent-purple/40 to-accent-pink/40 overflow-hidden">
        {cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(8,12,26,0.85)]" />
      </div>

      <div className="p-4 -mt-9 relative">
        <PublicProfileLink uid={user.id} className="block group-hover:opacity-95 transition-opacity">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo}
              alt={user.display_name}
              className="w-16 h-16 rounded-full object-cover border-4 border-dark-900 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-blue/60 to-accent-purple/60 border-4 border-dark-900 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {(user.display_name || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div className="mt-2.5">
            <p className="text-sm font-semibold text-white truncate group-hover:text-accent-blue transition-colors">
              {user.display_name || "Unknown"}
            </p>
            <p className="text-[11px] text-dark-300 mt-0.5">
              {user.follower_count} follower{user.follower_count === 1 ? "" : "s"}
              {user.following_count > 0 && (
                <> · {user.following_count} following</>
              )}
            </p>
          </div>
        </PublicProfileLink>

        {user.bio && (
          <p className="text-[11.5px] text-dark-300 mt-2 line-clamp-2 leading-relaxed min-h-[2.4em]">
            {user.bio}
          </p>
        )}

        {canFollow && (
          <div className="mt-3">
            <FollowButton
              targetUserId={user.id}
              initialFollowing={user.is_followed_by_me}
              size="sm"
              onChange={onFollowChange}
              className="w-full justify-center"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function UserRow({
  user,
  canFollow,
  onFollowChange,
}: {
  user: PublicProfileOut;
  canFollow: boolean;
  onFollowChange: (next: boolean) => void;
}) {
  const photo = user.photo_url
    ? (user.photo_url.startsWith("http") ? user.photo_url : resolveBackendUrl(user.photo_url))
    : "";
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors">
      <PublicProfileLink uid={user.id} className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(user.display_name || "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{user.display_name || "Unknown"}</p>
          <p className="text-[11px] text-dark-400 truncate">
            {user.follower_count} follower{user.follower_count === 1 ? "" : "s"}
            {user.bio && <> · <span className="text-dark-300">{user.bio.slice(0, 60)}{user.bio.length > 60 ? "…" : ""}</span></>}
          </p>
        </div>
      </PublicProfileLink>
      {canFollow && (
        <FollowButton
          targetUserId={user.id}
          initialFollowing={user.is_followed_by_me}
          size="sm"
          onChange={onFollowChange}
        />
      )}
    </div>
  );
}

function TrendingCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="h-[160px] bg-white/5" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-3.5 w-4/5 bg-white/10 rounded" />
        <div className="h-3 w-1/3 bg-white/5 rounded" />
        <div className="flex gap-3 pt-2 border-t border-white/5">
          <div className="h-2.5 w-8 bg-white/10 rounded" />
          <div className="h-2.5 w-8 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
}

function CreatorCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="h-24 bg-white/5" />
      <div className="p-4 -mt-9 relative space-y-2.5">
        <div className="w-16 h-16 rounded-full bg-white/10 border-4 border-dark-900" />
        <div className="h-3 w-2/3 bg-white/10 rounded" />
        <div className="h-2.5 w-1/3 bg-white/5 rounded" />
        <div className="h-7 w-full bg-white/5 rounded-lg mt-2" />
      </div>
    </div>
  );
}
