"use client";

import { useState, useEffect } from "react";
import { mapsApi } from "@/lib/api";
import { Eye, Clock, Circle, ChevronDown, ChevronUp, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

interface PresenceUser {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  lockedNodeId: string | null;
  lastSeen: string;
}

interface Visitor {
  user_id: string;
  user_email: string;
  user_name: string;
  last_visited: string;
  visit_count: number;
}

interface LecturerViewersProps {
  mapId: string | null;
  currentUserId: string;
}

/** Format a date as relative time ("just now", "5m ago", "2h ago", "yesterday", "Mar 12") */
function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function LecturerViewers({ mapId, currentUserId }: LecturerViewersProps) {
  const [liveViewers, setLiveViewers] = useState<PresenceUser[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Poll for live presence (lecturers watching)
  useEffect(() => {
    if (!mapId) return;
    const poll = async () => {
      try {
        const presence = await mapsApi.getPresence(mapId);
        // Filter out current user — only show others (lecturers)
        setLiveViewers(presence.filter(p => p.userId !== currentUserId));
      } catch { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [mapId, currentUserId]);

  // Fetch visitor history (poll every 30s to pick up new visits)
  useEffect(() => {
    if (!mapId) return;
    const fetchVisitors = () => mapsApi.getVisitors(mapId).then(setVisitors).catch(() => {});
    fetchVisitors();
    const interval = setInterval(fetchVisitors, 30000);
    return () => clearInterval(interval);
  }, [mapId]);

  const liveCount = liveViewers.length;
  const totalCount = liveCount + visitors.length;

  if (!mapId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
          liveCount > 0
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 animate-pulse"
            : visitors.length > 0
              ? "bg-accent-purple/10 text-accent-purple border border-accent-purple/20"
              : "text-dark-400 hover:bg-white/5"
        )}
      >
        <Eye className="w-3.5 h-3.5" />
        {liveCount > 0 ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            {liveCount} live
            {visitors.length > 0 && (
              <span className="text-dark-400 font-normal ml-0.5">+ {visitors.length} past</span>
            )}
          </>
        ) : visitors.length > 0 ? (
          <>
            <Users className="w-3 h-3" />
            {visitors.length} visitor{visitors.length !== 1 ? "s" : ""}
            <span className="text-dark-400 font-normal ml-0.5">
              &middot; {timeAgo(visitors[0]?.last_visited)}
            </span>
          </>
        ) : (
          "No visitors"
        )}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="absolute top-full left-0 mt-1 glass-card border border-white/10 rounded-xl overflow-hidden z-50 w-80"
          >
            <div className="p-3 max-h-80 overflow-y-auto">
              {/* Live viewers */}
              {liveCount > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Circle className="w-2 h-2 fill-emerald-400" /> Currently Watching
                  </p>
                  {liveViewers.map(v => (
                    <div key={v.id} className="flex items-center gap-2 py-1.5">
                      <div className="relative">
                        {v.photoURL ? (
                          <img src={v.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                            {v.displayName?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border-2 border-dark-800" />
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">{v.displayName || "Lecturer"}</p>
                        <p className="text-[10px] text-emerald-400">Viewing live</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent / past visitors */}
              {visitors.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-accent-purple uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Recent Visitors ({visitors.length})
                  </p>
                  <div className="space-y-1">
                    {visitors.map(v => (
                      <div key={v.user_id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-accent-purple/20 flex items-center justify-center text-[10px] font-bold text-accent-purple">
                            {(v.user_name || v.user_email)?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">{v.user_name || v.user_email}</p>
                            <p className="text-[10px] text-dark-400">
                              {v.visit_count} visit{v.visit_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-dark-500 whitespace-nowrap">
                          {timeAgo(v.last_visited)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {liveCount === 0 && visitors.length === 0 && (
                <p className="text-xs text-dark-500 text-center py-2">No lecturers have visited this map yet</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
