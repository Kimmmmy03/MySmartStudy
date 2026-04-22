"use client";

import { useState, useEffect } from "react";
import { activityApi, ActivityOut } from "@/lib/api";
import { motion } from "framer-motion";
import { Activity, Map, ClipboardList, HelpCircle, MessageCircle, FileText, BookOpen } from "lucide-react";
import clsx from "clsx";

const actionIcons: Record<string, typeof Activity> = {
  map: Map,
  assignment: ClipboardList,
  quiz: HelpCircle,
  discussion: MessageCircle,
  resource: FileText,
  course: BookOpen,
};

const actionColors: Record<string, string> = {
  created: "text-accent-emerald bg-accent-emerald/10",
  submitted: "text-accent-blue bg-accent-blue/10",
  completed: "text-accent-purple bg-accent-purple/10",
  updated: "text-accent-amber bg-accent-amber/10",
  joined: "text-accent-cyan bg-accent-cyan/10",
  viewed: "text-dark-300 bg-white/5",
};

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

function groupByDate(items: ActivityOut[]): { label: string; items: ActivityOut[] }[] {
  const groups: Record<string, ActivityOut[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.createdAt).toDateString();
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(item.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activityApi.list(50).then(setActivities).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const grouped = groupByDate(activities);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Activity className="w-7 h-7 text-accent-blue" /> Activity Log
      </h1>

      {loading ? (
        <p className="text-dark-400 text-center py-8">Loading...</p>
      ) : activities.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">No activity recorded yet. Start learning!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-dark-400 mb-3">{group.label}</h3>
              <div className="space-y-2">
                {group.items.map((a, i) => {
                  const Icon = actionIcons[a.resourceType] || Activity;
                  const color = actionColors[a.action] || "text-dark-300 bg-white/5";
                  return (
                    <motion.div key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.02 * i }}
                      className="flex items-center gap-3 glass-card p-3">
                      <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          <span className="capitalize">{a.action}</span>{" "}
                          <span className="text-dark-300">{a.resourceType}</span>
                          {a.title && <span className="text-dark-200"> — {a.title}</span>}
                        </p>
                      </div>
                      <span className="text-xs text-dark-500 flex-shrink-0">{timeAgo(a.createdAt)}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
