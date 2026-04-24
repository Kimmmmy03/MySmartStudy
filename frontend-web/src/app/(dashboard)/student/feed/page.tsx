"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Compass, RefreshCw, Loader2 } from "lucide-react";
import { socialApi, type MapOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import MapFeedCard from "@/components/map-feed-card";

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

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await socialApi.feed(30);
      setMaps(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFollowChange = (uid: string, followingNow: boolean) => {
    // If the viewer unfollowed someone mid-scroll, drop their maps from the
    // current feed — they shouldn't linger until the next refresh.
    if (!followingNow) {
      setMaps(prev => prev.filter(m => m.owner_id !== uid));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-accent-blue/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Feed</h1>
            <p className="text-xs text-dark-300">Public mind maps from classmates you follow</p>
          </div>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-dark-200 hover:bg-white/5 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-accent-purple animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center">
          <p className="text-dark-200 text-sm">Couldn&apos;t load your feed.</p>
          <button onClick={() => { setLoading(true); load(); }} className="mt-3 text-xs text-accent-blue hover:underline">
            Try again
          </button>
        </div>
      ) : maps.length === 0 ? (
        <div className="glass-card p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-accent-blue/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-accent-blue" />
          </div>
          <div>
            <p className="text-white font-semibold">Your feed is empty</p>
            <p className="text-xs text-dark-300 mt-1">
              Follow classmates to see their public mind maps here.
            </p>
          </div>
          <Link
            href="/student/explore"
            className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium"
          >
            <Compass className="w-4 h-4" /> Explore students to follow
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
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
