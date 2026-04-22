"use client";

import { useState, useEffect } from "react";
import { adminApi, type UserOut } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Shield, GraduationCap, BookOpen, ChevronDown,
  Flame, Coins, Calendar, Mail, Building2, Hash, X,
  ChevronLeft, ChevronRight, UserCog, Award, Check, Image,
  Trash2, AlertTriangle, Loader2,
} from "lucide-react";
import { resolveBackendUrl } from "@/lib/utils";
import clsx from "clsx";
import BadgeIcon from "@/components/badge-icon";

const ROLE_COLORS: Record<string, string> = {
  student: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  lecturer: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  admin: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  student: GraduationCap,
  lecturer: BookOpen,
  admin: Shield,
};

const ROLE_BG: Record<string, string> = {
  student: "from-accent-blue/20 to-accent-blue/5",
  lecturer: "from-accent-purple/20 to-accent-purple/5",
  admin: "from-accent-amber/20 to-accent-amber/5",
};

const ITEMS_PER_PAGE = 12;
const DEFAULT_IMG_LIMIT = 2;

function QuotaCell({ uid, initial, onSaved }: { uid: string; initial: number | null; onSaved: (uid: string, val: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial !== null ? String(initial) : "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.MouseEvent) {
    e.stopPropagation();
    setSaving(true);
    try {
      const parsed = value.trim() === "" ? null : parseInt(value, 10);
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
      await adminApi.setUserImageQuota(uid, parsed);
      onSaved(uid, parsed);
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
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
      >
        <Image className="w-3 h-3" />
        {initial !== null ? `${initial}/day` : `Default (${DEFAULT_IMG_LIMIT}/day)`}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={String(DEFAULT_IMG_LIMIT)}
        className="glass-input w-14 text-xs px-2 py-1 rounded"
        autoFocus
        onKeyDown={e => { if (e.key === "Enter") save(e as unknown as React.MouseEvent); if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="text-accent-emerald hover:opacity-80 transition-opacity">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="text-white/40 hover:text-white/80 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [quotaMap, setQuotaMap] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [roleConfirm, setRoleConfirm] = useState<{ user: UserOut; newRole: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminApi.getUsers({ limit: 200, role: roleFilter || undefined }),
      adminApi.getAiUsage({ limit: 200 }).catch(() => null),
    ]).then(([usersData, usageData]) => {
      setUsers(usersData);
      if (usageData) {
        const map: Record<string, number | null> = {};
        for (const rec of usageData.usage) {
          map[rec.userId] = rec.image_quota_limit;
        }
        setQuotaMap(map);
      }
    }).finally(() => setLoading(false));
  }, [roleFilter]);

  const handleQuotaSaved = (uid: string, val: number | null) => {
    setQuotaMap(prev => ({ ...prev, [uid]: val }));
  };

  // Reset page when search/filter changes
  useEffect(() => { setPage(1); }, [search, roleFilter]);

  const filtered = search
    ? users.filter(
        (u) =>
          u.display_name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.department || "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Stats
  const totalStudents = users.filter(u => u.role === "student").length;
  const totalLecturers = users.filter(u => u.role === "lecturer").length;
  const totalAdmins = users.filter(u => u.role === "admin").length;
  const avgPoints = users.length > 0 ? Math.round(users.reduce((s, u) => s + u.points, 0) / users.length) : 0;

  const requestRoleChange = (user: UserOut, newRole: string) => {
    if (user.role === newRole) return;
    setRoleConfirm({ user, newRole });
  };

  const confirmRoleChange = async () => {
    if (!roleConfirm) return;
    const { user, newRole } = roleConfirm;
    setChangingRole(user.id);
    setRoleConfirm(null);
    try {
      await adminApi.updateUserRole(user.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
    setChangingRole(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const uid = deleteConfirm.id;
    setDeleting(true);
    try {
      await adminApi.deleteUser(uid);
      setUsers((prev) => prev.filter((u) => u.id !== uid));
      setDeleteConfirm(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
          >
            <Users className="w-5 h-5 text-accent-purple" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="text-sm text-gray-500 dark:text-dark-300">Manage all platform users and roles</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-accent-purple", bg: "bg-accent-purple/10" },
          { label: "Students", value: totalStudents, icon: GraduationCap, color: "text-accent-blue", bg: "bg-accent-blue/10" },
          { label: "Lecturers", value: totalLecturers, icon: BookOpen, color: "text-accent-pink", bg: "bg-accent-pink/10" },
          { label: "Admins", value: totalAdmins, icon: Shield, color: "text-accent-amber", bg: "bg-accent-amber/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.03, y: -2 }}
            className="glass-card p-4 flex items-center gap-4"
          >
            <motion.div
              className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 + i }}
            >
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </motion.div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-400" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input pl-10 w-full py-3 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-400 hover:text-gray-600 dark:hover:text-dark-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role filter pills */}
        <div className="flex items-center gap-1.5">
          {[
            { value: "", label: "All", icon: Users },
            { value: "student", label: "Students", icon: GraduationCap },
            { value: "lecturer", label: "Lecturers", icon: BookOpen },
            { value: "admin", label: "Admins", icon: Shield },
          ].map(r => (
            <button
              key={r.value}
              onClick={() => { setRoleFilter(r.value); setLoading(true); }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                roleFilter === r.value
                  ? "btn-gradient text-white shadow-md"
                  : "bg-white/5 text-gray-500 dark:text-dark-400 hover:bg-white/10 hover:text-gray-700 dark:hover:text-dark-200"
              )}
            >
              <r.icon className="w-3.5 h-3.5" />
              {r.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              viewMode === "grid" ? "bg-accent-purple/20 text-accent-purple" : "text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200")}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              viewMode === "table" ? "bg-accent-purple/20 text-accent-purple" : "text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200")}
          >
            Table
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
        <span>Showing {paginated.length} of {filtered.length} users</span>
        {search && <span>{filtered.length} results for &quot;{search}&quot;</span>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-dark-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-dark-400 font-medium">No users found</p>
          <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {paginated.map((user, i) => {
              const RoleIcon = ROLE_ICONS[user.role] || Shield;
              const isExpanded = expandedUser === user.id;
              return (
                <motion.div
                  key={user.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, type: "spring", damping: 20 }}
                  whileHover={{ y: -2 }}
                  className="glass-card overflow-hidden cursor-pointer group"
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                >
                  {/* Gradient header */}
                  <div className={`h-16 bg-gradient-to-r ${ROLE_BG[user.role] || "from-white/5 to-white/0"} relative`}>
                    <div className="absolute -bottom-6 left-4">
                      <img
                        src={resolveBackendUrl(user.photo_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=6366f1&color=fff&size=64`}
                        alt=""
                        className="w-12 h-12 rounded-xl border-2 border-white/10 shadow-lg object-cover"
                      />
                    </div>
                  </div>

                  <div className="pt-8 px-4 pb-4">
                    {/* Name + Role */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.display_name}</h3>
                        <p className="text-xs text-gray-500 dark:text-dark-400 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 flex-shrink-0" /> {user.email}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_COLORS[user.role] || ""}`}>
                        <RoleIcon className="w-3 h-3" />
                        {user.role}
                      </span>
                    </div>

                    {/* Quick stats row */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-dark-400">
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3 text-accent-amber" /> {user.points}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-accent-pink" /> {user.streak}d
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-accent-purple" /> {user.badges?.length || 0}
                      </span>
                      {user.department && (
                        <span className="flex items-center gap-1 truncate ml-auto">
                          <Building2 className="w-3 h-3 flex-shrink-0" /> {user.department}
                        </span>
                      )}
                    </div>

                    {/* Badges preview */}
                    {user.badges && user.badges.length > 0 && (
                      <div className="flex items-center gap-1 mt-2.5 overflow-hidden">
                        {user.badges.slice(0, 5).map(b => (
                          <div key={b} className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center" title={b}>
                            <BadgeIcon icon={b} size={14} colored />
                          </div>
                        ))}
                        {user.badges.length > 5 && (
                          <span className="text-[10px] text-gray-400 dark:text-dark-500 ml-1">+{user.badges.length - 5}</span>
                        )}
                      </div>
                    )}

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", damping: 20, stiffness: 200 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 mt-3 border-t border-white/5 space-y-3">
                            {/* Extra info */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {user.class_name && (
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-dark-400">
                                  <Hash className="w-3 h-3" /> Class: {user.class_name}
                                </div>
                              )}
                              {user.year && (
                                <div className="flex items-center gap-1.5 text-gray-500 dark:text-dark-400">
                                  <Calendar className="w-3 h-3" /> Year {user.year}, Sem {user.semester}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-gray-500 dark:text-dark-400 col-span-2">
                                <Calendar className="w-3 h-3" /> Joined {new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </div>
                            </div>

                            {/* Role changer */}
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wide mb-1 block flex items-center gap-1">
                                <UserCog className="w-3 h-3" /> Change Role
                              </label>
                              <div className="flex items-center gap-1.5">
                                {["student", "lecturer", "admin"].map(role => {
                                  const Icon = ROLE_ICONS[role] || Shield;
                                  const isActive = user.role === role;
                                  return (
                                    <button
                                      key={role}
                                      onClick={(e) => { e.stopPropagation(); if (!isActive) requestRoleChange(user, role); }}
                                      disabled={changingRole === user.id}
                                      className={clsx(
                                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                        isActive
                                          ? `${ROLE_COLORS[role]} border`
                                          : "bg-white/5 text-gray-400 dark:text-dark-500 hover:bg-white/10 hover:text-gray-600 dark:hover:text-dark-300"
                                      )}
                                    >
                                      <Icon className="w-3 h-3" />
                                      {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </button>
                                  );
                                })}
                                {changingRole === user.id && (
                                  <div className="w-4 h-4 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
                                )}
                              </div>
                            </div>

                            {/* Image quota */}
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wide mb-1 block flex items-center gap-1">
                                <Image className="w-3 h-3" /> Image Quota
                              </label>
                              <QuotaCell uid={user.id} initial={quotaMap[user.id] ?? null} onSaved={handleQuotaSaved} />
                            </div>

                            {/* Delete account */}
                            <div className="pt-2 border-t border-white/5">
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(user); }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete Account
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* Table View */
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">User</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Email</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Role</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Department</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Points</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Streak</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Badges</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Joined</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Img Quota</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Role Change</th>
                  <th className="text-left p-4 text-gray-500 dark:text-dark-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((user, i) => {
                  const RoleIcon = ROLE_ICONS[user.role] || Shield;
                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveBackendUrl(user.photo_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=6366f1&color=fff&size=32`}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                          <span className="text-gray-900 dark:text-white font-medium">{user.display_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 dark:text-dark-300 text-xs">{user.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_COLORS[user.role] || ""}`}>
                          <RoleIcon className="w-3 h-3" />
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 dark:text-dark-400 text-xs">{user.department || "—"}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-gray-600 dark:text-dark-200 text-xs">
                          <Coins className="w-3 h-3 text-accent-amber" /> {user.points}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-gray-600 dark:text-dark-200 text-xs">
                          <Flame className="w-3 h-3 text-accent-pink" /> {user.streak}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-0.5">
                          {(user.badges || []).slice(0, 3).map(b => (
                            <div key={b} className="w-5 h-5 rounded bg-white/5 flex items-center justify-center">
                              <BadgeIcon icon={b} size={12} colored />
                            </div>
                          ))}
                          {(user.badges || []).length > 3 && (
                            <span className="text-[10px] text-gray-400 dark:text-dark-500 ml-0.5">+{user.badges.length - 3}</span>
                          )}
                          {(!user.badges || user.badges.length === 0) && <span className="text-[10px] text-gray-400 dark:text-dark-500">—</span>}
                        </div>
                      </td>
                      <td className="p-4 text-gray-400 dark:text-dark-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                      <td className="p-4">
                        <QuotaCell uid={user.id} initial={quotaMap[user.id] ?? null} onSaved={handleQuotaSaved} />
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <select
                            value={user.role}
                            onChange={(e) => requestRoleChange(user, e.target.value)}
                            disabled={changingRole === user.id}
                            className="glass-input text-xs px-2 py-1 pr-6 appearance-none cursor-pointer bg-transparent"
                          >
                            <option value="student" className="bg-dark-800">Student</option>
                            <option value="lecturer" className="bg-dark-800">Lecturer</option>
                            <option value="admin" className="bg-dark-800">Admin</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-dark-500 pointer-events-none" />
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setDeleteConfirm(user)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-1">
                  {showEllipsis && <span className="text-gray-500 dark:text-dark-500 px-1">...</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={clsx(
                      "w-8 h-8 rounded-lg text-xs font-medium transition-all",
                      page === p
                        ? "btn-gradient text-white shadow-md"
                        : "text-gray-500 dark:text-dark-400 hover:bg-white/5"
                    )}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg text-gray-400 dark:text-dark-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Role change confirmation modal */}
      <AnimatePresence>
        {roleConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setRoleConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              className="glass-card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-accent-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Change user role?</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-300 mt-1">
                    Change <span className="font-medium text-gray-700 dark:text-white">{roleConfirm.user.display_name}</span>&apos;s role from{" "}
                    <span className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border", ROLE_COLORS[roleConfirm.user.role])}>
                      {roleConfirm.user.role}
                    </span>{" "}
                    to{" "}
                    <span className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border", ROLE_COLORS[roleConfirm.newRole])}>
                      {roleConfirm.newRole}
                    </span>
                    ?
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setRoleConfirm(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRoleChange}
                  className="btn-gradient px-4 py-2 rounded-lg text-sm font-medium text-white shadow-md"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              className="glass-card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete this account?</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-300 mt-1">
                    Permanently delete <span className="font-medium text-gray-700 dark:text-white">{deleteConfirm.display_name}</span>&apos;s account
                    (<span className="text-gray-400 dark:text-dark-400">{deleteConfirm.email}</span>)?
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
