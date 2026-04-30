"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { notificationsApi, type NotificationDigestItem } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, AlertTriangle, Info, CheckCheck, Trash2,
  Award, MessageCircle, BookOpen, X, Heart, UserPlus, Users,
} from "lucide-react";
import clsx from "clsx";

const typeConfig: Record<string, { icon: typeof Bell; bg: string; text: string }> = {
  urgent:       { icon: AlertTriangle, bg: "bg-red-500/10",       text: "text-red-400" },
  badge:        { icon: Award,          bg: "bg-accent-amber/10",  text: "text-accent-amber" },
  certificate:  { icon: Award,          bg: "bg-accent-amber/10",  text: "text-accent-amber" },
  message:      { icon: MessageCircle,  bg: "bg-accent-blue/10",   text: "text-accent-blue" },
  peer_review:  { icon: MessageCircle,  bg: "bg-accent-pink/10",   text: "text-accent-pink" },
  course:       { icon: BookOpen,       bg: "bg-accent-emerald/10", text: "text-accent-emerald" },
  map_like:     { icon: Heart,          bg: "bg-accent-pink/10",   text: "text-accent-pink" },
  map_comment:  { icon: MessageCircle,  bg: "bg-accent-cyan/10",   text: "text-accent-cyan" },
  new_follower: { icon: UserPlus,       bg: "bg-accent-blue/10",   text: "text-accent-blue" },
  map_posted:   { icon: Users,          bg: "bg-accent-purple/10", text: "text-accent-purple" },
};
const defaultConfig = { icon: Info, bg: "bg-accent-blue/10", text: "text-accent-blue" };

