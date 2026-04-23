"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { adminApi, type TopUserRecord, type TopUsersResponse } from "@/lib/api";
import {
  Clock, Users, TrendingUp, Download, RefreshCw, ArrowUpRight, BarChart3,
} from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  courses: "Courses",
  course_detail: "Course Detail",
  assignments: "Assignments",
  quizzes: "Quizzes",
  maps: "Mind Maps",
  mindmap_editor: "Mind Map Editor",
  gradebook: "Gradebook",
  messages: "Messages",
  planner: "Planner",
  calendar: "Calendar",
  achievements: "Achievements",
  profile: "Profile",
  attendance: "Attendance",
  peer_review: "Peer Review",
  groups: "Groups",
  companion: "AI Companion",
  study_materials: "Study Materials",
  study_plan: "Study Plan",
  plagiarism: "Plagiarism",
  mindmap_buddy: "Mind Map Buddy",
  images: "Image Gen",
  admin: "Admin",
  other: "Other",
};

function featureLabel(k: string): string {
  return FEATURE_LABELS[k] || k.replace(/_/g, " ");
}

function minutesLabel(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export default function UsageAnalyticsPage() {
  const [data, setData] = useState<TopUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await adminApi.getTopUsers({ limit: 50 });
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const users = data?.users ?? [];
  const summary = data?.summary;

  const featureRanking = useMemo(() => {
    if (!summary) return [] as { key: string; minutes: number }[];
    return Object.entries(summary.globalFeatures)
      .map(([k, v]) => ({ key: k, minutes: v }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [summary]);

  const topFeatureTotal = featureRanking[0]?.minutes || 1;

  async function exportPdf() {
    if (!users.length) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as unknown as { default: typeof import("jspdf-autotable").default }).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const now = new Date();

      doc.setFontSize(18);
      doc.setTextColor(20, 20, 30);
      doc.text("MySmartStudy — Top Users Analytics", 40, 40);

      doc.setFontSize(10);
      doc.setTextColor(110, 110, 120);
      doc.text(`Generated ${now.toLocaleString()}`, 40, 58);
      if (summary) {
        doc.text(
          `${summary.totalUsers} active users   |   total time ${summary.grandTotalLabel}   |   top feature: ${featureLabel(summary.topFeature)}`,
          40, 74
        );
      }

      autoTable(doc, {
        startY: 90,
        head: [[
          "#", "Name", "Email", "Role", "Total Time", "Most Used", "Least Used", "Last Seen",
        ]],
        body: users.map((u, i) => [
          i + 1,
          u.user.displayName || "Unknown",
          u.user.email || "",
          u.user.role || "",
          u.totalLabel,
          u.mostUsedFeature ? featureLabel(u.mostUsedFeature) : "—",
          u.leastUsedFeature ? featureLabel(u.leastUsedFeature) : "—",
          u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
        ]),
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [120, 140, 200], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 253] },
      });

      // Feature ranking table
      const endY1 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 200;
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 30);
      doc.text("Feature Usage Ranking (all users combined)", 40, endY1 + 28);

      autoTable(doc, {
        startY: endY1 + 40,
        head: [["Rank", "Feature", "Minutes", "Share"]],
        body: featureRanking.map((f, i) => [
          i + 1,
          featureLabel(f.key),
          f.minutes,
          `${((f.minutes / (summary?.grandTotalMinutes || 1)) * 100).toFixed(1)}%`,
        ]),
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [160, 140, 200], textColor: 255, fontStyle: "bold" },
      });

      doc.save(`mysmartstudy-top-users-${now.toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const stats = [
    {
      label: "Active Users",
      value: summary?.totalUsers ?? 0,
      icon: Users,
      color: "from-accent-blue to-accent-cyan",
    },
    {
      label: "Total Time Spent",
      value: summary?.grandTotalLabel ?? "—",
      icon: Clock,
      color: "from-accent-purple to-accent-pink",
    },
    {
      label: "Top Feature",
      value: summary ? featureLabel(summary.topFeature) || "—" : "—",
      sub: summary ? minutesLabel(summary.topFeatureMinutes) : "",
      icon: TrendingUp,
      color: "from-accent-amber to-orange-400",
    },
    {
      label: "Features Tracked",
      value: featureRanking.length,
      icon: BarChart3,
      color: "from-accent-emerald to-accent-cyan",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Usage Analytics</h1>
          <p className="text-dark-300 text-sm mt-1">Top users by time spent + feature usage. Export as PDF for reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting || users.length === 0}
            className="btn-gradient px-4 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-dark-300 text-xs">{s.label}</p>
                <p className="text-white font-bold text-xl mt-1">{s.value}</p>
                {s.sub && <p className="text-dark-400 text-xs mt-0.5">{s.sub}</p>}
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Feature ranking bar */}
      {featureRanking.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <h2 className="text-white font-semibold mb-4">Feature Usage Ranking</h2>
          <div className="space-y-2">
            {featureRanking.slice(0, 10).map((f, i) => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="text-xs text-dark-400 w-5">{i + 1}</span>
                <span className="text-sm text-white/80 w-40 truncate">{featureLabel(f.key)}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-blue to-accent-purple"
                    style={{ width: `${(f.minutes / topFeatureTotal) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/60 font-mono w-16 text-right">{minutesLabel(f.minutes)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top users table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-4 border-b border-white/5">
          <h2 className="text-white font-semibold">Top Users by Time Spent</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-dark-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-dark-300 text-sm">No activity recorded yet.</p>
            <p className="text-dark-500 text-xs mt-1">
              Usage is tracked automatically once users open the app. Give it a few minutes after deploy.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-dark-400 text-xs border-b border-white/5">
                  <th className="text-left p-3 pl-4">#</th>
                  <th className="text-left p-3">User</th>
                  <th className="text-right p-3">Total Time</th>
                  <th className="text-left p-3">Most Used</th>
                  <th className="text-left p-3">Least Used</th>
                  <th className="text-right p-3">Last Seen</th>
                  <th className="p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((row: TopUserRecord, i) => (
                  <motion.tr
                    key={row.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.03 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-3 pl-4 text-dark-400">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {row.user.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold">
                            {(row.user.displayName || row.user.email || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm font-medium leading-tight">{row.user.displayName || "Unknown"}</p>
                          <p className="text-dark-400 text-xs">{row.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-white/80">{row.totalLabel}</td>
                    <td className="p-3 text-white/70">{row.mostUsedFeature ? featureLabel(row.mostUsedFeature) : "—"}</td>
                    <td className="p-3 text-white/50">{row.leastUsedFeature ? featureLabel(row.leastUsedFeature) : "—"}</td>
                    <td className="p-3 text-right text-dark-400 text-xs whitespace-nowrap">
                      {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="p-3 pr-4">
                      <Link
                        href={`/admin/users/${row.userId}/analytics`}
                        className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
                      >
                        Details <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
