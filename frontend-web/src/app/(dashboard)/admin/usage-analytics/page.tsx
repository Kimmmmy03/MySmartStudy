"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { adminApi, type TopUserRecord, type TopUsersResponse } from "@/lib/api";
import {
  Clock, Users, TrendingUp, Download, RefreshCw, ArrowUpRight, BarChart3,
  Search, X, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import clsx from "clsx";

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
      const d = await adminApi.getTopUsers({ limit: 5000 });
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

  // ── Search / filter / sort / paginate ──
  type SortKey = "rank" | "name" | "role" | "total" | "mostUsed" | "lastSeen" | "class";
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "lecturer" | "admin">("all");
  // Department filter — populated from the data so admins can scope to a
  // single faculty/dept. "all" disables the filter.
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Unique non-empty department list, sorted, derived from the loaded users.
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      const d = u.user.department?.trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [users]);

  // Format class/dept/year-semester into a single chip-friendly label per row.
  const cohortLabel = (u: TopUserRecord["user"]) => {
    const parts: string[] = [];
    if (u.className) parts.push(u.className);
    if (u.department) parts.push(u.department);
    if (u.year) parts.push(`Y${u.year}`);
    if (u.semester) parts.push(`S${u.semester}`);
    return parts.join(" · ");
  };

  const visibleUsers = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    let list = users;
    if (roleFilter !== "all") list = list.filter(u => (u.user.role || "").toLowerCase() === roleFilter);
    if (deptFilter !== "all") list = list.filter(u => (u.user.department || "") === deptFilter);
    if (term) {
      // Match name, email, OR class/department so admins can search "BIT 2A"
      // or "computer science" directly from the search box.
      list = list.filter(u =>
        (u.user.displayName || "").toLowerCase().includes(term) ||
        (u.user.email || "").toLowerCase().includes(term) ||
        (u.user.className || "").toLowerCase().includes(term) ||
        (u.user.department || "").toLowerCase().includes(term)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.user.displayName || "").localeCompare(b.user.displayName || "");
          break;
        case "role":
          cmp = (a.user.role || "").localeCompare(b.user.role || "");
          break;
        case "class":
          cmp = cohortLabel(a.user).localeCompare(cohortLabel(b.user));
          break;
        case "total":
          cmp = a.totalMinutes - b.totalMinutes;
          break;
        case "mostUsed":
          cmp = (a.mostUsedFeature || "").localeCompare(b.mostUsedFeature || "");
          break;
        case "lastSeen":
          cmp = new Date(a.lastSeenAt || 0).getTime() - new Date(b.lastSeenAt || 0).getTime();
          break;
        default:
          cmp = a.totalMinutes - b.totalMinutes;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchInput, roleFilter, deptFilter, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [searchInput, roleFilter, deptFilter, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / pageSize));
  const pagedUsers = visibleUsers.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "role" || key === "mostUsed" ? "asc" : "desc");
    }
  }

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

      // Export respects the current search/filter/sort so admins can PDF a
      // subset (e.g. only lecturers with low usage) instead of the full list.
      autoTable(doc, {
        startY: 90,
        head: [[
          "#", "Name", "Email", "Role", "Class / Dept", "Total Time", "Most Used", "Least Used", "Last Seen",
        ]],
        body: visibleUsers.map((u, i) => [
          i + 1,
          u.user.displayName || "Unknown",
          u.user.email || "",
          u.user.role || "",
          cohortLabel(u.user) || "—",
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
        <div className="p-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">Top Users by Time Spent</h2>
            <span className="text-xs text-dark-400">
              {visibleUsers.length === users.length
                ? `${users.length} users`
                : `${visibleUsers.length} of ${users.length}`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search name, email, class, dept..."
                className="glass-input pl-8 pr-7 py-1.5 text-xs w-64 rounded-lg"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Department dropdown — only render once we have at least one
                department to filter by, so the chip doesn't dangle empty. */}
            {departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="glass-input py-1.5 px-2 text-xs rounded-lg max-w-[12rem]"
                aria-label="Filter by department"
              >
                <option value="all">All departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
            {/* Role filter chips */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              {(["all", "student", "lecturer", "admin"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={clsx(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors",
                    roleFilter === r
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-dark-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
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
        ) : visibleUsers.length === 0 ? (
          <div className="p-10 text-center">
            <Search className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-dark-300 text-sm">No users match your search or filter.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-dark-400 text-xs border-b border-white/5">
                    <th className="text-left p-3 pl-4">#</th>
                    <SortHeader label="User" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                    <SortHeader label="Role" active={sortKey === "role"} dir={sortDir} onClick={() => toggleSort("role")} />
                    <SortHeader label="Class / Dept" active={sortKey === "class"} dir={sortDir} onClick={() => toggleSort("class")} />
                    <SortHeader label="Total Time" align="right" active={sortKey === "total"} dir={sortDir} onClick={() => toggleSort("total")} />
                    <SortHeader label="Most Used" active={sortKey === "mostUsed"} dir={sortDir} onClick={() => toggleSort("mostUsed")} />
                    <th className="text-left p-3">Least Used</th>
                    <SortHeader label="Last Seen" align="right" active={sortKey === "lastSeen"} dir={sortDir} onClick={() => toggleSort("lastSeen")} />
                    <th className="p-3 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((row: TopUserRecord, i) => (
                    <tr
                      key={row.userId}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-3 pl-4 text-dark-400">{(page - 1) * pageSize + i + 1}</td>
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
                      <td className="p-3 capitalize text-dark-300 text-xs">{row.user.role || "—"}</td>
                      <td className="p-3 text-xs">
                        {(() => {
                          const label = cohortLabel(row.user);
                          if (!label) return <span className="text-dark-500">—</span>;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {row.user.className && (
                                <span className="px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue">{row.user.className}</span>
                              )}
                              {row.user.department && (
                                <span className="px-1.5 py-0.5 rounded bg-accent-purple/10 text-accent-purple">{row.user.department}</span>
                              )}
                              {(row.user.year || row.user.semester) && (
                                <span className="px-1.5 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald">
                                  {row.user.year ? `Y${row.user.year}` : ""}{row.user.year && row.user.semester ? "·" : ""}{row.user.semester ? `S${row.user.semester}` : ""}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-white/5 text-xs text-dark-400">
                <span>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleUsers.length)} of {visibleUsers.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-white">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={clsx("p-3", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={onClick}
        className={clsx(
          "inline-flex items-center gap-1 text-xs uppercase tracking-wide font-medium transition-colors",
          active ? "text-accent-blue" : "text-dark-400 hover:text-white"
        )}
      >
        {label}
        <Icon className="w-3 h-3" />
      </button>
    </th>
  );
}
