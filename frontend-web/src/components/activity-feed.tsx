"use client";

import { useState, useEffect } from "react";
import { activityApi, type ActivityOut } from "@/lib/api";
import { motion } from "framer-motion";
import { Map, BookOpen, FileText, Award, Clock } from "lucide-react";

const ICONS: Record<string, typeof Map> = {
  map: Map,
  course: BookOpen,
  assignment: FileText,
  badge: Award,
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  joined: "Joined",
  submitted: "Submitted",
  earned: "Earned",
};

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

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activityApi.list(15).then(setActivities).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-accent-blue" />
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-accent-blue" />
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
      </div>

      {activities.length === 0 ? (
        <p className="text-dark-400 text-sm text-center py-4">No recent activity.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((a, i) => {
            const Icon = ICONS[a.resourceType] || FileText;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-accent-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-100">
                    <span className="font-medium text-white">
                      {ACTION_LABELS[a.action] || a.action}
                    </span>{" "}
                    a {a.resourceType}
                    {a.title && (
                      <span className="text-dark-300"> — {a.title}</span>
                    )}
                  </p>
                  <p className="text-xs text-dark-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
