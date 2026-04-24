"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notificationsApi, type NotificationDigestItem } from "@/lib/api";
import { motion } from "framer-motion";
import { Bell, CheckCheck, AlertTriangle, Info, Award, MessageCircle, BookOpen, Trash2, X, Heart, UserPlus, Users } from "lucide-react";
import clsx from "clsx";

// Icon + tint per notification type. The social-graph types (map_like,
// map_comment, new_follower, map_posted) get their own visuals so the bell
// doesn't look like a wall of identical blue Info dots once Phase 3 is live.
const typeConfig: Record<string, { icon: typeof Bell; bg: string; text: string }> = {
  urgent:       { icon: AlertTriangle, bg: "bg-red-500/10",          text: "text-red-400" },
  badge:        { icon: Award,          bg: "bg-accent-amber/10",     text: "text-accent-amber" },
  certificate:  { icon: Award,          bg: "bg-accent-amber/10",     text: "text-accent-amber" },
  peer_review:  { icon: MessageCircle,  bg: "bg-accent-pink/10",      text: "text-accent-pink" },
  course:       { icon: BookOpen,       bg: "bg-accent-emerald/10",   text: "text-accent-emerald" },
  map_like:     { icon: Heart,          bg: "bg-accent-pink/10",      text: "text-accent-pink" },
  map_comment:  { icon: MessageCircle,  bg: "bg-accent-cyan/10",      text: "text-accent-cyan" },
  new_follower: { icon: UserPlus,       bg: "bg-accent-blue/10",      text: "text-accent-blue" },
  map_posted:   { icon: Users,          bg: "bg-accent-purple/10",    text: "text-accent-purple" },
};
const defaultConfig = { icon: Info, bg: "bg-accent-blue/10", text: "text-accent-blue" };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Render "Ali, Sarah and 3 others" for digest entries. */
function actorsLine(actors: string[] | undefined, count: number): string {
  if (!actors || actors.length === 0) return "";
  if (count <= 1) return "";
  const filtered = actors.filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2 && count === 2) return `${filtered[0]} and ${filtered[1]}`;
  const rest = count - 2;
  if (rest <= 0) return filtered.slice(0, 2).join(", ");
  return `${filtered[0]}, ${filtered[1]} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

export default function NotificationsPageView() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDigestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    notificationsApi.listGrouped(50).then(setNotifications).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markReadLocally = (idsToFlip: string[]) => {
    const idSet = new Set(idsToFlip);
    setNotifications(prev =>
      prev.map(n => {
        const sources = n.source_ids && n.source_ids.length > 0 ? n.source_ids : [n.id];
        return sources.every(s => idSet.has(s)) ? { ...n, read: true } : n;
      })
    );
  };

  // A digest represents many underlying notification docs — fan out the
  // mark-read call across each source id so the server state stays consistent.
  const handleMarkRead = async (item: NotificationDigestItem) => {
    if (item.read) return;
    const ids = item.source_ids && item.source_ids.length > 0 ? item.source_ids : [item.id];
    await Promise.all(ids.map(id => notificationsApi.markRead(id).catch(() => null)));
    markReadLocally(ids);
  };

  const handleClick = (item: NotificationDigestItem) => {
    handleMarkRead(item);
    if (item.link) router.push(item.link);
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDelete = async (e: React.MouseEvent, item: NotificationDigestItem) => {
    e.stopPropagation();
    try {
      const ids = item.source_ids && item.source_ids.length > 0 ? item.source_ids : [item.id];
      await Promise.all(ids.map(id => notificationsApi.deleteOne(id).catch(() => null)));
      setNotifications(prev => prev.filter(n => n.id !== item.id));
    } catch { /* empty */ }
  };

  const handleClearAll = async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
    } catch { /* empty */ }
  };

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="text-sm text-gray-500 dark:text-dark-300">
              {notifications.length === 0 ? "No notifications" : `${notifications.length} total, ${unreadCount} unread`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead}
              className="text-sm text-accent-blue hover:text-accent-blue/80 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-accent-blue/5 transition-colors">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={handleClearAll}
              className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-500/5 border border-red-500/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/5">
        {(["all", "unread"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx("px-4 py-1.5 text-xs font-medium rounded-lg transition-all capitalize",
              filter === f
                ? "bg-white dark:bg-accent-blue text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-dark-300 hover:text-gray-700 dark:hover:text-dark-100"
            )}>
            {f} {f === "unread" && unreadCount > 0 ? `(${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-accent-blue/20 border-t-accent-blue animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 glass-card">
          <Bell className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-dark-400 font-medium">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
          <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
            {filter === "unread" ? "You're all caught up!" : "Notifications will appear here when there's activity"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n, i) => {
            const cfg = typeConfig[n.type] || defaultConfig;
            const Icon = cfg.icon;
            const isDigest = n.kind === "digest" && (n.count ?? 0) > 1;
            const actorText = isDigest ? actorsLine(n.actors, n.count ?? 0) : "";
            return (
              <motion.div key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * i }}
                onClick={() => handleClick(n)}
                className={clsx(
                  "glass-card p-4 flex items-start gap-3 cursor-pointer transition-colors group",
                  !n.read && "border-accent-blue/20 bg-accent-blue/5"
                )}>
                <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.bg)}>
                  <Icon className={clsx("w-4 h-4", cfg.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={clsx("text-sm font-medium",
                      n.read ? "text-gray-500 dark:text-dark-300" : "text-gray-900 dark:text-white"
                    )}>{n.title}</h3>
                    {isDigest && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-purple/15 text-accent-purple">
                        {n.count}
                      </span>
                    )}
                    {!n.read && <span className="w-2 h-2 rounded-full bg-accent-blue flex-shrink-0" />}
                  </div>
                  {actorText ? (
                    <p className="text-xs text-gray-500 dark:text-dark-300 mt-0.5 line-clamp-2">
                      <span className="font-medium text-gray-700 dark:text-dark-100">{actorText}</span>
                      {n.message ? <span className="ml-1 text-gray-500 dark:text-dark-400">— {n.message}</span> : null}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1.5">{timeAgo(n.createdAt)}</p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, n)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 dark:text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                  title="Delete notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
