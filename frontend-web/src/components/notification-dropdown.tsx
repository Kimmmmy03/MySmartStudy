"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { notificationsApi, type NotificationOut } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, AlertTriangle, Info, CheckCheck, Trash2,
  Award, MessageCircle, BookOpen, X,
} from "lucide-react";
import clsx from "clsx";

const typeConfig: Record<string, { icon: typeof Bell; bg: string; text: string }> = {
  urgent: { icon: AlertTriangle, bg: "bg-red-500/10", text: "text-red-400" },
  badge: { icon: Award, bg: "bg-accent-amber/10", text: "text-accent-amber" },
  certificate: { icon: Award, bg: "bg-accent-amber/10", text: "text-accent-amber" },
  peer_review: { icon: MessageCircle, bg: "bg-accent-pink/10", text: "text-accent-pink" },
  course: { icon: BookOpen, bg: "bg-accent-emerald/10", text: "text-accent-emerald" },
};
const defaultConfig = { icon: Info, bg: "bg-accent-blue/10", text: "text-accent-blue" };

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

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list(20);
      setNotifications(data);
    } catch {
      // Silently fail
    }
  }, []);

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (nid: string) => {
    await notificationsApi.markRead(nid);
    setNotifications((prev) =>
      prev.map((n) => (n.id === nid ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDelete = async (e: React.MouseEvent, nid: string) => {
    e.stopPropagation();
    try {
      await notificationsApi.deleteOne(nid);
      setNotifications((prev) => prev.filter((n) => n.id !== nid));
    } catch { /* empty */ }
  };

  const handleClearAll = async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
    } catch { /* empty */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5 text-dark-200 notif-bell-icon" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] overflow-hidden glass-card z-50 notification-dropdown flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 notif-divider flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white notif-header">Notifications</span>
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
                  <Bell className="w-8 h-8 text-gray-300 dark:text-dark-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-dark-400 notif-empty">No notifications</p>
                </div>
              ) : (
                <div>
                  {notifications.map((n) => {
                    const cfg = typeConfig[n.type] || defaultConfig;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => !n.read && handleMarkRead(n.id)}
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
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5 line-clamp-2 notif-message">{n.message}</p>
                            <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1 notif-time">{timeAgo(n.createdAt)}</p>
                          </div>
                          <button
                            onClick={(e) => handleDelete(e, n.id)}
                            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 dark:text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                            title="Delete notification"
                          >
                            <X className="w-3.5 h-3.5" />
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
