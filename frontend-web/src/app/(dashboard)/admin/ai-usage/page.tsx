"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { adminApi, AiUsageRecord, AiUsageSummary } from "@/lib/api";
import { Zap, Users, BarChart2, Trophy, RefreshCw, Check, X, Gauge, Info } from "lucide-react";

// ── Feature config ──────────────────────────────────────────────────────────
const FEATURES = [
  { key: "companion",       label: "Study Companion",  color: "bg-accent-blue" },
  { key: "study_materials", label: "Study Materials",  color: "bg-accent-purple" },
  { key: "study_plan",      label: "Study Plan",       color: "bg-accent-cyan" },
  { key: "grading",         label: "AI Grading",       color: "bg-accent-amber" },
  { key: "plagiarism",      label: "Plagiarism",       color: "bg-red-400" },
  { key: "mindmap_buddy",   label: "Mind Map Buddy",   color: "bg-accent-emerald" },
  { key: "import",          label: "Course Import",    color: "bg-accent-pink" },
  { key: "images",          label: "Image Gen",        color: "bg-orange-400" },
] as const;

const DEFAULT_LIMIT = 3;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Stacked feature bar ─────────────────────────────────────────────────────
function FeatureBar({ features, total }: { features: Record<string, { tokens: number }>, total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-gray-200 dark:bg-white/10 w-full" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden w-full gap-px">
      {FEATURES.map(f => {
        const pct = (features[f.key]?.tokens || 0) / total * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={f.key}
            title={`${f.label}: ${fmt(features[f.key]?.tokens || 0)} tokens (${pct.toFixed(1)}%)`}
            className={`${f.color} opacity-80 hover:opacity-100 transition-opacity`}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

// ── Quota inline edit ───────────────────────────────────────────────────────
function QuotaCell({ uid, initial, onSaved }: { uid: string; initial: number | null; onSaved?: (next: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial !== null ? String(initial) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const parsed = value.trim() === "" ? null : parseInt(value, 10);
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
      await adminApi.setUserImageQuota(uid, parsed);
      onSaved?.(parsed);
      setEditing(false);
    } catch {
      alert("Failed to save quota");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-gray-600 hover:text-gray-900 dark:text-white/60 dark:hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-white/10"
      >
        {initial !== null ? `${initial}/day` : `Default (${DEFAULT_LIMIT}/day)`}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={String(DEFAULT_LIMIT)}
        className="glass-input w-16 text-sm px-2 py-1 rounded"
        autoFocus
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="text-accent-emerald hover:opacity-80 transition-opacity">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-800 dark:text-white/40 dark:hover:text-white/80 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Per-user daily token limit inline edit ──────────────────────────────────
function TokenLimitCell({
  uid, initial, globalLimit, onSaved,
}: {
  uid: string;
  initial: number | null;
  globalLimit: number;
  onSaved?: (next: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial !== null ? String(initial) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const parsed = value.trim() === "" ? null : parseInt(value, 10);
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
      await adminApi.setUserTokenLimit(uid, parsed);
      onSaved?.(parsed);
      setEditing(false);
    } catch {
      alert("Failed to save token limit");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const label = initial !== null
      ? (initial === 0 ? "Unlimited" : `${fmt(initial)}/day`)
      : `Global (${fmt(globalLimit)}/day)`;
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-gray-600 hover:text-gray-900 dark:text-white/60 dark:hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-white/10"
        title="Click to override (0 = unlimited, empty = use global)"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="global"
        className="glass-input w-20 text-sm px-2 py-1 rounded"
        autoFocus
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="text-accent-emerald hover:opacity-80 transition-opacity">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-800 dark:text-white/40 dark:hover:text-white/80 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Global daily token limit card ───────────────────────────────────────────
function GlobalTokenLimitCard({
  limit, defaultLimit, onSaved,
}: {
  limit: number;
  defaultLimit: number;
  onSaved: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(limit));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(String(limit)); }, [limit]);

  async function save() {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) { alert("Enter 0 (unlimited) or a positive integer"); return; }
    setSaving(true);
    try {
      const res = await adminApi.setAiTokenLimit(parsed);
      onSaved(res.limit);
      setEditing(false);
    } catch {
      alert("Failed to save global token limit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-5"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold">Global Daily Token Limit</h3>
            <p className="text-gray-600 dark:text-white/50 text-xs mt-0.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Applied to every user without a personal override. <span className="font-mono">0</span> = unlimited. Resets 00:00 UTC.
            </p>
            <p className="text-gray-500 dark:text-white/40 text-xs mt-1">
              Recommended: <span className="font-mono font-semibold text-gray-700 dark:text-white/70">{fmt(defaultLimit)}/day</span> (~$0.05/user/day worst case on Gemini 2.5 Flash).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="number"
                min={0}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="50000"
                className="glass-input w-28 text-sm px-3 py-2 rounded"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              />
              <button onClick={save} disabled={saving} className="btn-gradient px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50">
                <Check className="w-4 h-4" /> Save
              </button>
              <button onClick={() => { setEditing(false); setValue(String(limit)); }} className="px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                {limit === 0 ? "∞" : fmt(limit)}
              </span>
              <span className="text-sm text-gray-500 dark:text-white/40">/day</span>
              <button onClick={() => setEditing(true)} className="ml-2 px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AiUsagePage() {
  const [usage, setUsage] = useState<AiUsageRecord[]>([]);
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [globalLimit, setGlobalLimit] = useState(50_000);
  const [defaultLimit, setDefaultLimit] = useState(50_000);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.getAiUsage({ limit: 100 });
      setUsage(data.usage);
      setSummary(data.summary);
      setGlobalLimit(data.global_token_limit);
      setDefaultLimit(data.default_token_limit);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const topUser = usage[0];
  const topFeature = summary
    ? Object.entries(summary.by_feature).sort((a, b) => b[1].tokens - a[1].tokens)[0]
    : null;
  const topFeatureMeta = topFeature ? FEATURES.find(f => f.key === topFeature[0]) : null;

  const stats = [
    {
      label: "Total Tokens Used",
      value: fmt(summary?.total_tokens ?? 0),
      icon: Zap,
      color: "from-accent-blue to-accent-cyan",
    },
    {
      label: "Total API Calls",
      value: fmt(summary?.total_calls ?? 0),
      icon: BarChart2,
      color: "from-accent-purple to-accent-pink",
    },
    {
      label: "Most Used Feature",
      value: topFeatureMeta?.label ?? "—",
      sub: topFeature ? `${topFeature[1].percentage}% of tokens` : "",
      icon: Trophy,
      color: "from-accent-amber to-orange-400",
    },
    {
      label: "Active Users",
      value: String(usage.length),
      sub: topUser ? `Top: ${topUser.user.displayName || topUser.user.email || "Unknown"}` : "",
      icon: Users,
      color: "from-accent-emerald to-accent-cyan",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Token Usage</h1>
          <p className="text-gray-600 dark:text-white/50 text-sm mt-1">Gemini API consumption per user and feature</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-gradient px-4 py-2 rounded-xl flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
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
                <p className="text-gray-600 dark:text-white/50 text-xs">{s.label}</p>
                <p className="text-gray-900 dark:text-white font-bold text-xl mt-1">{s.value}</p>
                {s.sub && <p className="text-gray-500 dark:text-white/40 text-xs mt-0.5 truncate">{s.sub}</p>}
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Global token limit */}
      <GlobalTokenLimitCard
        limit={globalLimit}
        defaultLimit={defaultLimit}
        onSaved={setGlobalLimit}
      />

      {/* Overall feature breakdown */}
      {summary && summary.total_tokens > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5"
        >
          <h2 className="text-gray-900 dark:text-white font-semibold mb-4">Feature Breakdown (All Users)</h2>
          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden w-full gap-px mb-4">
            {FEATURES.map(f => {
              const pct = summary.by_feature[f.key]?.percentage || 0;
              if (pct < 0.5) return null;
              return (
                <div
                  key={f.key}
                  title={`${f.label}: ${pct}%`}
                  className={`${f.color} hover:opacity-80 transition-opacity`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {FEATURES.map(f => {
              const feat = summary.by_feature[f.key];
              if (!feat || feat.tokens === 0) return null;
              return (
                <div key={f.key} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-white/70">
                  <div className={`w-2.5 h-2.5 rounded-sm ${f.color}`} />
                  <span>{f.label}</span>
                  <span className="text-gray-500 dark:text-white/40">({feat.percentage}%)</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Users table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-4 border-b border-gray-200 dark:border-white/5">
          <h2 className="text-gray-900 dark:text-white font-semibold">Usage by User</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-white/40">Loading...</div>
        ) : usage.length === 0 ? (
          <div className="p-10 text-center">
            <Zap className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-white/50 text-sm">No AI activity recorded yet.</p>
            <p className="text-gray-500 dark:text-white/30 text-xs mt-1">Usage is tracked automatically when AI features are used.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-white/40 text-xs border-b border-gray-200 dark:border-white/5">
                  <th className="text-left p-3 pl-4">User</th>
                  <th className="text-right p-3">Total Tokens</th>
                  <th className="text-right p-3">Today</th>
                  <th className="text-right p-3">API Calls</th>
                  <th className="p-3 w-40">Feature Breakdown</th>
                  <th className="text-center p-3">Token Limit</th>
                  <th className="text-center p-3">Image Quota</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row, i) => (
                  <motion.tr
                    key={row.userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.03 }}
                    className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                  >
                    {/* User info */}
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-2">
                        {row.user.photoURL ? (
                          <img src={row.user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-white/50 text-xs font-bold">
                            {(row.user.displayName || row.user.email || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-gray-900 dark:text-white text-sm font-medium leading-tight">
                            {row.user.displayName || "Unknown"}
                          </p>
                          <p className="text-gray-500 dark:text-white/40 text-xs">{row.user.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Tokens */}
                    <td className="p-3 text-right font-mono text-gray-800 dark:text-white/80">{fmt(row.total_tokens)}</td>
                    {/* Today */}
                    <td className="p-3 text-right font-mono">
                      {(() => {
                        const effLimit = row.token_limit_override ?? globalLimit;
                        const pct = effLimit > 0 ? Math.min(100, (row.tokens_today / effLimit) * 100) : 0;
                        const warn = effLimit > 0 && pct >= 80;
                        return (
                          <span
                            className={warn ? "text-accent-amber" : "text-gray-800 dark:text-white/80"}
                            title={effLimit === 0 ? "Unlimited" : `${row.tokens_today.toLocaleString()} / ${effLimit.toLocaleString()} (${pct.toFixed(0)}%)`}
                          >
                            {fmt(row.tokens_today)}
                            {effLimit > 0 && (
                              <span className="text-gray-400 dark:text-white/30 text-xs ml-1">/ {fmt(effLimit)}</span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    {/* Calls */}
                    <td className="p-3 text-right text-gray-600 dark:text-white/60">{row.total_calls}</td>
                    {/* Feature bar */}
                    <td className="p-3">
                      <FeatureBar features={row.features} total={row.total_tokens} />
                    </td>
                    {/* Per-user token limit */}
                    <td className="p-3 text-center">
                      <TokenLimitCell
                        uid={row.userId}
                        initial={row.token_limit_override}
                        globalLimit={globalLimit}
                        onSaved={(next) => setUsage(prev => prev.map(r => r.userId === row.userId ? { ...r, token_limit_override: next } : r))}
                      />
                    </td>
                    {/* Image quota */}
                    <td className="p-3 text-center">
                      <QuotaCell
                        uid={row.userId}
                        initial={row.image_quota_limit}
                        onSaved={(next) => setUsage(prev => prev.map(r => r.userId === row.userId ? { ...r, image_quota_limit: next } : r))}
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Feature legend */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-white/40">
        {FEATURES.map(f => (
          <div key={f.key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${f.color}`} />
            {f.label}
          </div>
        ))}
      </div>
    </div>
  );
}
