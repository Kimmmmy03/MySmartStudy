"use client";

import { useState, useEffect } from "react";
import { adminApi, type UserOut, type AuditLogOut } from "@/lib/api";
import { motion } from "framer-motion";
import { Shield, Users, ScrollText, Activity, User } from "lucide-react";
import { resolveBackendUrl } from "@/lib/utils";

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.getUsers({ limit: 200 }),
      adminApi.getAuditLogs({ limit: 10 }),
    ])
      .then(([u, logs]) => {
        setUsers(u);
        setRecentLogs(logs);
      })
      .finally(() => setLoading(false));
  }, []);

  const studentCount = users.filter((u) => u.role === "student").length;
  const lecturerCount = users.filter((u) => u.role === "lecturer").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  const stats = [
    { label: "Total Users", value: users.length, icon: Users, color: "from-accent-blue to-accent-cyan" },
    { label: "Students", value: studentCount, icon: Activity, color: "from-accent-blue to-accent-purple" },
    { label: "Lecturers", value: lecturerCount, icon: Shield, color: "from-accent-purple to-accent-pink" },
    { label: "Admins", value: adminCount, icon: Shield, color: "from-accent-amber to-accent-pink" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-dark-300 mt-1">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-300">{s.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Audit Logs */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ScrollText className="w-5 h-5 text-accent-purple" />
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-dark-400 text-sm">No audit logs yet.</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.02] border-b border-white/5 last:border-0 transition-colors">
                {/* User avatar */}
                {log.userPhoto ? (
                  <img src={resolveBackendUrl(log.userPhoto)} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-accent-purple" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-medium">{log.userName || log.userEmail || log.userId.slice(0, 8)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      log.action === "delete" ? "bg-red-500/10 text-red-400" :
                      log.action === "create" ? "bg-emerald-500/10 text-emerald-400" :
                      "bg-accent-blue/10 text-accent-blue"
                    }`}>{log.action}</span>
                    <span className="text-xs text-dark-400">{log.resourceType}</span>
                  </div>
                  {log.details && <p className="text-xs text-dark-500 mt-0.5 truncate">{log.details}</p>}
                </div>
                <span className="text-[10px] text-dark-500 flex-shrink-0 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
