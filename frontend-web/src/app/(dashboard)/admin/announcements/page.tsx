"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adminApi,
  type BroadcastAnnouncementOut,
  type BroadcastAudience,
  type UserOut,
} from "@/lib/api";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Send, Users, GraduationCap, BookOpen, UserCheck,
  Search, Check, X, Mail, AlertTriangle, Loader2, ChevronDown,
} from "lucide-react";
import { resolveBackendUrl } from "@/lib/utils";
import clsx from "clsx";

type AudienceOption = {
  value: BroadcastAudience;
  label: string;
  description: string;
  icon: typeof Users;
  color: string;
};

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: "all",       label: "All Users",   description: "Every student, lecturer and admin", icon: Users,         color: "from-accent-amber to-accent-pink" },
  { value: "students",  label: "Students",    description: "All accounts with role student",     icon: GraduationCap, color: "from-accent-blue to-accent-cyan" },
  { value: "lecturers", label: "Lecturers",   description: "All accounts with role lecturer",    icon: BookOpen,      color: "from-accent-purple to-accent-pink" },
  { value: "specific",  label: "Specific",    description: "Pick individual recipients",         icon: UserCheck,     color: "from-accent-emerald to-accent-cyan" },
];

const AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  all: "All Users",
  students: "Students",
  lecturers: "Lecturers",
  specific: "Specific",
};