function actorsLine(actors: string[] | undefined, count: number): string {
  if (!actors || actors.length === 0 || count <= 1) return "";
  const filtered = actors.filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2 && count === 2) return `${filtered[0]} and ${filtered[1]}`;
  const rest = count - 2;
  if (rest <= 0) return filtered.slice(0, 2).join(", ");
  return `${filtered[0]}, ${filtered[1]} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationDropdownProps {
  /** "messages" filters to DM notifications only; "general" hides them. */
  kind?: "general" | "messages";
}

export default function NotificationDropdown({ kind = "general" }: NotificationDropdownProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState<NotificationDigestItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Mobile uses a bottom-sheet instead of a corner dropdown so the panel
  // doesn't get clipped by the screen edge.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Fetch a slightly wider window so message + general buckets each have
  // enough rows even when one type dominates the user's feed.
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.listGrouped(40);
      setAllNotifications(data);
    } catch {
      // Silently fail
    }
  }, []);

  const isMessages = kind === "messages";
  const notifications = allNotifications.filter((n) =>
    isMessages ? n.type === "message" : n.type !== "message"
  );
  const TriggerIcon = isMessages ? MessageCircle : Bell;
  const headerLabel = isMessages ? "Messages" : "Notifications";
  const emptyLabel = isMessages ? "No new messages" : "No notifications";
  const ariaLabel = isMessages ? "Messages" : "Notifications";

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sum raw-doc unread counts — a single digest may wrap multiple unread docs,
  // but the badge reflects the digest row count (≥ real unread, close enough
  // for a bell indicator).
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (item: NotificationDigestItem) => {
    if (item.read) return;
    const ids = item.source_ids && item.source_ids.length > 0 ? item.source_ids : [item.id];
    await Promise.all(ids.map((id) => notificationsApi.markRead(id).catch(() => null)));
    const idSet = new Set(ids);
    setAllNotifications((prev) =>
      prev.map((n) => {
        const sources = n.source_ids && n.source_ids.length > 0 ? n.source_ids : [n.id];
        return sources.every((s) => idSet.has(s)) ? { ...n, read: true } : n;
      })
    );
  };

  const handleClick = (item: NotificationDigestItem) => {
    handleMarkRead(item);
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };

  const handleMarkAllRead = async () => {
    // Only mark the rows visible in this bucket as read so the messages bell
    // and the general bell don't clobber each other.
    const visibleIds = new Set<string>();
    for (const n of notifications) {
      const sources = n.source_ids && n.source_ids.length > 0 ? n.source_ids : [n.id];
      sources.forEach((s) => visibleIds.add(s));
    }
    await Promise.all(
      Array.from(visibleIds).map((id) => notificationsApi.markRead(id).catch(() => null))
    );
    setAllNotifications((prev) =>
      prev.map((n) => {
        const sources = n.source_ids && n.source_ids.length > 0 ? n.source_ids : [n.id];
        return sources.every((s) => visibleIds.has(s)) ? { ...n, read: true } : n;
      })
    );
  };

  const handleDelete = async (e: React.MouseEvent, item: NotificationDigestItem) => {
    e.stopPropagation();
    try {
      const ids = item.source_ids && item.source_ids.length > 0 ? item.source_ids : [item.id];
      await Promise.all(ids.map((id) => notificationsApi.deleteOne(id).catch(() => null)));
      setAllNotifications((prev) => prev.filter((n) => n.id !== item.id));
    } catch { /* empty */ }
  };

  const handleClearAll = async () => {
    // Bucket-scoped: clear only rows currently shown in this dropdown.
    const idsToDelete = new Set<string>();
    for (const n of notifications) {
      const sources = n.source_ids && n.source_ids.length > 0 ? n.source_ids : [n.id];
      sources.forEach((s) => idsToDelete.add(s));
    }
    if (idsToDelete.size === 0) return;
    try {
      await Promise.all(
        Array.from(idsToDelete).map((id) => notificationsApi.deleteOne(id).catch(() => null))
      );
      setAllNotifications((prev) => prev.filter((n) => !notifications.some((vn) => vn.id === n.id)));
    } catch { /* empty */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <TriggerIcon className="w-5 h-5 text-dark-200 notif-bell-icon" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && isMobile && (
          // Backdrop for mobile bottom-sheet — taps anywhere outside dismiss.
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={isMobile ? { y: "100%" } : { opacity: 0, y: -5, scale: 0.95 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, y: -5, scale: 0.95 }}
            transition={isMobile ? { type: "spring", damping: 30, stiffness: 320 } : { duration: 0.15 }}
            className={clsx(
              "overflow-hidden glass-card notification-dropdown flex flex-col",
              isMobile
                // Bottom sheet — anchored to the bottom, full-width, rounded
                // top, max-height 75vh leaves room for the navbar above.
                ? "fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl rounded-b-none max-h-[75vh] pb-[env(safe-area-inset-bottom,0px)]"
                : "absolute right-0 top-full mt-2 w-96 max-h-[28rem] z-50"
            )}
          >
            {/* Drag handle (mobile only) for visual affordance */}
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 notif-divider flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white notif-header">{headerLabel}</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue font-medium">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-accent-blue hover:text-accent-blue/80 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent-blue/5 transition-colors"
                    title="Mark all read"
                  >
                    <CheckCheck className="w-3 h-3" /> Read all
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/5 transition-colors"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <TriggerIcon className="w-8 h-8 text-gray-300 dark:text-dark-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-dark-400 notif-empty">{emptyLabel}</p>
                </div>
              ) : (
                <div>
                  {notifications.map((n) => {
                    const cfg = typeConfig[n.type] || defaultConfig;
                    const Icon = cfg.icon;
                    const isDigest = n.kind === "digest" && (n.count ?? 0) > 1;
                    const actorText = isDigest ? actorsLine(n.actors, n.count ?? 0) : "";
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={clsx(
                          "px-4 py-3 border-b border-white/5 notif-divider last:border-0 cursor-pointer hover:bg-white/5 transition-colors group",
                          !n.read && "bg-accent-blue/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", cfg.bg)}>
                            <Icon className={clsx("w-3.5 h-3.5", cfg.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={clsx("text-sm font-medium notif-title", n.read ? "text-gray-500 dark:text-dark-300" : "text-gray-900 dark:text-white")}>{n.title}</p>
                              {isDigest && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-purple/15 text-accent-purple">
                                  {n.count}
                                </span>
                              )}
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />}
                            </div>
                            {actorText ? (
                              <p className="text-xs text-gray-500 dark:text-dark-300 mt-0.5 line-clamp-2 notif-message">
                                <span className="font-medium text-gray-700 dark:text-dark-100">{actorText}</span>
                                {n.message ? <span className="ml-1 text-gray-500 dark:text-dark-400">— {n.message}</span> : null}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5 line-clamp-2 notif-message">{n.message}</p>
                            )}
                            <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1 notif-time">{timeAgo(n.createdAt)}</p>
                          </div>
                          <button
                            onClick={(e) => handleDelete(e, n)}
                            className="p-1.5 rounded-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-gray-400 dark:text-dark-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all flex-shrink-0"
                            title="Delete notification"
                            aria-label="Delete notification"
                          >
                            <X className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
