"use client";

import { useState, useEffect } from "react";
import { adminApi, type AuditLogOut } from "@/lib/api";
import { resolveBackendUrl } from "@/lib/utils";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  ScrollText, Search, X, User, Clock, Filter,
  Trash2, PlusCircle, Pencil, Eye, Shield,
  GraduationCap, BookOpen, ChevronDown,
} from "lucide-react";

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: typeof PlusCircle }> = {
  create: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: PlusCircle },
  update: { bg: "bg-accent-blue/10", text: "text-accent-blue", icon: Pencil },
  delete: { bg: "bg-red-500/10", text: "text-red-400", icon: Trash2 },
  view: { bg: "bg-accent-cyan/10", text: "text-accent-cyan", icon: Eye },
};

const ROLE_COLORS: Record<string, string> = {
  student: "text-accent-blue",
  lecturer: "text-accent-pink",
  admin: "text-accent-amber",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  student: GraduationCap,
  lecturer: BookOpen,
  admin: Shield,
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    adminApi
      .getAuditLogs({ limit: 100, resource_type: resourceFilter || undefined })
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [resourceFilter]);

  const filtered = logs.filter((l) => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.userId.toLowerCase().includes(q) ||
      (l.userName || "").toLowerCase().includes(q) ||
      (l.userEmail || "").toLowerCase().includes(q) ||
      l.resourceType.toLowerCase().includes(q)
    );
  });

  const resourceTypes = [...new Set(logs.map((l) => l.resourceType))].sort();
  const actionTypes = [...new Set(logs.map((l) => l.action))].sort();

  // Group logs by date
  const groupedByDate: Record<string, AuditLogOut[]> = {};
  filtered.forEach((log) => {
    const dateKey = new Date(log.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(log);
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
            <p className="text-sm text-dark-300">Track all system actions and user activity</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <Clock className="w-3.5 h-3.5" />
          {logs.length} total entries
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              placeholder="Search by user, action, resource, or details..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="glass-input pl-10 py-3 text-sm w-full"
            />
            {filter && (
              <button onClick={() => setFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action filter */}
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="glass-input px-4 py-3 text-sm pr-8 appearance-none cursor-pointer bg-transparent"
            >
              <option value="" className="bg-dark-800">All Actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a} className="bg-dark-800">{a}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500 pointer-events-none" />
          </div>

          {/* Resource filter */}
          <div className="relative">
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="glass-input px-4 py-3 text-sm pr-8 appearance-none cursor-pointer bg-transparent"
            >
              <option value="" className="bg-dark-800">All Resources</option>
              {resourceTypes.map((rt) => (
                <option key={rt} value={rt} className="bg-dark-800">{rt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500 pointer-events-none" />
          </div>
        </div>

        {/* Active filter pills */}
        {(filter || actionFilter || resourceFilter) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
            <Filter className="w-3 h-3 text-dark-500" />
            {filter && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs text-dark-300">
                &quot;{filter}&quot;
                <button onClick={() => setFilter("")}><X className="w-3 h-3 text-dark-500 hover:text-white" /></button>
              </span>
            )}
            {actionFilter && (
              <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs", ACTION_STYLES[actionFilter]?.bg || "bg-white/5", ACTION_STYLES[actionFilter]?.text || "text-dark-300")}>
                {actionFilter}
                <button onClick={() => setActionFilter("")}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            {resourceFilter && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-purple/10 text-xs text-accent-purple">
                {resourceFilter}
                <button onClick={() => setResourceFilter("")}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            <button onClick={() => { setFilter(""); setActionFilter(""); setResourceFilter(""); }}
              className="text-[10px] text-dark-500 hover:text-dark-300 ml-auto">Clear all</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <ScrollText className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400 font-medium">No audit logs found</p>
          <p className="text-xs text-dark-500 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dateLogs]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-dark-400">{date}</span>
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-dark-500">{dateLogs.length} {dateLogs.length === 1 ? "event" : "events"}</span>
              </div>

              {/* Log entries */}
              <div className="space-y-2">
                {dateLogs.map((log, i) => {
                  const style = ACTION_STYLES[log.action] || ACTION_STYLES.view!;
                  const ActionIcon = style.icon;
                  const RoleIcon = ROLE_ICONS[log.userRole || ""] || User;

                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="glass-card p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Action icon */}
                      <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", style.bg)}>
                        <ActionIcon className={clsx("w-4 h-4", style.text)} />
                      </div>

                      {/* User info */}
                      <div className="flex items-center gap-2.5 w-48 flex-shrink-0">
                        {log.userPhoto ? (
                          <img src={resolveBackendUrl(log.userPhoto)} alt="" className="w-7 h-7 rounded-lg object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                            <RoleIcon className={clsx("w-3.5 h-3.5", ROLE_COLORS[log.userRole || ""] || "text-dark-400")} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{log.userName || "Unknown"}</p>
                          <p className="text-[10px] text-dark-500 truncate">{log.userEmail || log.userId.slice(0, 12)}</p>
                        </div>
                      </div>

                      {/* Action + Resource */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={clsx("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide", style.bg, style.text)}>
                            {log.action}
                          </span>
                          <span className="text-sm text-dark-200">{log.resourceType}</span>
                        </div>
                        {log.details && (
                          <p className="text-xs text-dark-400 mt-0.5 truncate">{log.details}</p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-dark-400">
                          {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result count */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs text-dark-500">
          Showing {filtered.length} of {logs.length} log entries
        </p>
      )}
    </motion.div>
  );
}
