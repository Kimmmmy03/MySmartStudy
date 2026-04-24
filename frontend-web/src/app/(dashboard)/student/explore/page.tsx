"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, TrendingUp, Sparkles, Search, X, Loader2, Users } from "lucide-react";
import { socialApi, type MapOut, type PublicProfileOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { resolveBackendUrl } from "@/lib/utils";
import clsx from "clsx";
import MapFeedCard from "@/components/map-feed-card";
import FollowButton from "@/components/follow-button";
import PublicProfileLink from "@/components/public-profile-link";

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
      const data = await socialApi.trending(days, 20);
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

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple/20 to-accent-pink/20 border border-accent-purple/20 flex items-center justify-center">
          <Compass className="w-5 h-5 text-accent-purple" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Explore</h1>
          <p className="text-xs text-dark-300">Discover mind maps and classmates across MySmartStudy</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find classmates by name or email..."
            className="glass-input w-full pl-10 pr-9 py-2.5 text-sm rounded-xl"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {query.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-t border-white/5 pt-3">
                {searching ? (
                  <div className="flex items-center gap-2 text-xs text-dark-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-dark-400 py-2">No students match that search.</p>
                ) : (
                  <div className="space-y-1">
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

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
        {([
          { key: "trending", label: "Trending", icon: TrendingUp },
          { key: "suggested", label: "Suggested", icon: Sparkles },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.key ? "bg-accent-purple/20 text-accent-purple" : "text-dark-300 hover:text-white hover:bg-white/5"
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "trending" ? (
        <div className="space-y-3">
          {/* Window selector — scope the top-liked query to a recency window */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] uppercase tracking-wider text-dark-400 font-semibold">Trending window</p>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              {([7, 30, 90] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setTrendingDays(d)}
                  className={clsx(
                    "px-3 py-1 rounded-md text-[11px] font-medium transition-colors",
                    trendingDays === d
                      ? "bg-accent-purple/20 text-accent-purple"
                      : "text-dark-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  Last {d}d
                </button>
              ))}
            </div>
          </div>
          {trendingLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-accent-purple animate-spin" />
            </div>
          ) : trending.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <TrendingUp className="w-10 h-10 text-dark-500 mx-auto mb-2" />
              <p className="text-dark-200 text-sm">No trending maps in the last {trendingDays} days.</p>
              <p className="text-xs text-dark-400 mt-1">Try a wider window, or post a public map.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trending.map(m => (
                <MapFeedCard
                  key={m.id}
                  map={m}
                  currentUserId={user?.id}
                  onFollowChange={patchFollowFlag}
                />
              ))}
            </div>
          )}
        </div>
      ) : suggestedLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-accent-purple animate-spin" />
        </div>
      ) : suggested.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Users className="w-10 h-10 text-dark-500 mx-auto mb-2" />
          <p className="text-dark-200 text-sm">You&apos;re following everyone active!</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-white/5">
          {suggested.map(p => (
            <UserRow
              key={p.id}
              user={p}
              canFollow={p.id !== user?.id}
              onFollowChange={next => patchFollowFlag(p.id, next)}
            />
          ))}
        </div>
      )}
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
    <div className="flex items-center justify-between gap-3 p-3">
      <PublicProfileLink uid={user.id} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photo} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-sm font-bold shrink-0">
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
