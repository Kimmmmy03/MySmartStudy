"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { adminApi, type UserAnalyticsResponse } from "@/lib/api";
import {
  Clock, ArrowLeft, Calendar, Download, RefreshCw, Activity,
  TrendingUp, TrendingDown, Mail, Shield, Layers,
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

function shortDate(iso: string): string {
  // iso is YYYY-MM-DD
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function UserAnalyticsPage() {
  const params = useParams();
  const uid = String(params?.uid || "");

  const [data, setData] = useState<UserAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);
  const [exporting, setExporting] = useState(false);

  async function load() {
    if (!uid) return;
    setLoading(true);
    try {
      const d = await adminApi.getUserAnalytics(uid, days);
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uid, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const daily = data?.daily ?? [];
  const maxDaily = useMemo(() => daily.reduce((m, d) => Math.max(m, d.minutes), 0) || 1, [daily]);
  const totalFeatures = data ? Object.keys(data.features).length : 0;
  const activeDays = daily.filter(d => d.minutes > 0).length;

  async function exportPdf() {
    if (!data) return;
    setExporting(true);
    try {
      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const JsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;
      const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      doc.setFontSize(16);
      doc.text(`User Analytics — ${data.user.displayName || data.user.email}`, 40, 48);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${data.user.email}   |   role: ${data.user.role}   |   total: ${data.totalLabel}   |   active days: ${activeDays}`,
        40, 66
      );
      doc.text(`Generated ${new Date().toLocaleString()}`, 40, 80);

      // Most used features table
      autoTable(doc, {
        startY: 100,
        head: [["#", "Most Used Feature", "Time"]],
        body: data.mostUsedFeatures.map((f, i) => [i + 1, featureLabel(f.feature), minutesLabel(f.minutes)]),
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      const afterMost = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200;

      // Least used features table
      autoTable(doc, {
        startY: afterMost + 20,
        head: [["#", "Least Used Feature", "Time"]],
        body: data.leastUsedFeatures.map((f, i) => [i + 1, featureLabel(f.feature), minutesLabel(f.minutes)]),
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [168, 85, 247] },
      });

      const afterLeast = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 400;

      // Daily breakdown table
      autoTable(doc, {
        startY: afterLeast + 20,
        head: [["Date", "Minutes", "Top Feature"]],
        body: daily.map(d => {
          const top = Object.entries(d.features).sort(([, a], [, b]) => b - a)[0];
          return [
            d.date,
            minutesLabel(d.minutes),
            top ? `${featureLabel(top[0])} (${minutesLabel(top[1])})` : "—",
          ];
        }),
        theme: "striped",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
      });

      const safe = (data.user.displayName || data.user.email || uid).replace(/[^a-z0-9]+/gi, "_");
      doc.save(`user-analytics-${safe}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  if (!uid) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/usage-analytics"
            className="w-9 h-9 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">User Analytics</h1>
            <p className="text-dark-300 text-sm mt-1">Per-user time spent and feature usage breakdown.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="glass-input px-3 py-2 rounded-xl text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
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
            disabled={exporting || !data}
            className="btn-gradient px-4 py-2 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="glass-card p-10 text-center text-dark-400">Loading...</div>
      ) : !data ? (
        <div className="glass-card p-10 text-center">
          <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-dark-300 text-sm">No data for this user.</p>
        </div>
      ) : (
        <>
          {/* User header card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-4">
              {data.user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.user.photoURL} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {(data.user.displayName || data.user.email || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-lg truncate">{data.user.displayName || "Unknown"}</p>
                <div className="flex items-center gap-3 flex-wrap mt-0.5 text-xs text-dark-300">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{data.user.email}</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{data.user.role}</span>
                  {data.firstSeenAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      First seen {new Date(data.firstSeenAt).toLocaleDateString()}
                    </span>
                  )}
                  {data.lastSeenAt && (
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Last seen {new Date(data.lastSeenAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Time", value: data.totalLabel, icon: Clock, color: "from-accent-blue to-accent-cyan" },
              { label: "Active Days", value: `${activeDays} / ${daily.length}`, icon: Calendar, color: "from-accent-purple to-accent-pink" },
              { label: "Features Used", value: totalFeatures, icon: Layers, color: "from-accent-emerald to-accent-cyan" },
              {
                label: "Top Feature",
                value: data.mostUsedFeatures[0] ? featureLabel(data.mostUsedFeatures[0].feature) : "—",
                sub: data.mostUsedFeatures[0] ? minutesLabel(data.mostUsedFeatures[0].minutes) : "",
                icon: TrendingUp,
                color: "from-accent-amber to-orange-400",
              },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-dark-300 text-xs">{s.label}</p>
                    <p className="text-white font-bold text-xl mt-1 truncate">{s.value}</p>
                    {"sub" in s && s.sub && <p className="text-dark-400 text-xs mt-0.5">{s.sub}</p>}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Daily chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-5"
          >
            <h2 className="text-white font-semibold mb-4">Daily Activity (last {daily.length} days)</h2>
            {daily.length === 0 ? (
              <p className="text-dark-400 text-sm">No activity yet.</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {daily.map((d) => {
                  const pct = (d.minutes / maxDaily) * 100;
                  const hasData = d.minutes > 0;
                  return (
                    <div
                      key={d.date}
                      className="group relative flex-1 min-w-0 flex flex-col items-center justify-end h-full"
                      title={`${d.date}: ${minutesLabel(d.minutes)}`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${hasData ? "bg-gradient-to-t from-accent-blue to-accent-purple" : "bg-white/5"}`}
                        style={{ height: `${Math.max(pct, hasData ? 4 : 2)}%` }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                        {shortDate(d.date)}: {minutesLabel(d.minutes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-dark-500 mt-2">
              <span>{daily[0] ? shortDate(daily[0].date) : ""}</span>
              <span>{daily[daily.length - 1] ? shortDate(daily[daily.length - 1].date) : ""}</span>
            </div>
          </motion.div>

          {/* Most / least used */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-accent-emerald" />
                <h2 className="text-white font-semibold">Most Used Features</h2>
              </div>
              {data.mostUsedFeatures.length === 0 ? (
                <p className="text-dark-400 text-sm">No features tracked yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.mostUsedFeatures.map((f, i) => {
                    const maxMin = data.mostUsedFeatures[0]?.minutes || 1;
                    return (
                      <div key={f.feature} className="flex items-center gap-3">
                        <span className="text-xs text-dark-400 w-5">{i + 1}</span>
                        <span className="text-sm text-white/80 w-32 truncate">{featureLabel(f.feature)}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent-emerald to-accent-cyan"
                            style={{ width: `${(f.minutes / maxMin) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/60 font-mono w-16 text-right">{minutesLabel(f.minutes)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-accent-amber" />
                <h2 className="text-white font-semibold">Least Used Features</h2>
              </div>
              {data.leastUsedFeatures.length === 0 ? (
                <p className="text-dark-400 text-sm">No features tracked yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.leastUsedFeatures.map((f, i) => {
                    const maxMin = data.mostUsedFeatures[0]?.minutes || 1;
                    return (
                      <div key={f.feature} className="flex items-center gap-3">
                        <span className="text-xs text-dark-400 w-5">{i + 1}</span>
                        <span className="text-sm text-white/80 w-32 truncate">{featureLabel(f.feature)}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent-amber to-orange-400"
                            style={{ width: `${Math.max((f.minutes / maxMin) * 100, 4)}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/60 font-mono w-16 text-right">{minutesLabel(f.minutes)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* Daily breakdown table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-4 border-b border-white/5">
              <h2 className="text-white font-semibold">Daily Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-dark-400 text-xs border-b border-white/5">
                    <th className="text-left p-3 pl-4">Date</th>
                    <th className="text-right p-3">Time Spent</th>
                    <th className="text-left p-3">Top Feature</th>
                    <th className="text-right p-3 pr-4">Features Used</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map((d) => {
                    const entries = Object.entries(d.features).sort(([, a], [, b]) => b - a);
                    const top = entries[0];
                    return (
                      <tr key={d.date} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-3 pl-4 text-white/80 font-mono text-xs">{d.date}</td>
                        <td className="p-3 text-right font-mono text-white/80">{minutesLabel(d.minutes)}</td>
                        <td className="p-3 text-white/70">
                          {top ? (
                            <span>
                              {featureLabel(top[0])}
                              <span className="text-dark-400 text-xs ml-2">({minutesLabel(top[1])})</span>
                            </span>
                          ) : (
                            <span className="text-dark-500">—</span>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right text-dark-400 text-xs">{entries.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