export default function AdminAnnouncementsPage() {
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [users, setUsers] = useState<UserOut[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "lecturer" | "admin">("all");

  const [broadcasts, setBroadcasts] = useState<BroadcastAnnouncementOut[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ count: number; audience: BroadcastAudience } | null>(null);

  useEffect(() => {
    adminApi.getUsers({ limit: 200 })
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
    refreshBroadcasts();
  }, []);

  const refreshBroadcasts = () => {
    setBroadcastsLoading(true);
    adminApi.listBroadcasts(30)
      .then(setBroadcasts)
      .catch(() => setBroadcasts([]))
      .finally(() => setBroadcastsLoading(false));
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const projectedRecipientCount = useMemo(() => {
    if (audience === "all") return users.length;
    if (audience === "students") return users.filter(u => u.role === "student").length;
    if (audience === "lecturers") return users.filter(u => u.role === "lecturer").length;
    return selectedIds.size;
  }, [audience, users, selectedIds]);

  const canSubmit =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience !== "specific" || selectedIds.size > 0);

  const toggleUser = (uid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSend = async () => {
    setError("");
    setSending(true);
    try {
      const res = await adminApi.broadcastAnnouncement({
        audience,
        user_ids: audience === "specific" ? Array.from(selectedIds) : undefined,
        subject: subject.trim(),
        body: body.trim(),
      });
      setSuccess({ count: res.recipientCount, audience: res.audience });
      setSubject("");
      setBody("");
      setSelectedIds(new Set());
      setConfirmOpen(false);
      refreshBroadcasts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-accent-amber" />
            <h1 className="text-2xl font-bold text-white">Broadcast Announcements</h1>
          </div>
          <p className="text-dark-300 mt-1">
            Send an email to all users, a role group, or hand-picked recipients.
          </p>
        </div>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 border border-emerald-400/30 bg-emerald-400/5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-400/15 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Email queued for {success.count} recipient{success.count === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-dark-300">
                  Audience: {AUDIENCE_LABEL[success.audience]} · Delivery is fire-and-forget via SMTP
                </p>
              </div>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-dark-300" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="xl:col-span-2 space-y-6">
          {/* Audience picker */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
              Audience
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AUDIENCE_OPTIONS.map(opt => {
                const active = audience === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudience(opt.value)}
                    className={clsx(
                      "relative text-left p-4 rounded-2xl border transition-all",
                      active
                        ? "border-accent-amber/50 bg-white/5"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center",
                          opt.color
                        )}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{opt.label}</p>
                          <p className="text-xs text-dark-300 mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                      {active && <Check className="w-4 h-4 text-accent-amber flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Specific user picker */}
            {audience === "specific" && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="glass-input w-full pl-9 pr-3 py-2 rounded-xl text-sm"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={roleFilter}
                      onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
                      className="glass-input pl-3 pr-8 py-2 rounded-xl text-sm appearance-none cursor-pointer"
                    >
                      <option value="all">All roles</option>
                      <option value="student">Students</option>
                      <option value="lecturer">Lecturers</option>
                      <option value="admin">Admins</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-dark-300 px-1">
                  <span>{filteredUsers.length} match{filteredUsers.length === 1 ? "" : "es"}</span>
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="text-accent-amber hover:underline"
                      >
                        Clear ({selectedIds.size})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(filteredUsers.map(u => u.id)))}
                      className="text-accent-amber hover:underline"
                    >
                      Select all visible
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
                  {usersLoading ? (
                    <div className="p-6 text-center text-dark-400 text-sm">Loading users…</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-dark-400 text-sm">No users match this filter.</div>
                  ) : (
                    filteredUsers.map(u => {
                      const checked = selectedIds.has(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u.id)}
                          className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left",
                            checked ? "bg-accent-amber/5" : "hover:bg-white/5"
                          )}
                        >
                          <div className={clsx(
                            "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors",
                            checked ? "bg-accent-amber border-accent-amber" : "border-white/20"
                          )}>
                            {checked && <Check className="w-3.5 h-3.5 text-dark-900" />}
                          </div>
                          {u.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveBackendUrl(u.photo_url)} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-medium text-dark-200 flex-shrink-0">
                              {u.display_name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white truncate">{u.display_name || "Unnamed user"}</p>
                            <p className="text-xs text-dark-400 truncate">{u.email}</p>
                          </div>
                          <span className={clsx(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider flex-shrink-0",
                            u.role === "student" && "bg-accent-blue/10 text-accent-blue",
                            u.role === "lecturer" && "bg-accent-purple/10 text-accent-purple",
                            u.role === "admin" && "bg-accent-amber/10 text-accent-amber",
                          )}>
                            {u.role}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Message form */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Message</h2>
            <div>
              <label className="block text-xs text-dark-300 mb-1.5">Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={200}
                placeholder="e.g. Scheduled maintenance this Saturday"
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
              />
              <p className="text-[10px] text-dark-500 mt-1">{subject.length}/200</p>
            </div>
            <div>
              <label className="block text-xs text-dark-300 mb-1.5">Body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={10000}
                rows={8}
                placeholder="Write the announcement that will appear in the email body…"
                className="glass-input w-full px-4 py-3 rounded-xl text-sm resize-y leading-relaxed"
              />
              <p className="text-[10px] text-dark-500 mt-1">{body.length}/10000</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <p className="text-xs text-dark-300">
                Will email <span className="text-white font-semibold">{projectedRecipientCount}</span>{" "}
                recipient{projectedRecipientCount === 1 ? "" : "s"}
                {audience === "specific" && selectedIds.size === 0 && " (select users above)"}
              </p>
              <button
                type="button"
                disabled={!canSubmit || sending}
                onClick={() => setConfirmOpen(true)}
                className={clsx(
                  "btn-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity",
                  (!canSubmit || sending) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
                Review &amp; Send
              </button>
            </div>
          </div>
        </div>

        {/* Recent broadcasts */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-accent-amber" />
            <h2 className="text-lg font-semibold text-white">Recent Broadcasts</h2>
          </div>
          {broadcastsLoading ? (
            <div className="flex items-center justify-center py-10 text-dark-400 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
            </div>
          ) : broadcasts.length === 0 ? (
            <p className="text-dark-400 text-sm">No broadcasts sent yet.</p>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {broadcasts.map(b => (
                <div key={b.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber font-semibold">
                      {AUDIENCE_LABEL[b.audience]}
                    </span>
                    <span className="text-[10px] text-dark-500">
                      {new Date(b.createdAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{b.subject}</p>
                  <p className="text-xs text-dark-400 mt-1 line-clamp-2">{b.body}</p>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-dark-400">
                    <span>{b.recipientCount} recipient{b.recipientCount === 1 ? "" : "s"}</span>
                    <span className="truncate ml-2 max-w-[60%] text-right">by {b.sentByName || b.sentByEmail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      <Modal open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)} title="Send broadcast email?" maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-100/90">
              You&apos;re about to email{" "}
              <span className="font-semibold">{projectedRecipientCount}</span> recipient{projectedRecipientCount === 1 ? "" : "s"}
              {" "}({AUDIENCE_LABEL[audience]}). This action cannot be undone.
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-dark-400 mb-1">Subject</p>
            <p className="text-sm text-white font-medium">{subject}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-dark-400 mb-1">Body</p>
            <p className="text-sm text-dark-200 whitespace-pre-wrap max-h-48 overflow-y-auto">{body}</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-sm text-dark-200 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={clsx(
                "btn-gradient inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold",
                sending && "opacity-60 cursor-wait"
              )}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : "Send Now"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
