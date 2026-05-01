"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type EmailSettingsOut } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, MailX, Check, AlertTriangle, Loader2, Save,
  Megaphone, Bell, Users, BookOpen, Eye, MessageSquare,
  Heart, UserPlus, Sparkles,
} from "lucide-react";
import clsx from "clsx";

// Friendly metadata for each notification type emitted by the backend.
// Keep in sync with EMAIL_NOTIFICATION_TYPES in backend/app/routers/notifications.py.
type TypeMeta = {
  key: string;
  label: string;
  description: string;
  icon: typeof Bell;
  group: "Course" | "Mind Maps" | "Social" | "Other";
};

const TYPE_META: TypeMeta[] = [
  { key: "assignment",   label: "Assignments",       description: "Sent when a lecturer creates a new assignment in a course you're enrolled in.", icon: BookOpen,       group: "Course" },
  { key: "announcement", label: "Announcements",     description: "Sent when a lecturer posts a course announcement.",                              icon: Megaphone,      group: "Course" },
  { key: "collaboration", label: "Map Collaboration", description: "Sent when someone invites you to collaborate on a mind map.",                   icon: Users,          group: "Mind Maps" },
  { key: "map_posted",   label: "New Public Map",    description: "Sent to followers when someone you follow publishes a new public map.",          icon: Sparkles,       group: "Mind Maps" },
  { key: "map_view",     label: "Map Views",         description: "Sent when a lecturer views one of your maps. Noisy — opt-in only.",              icon: Eye,            group: "Mind Maps" },
  { key: "map_like",     label: "Map Likes",         description: "Sent when someone likes one of your public maps.",                               icon: Heart,          group: "Mind Maps" },
  { key: "map_comment",  label: "Map Comments",      description: "Sent when someone comments on one of your public maps.",                         icon: MessageSquare,  group: "Mind Maps" },
  { key: "new_follower", label: "New Follower",      description: "Sent when another user follows your profile.",                                   icon: UserPlus,       group: "Social" },
  { key: "info",         label: "General",           description: "Catch-all for system notifications that don't fit a specific category.",         icon: Bell,           group: "Other" },
];

const GROUPS: TypeMeta["group"][] = ["Course", "Mind Maps", "Social", "Other"];

export default function AdminEmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [smtpEnabled, setSmtpEnabled] = useState(true);
  const [allowedTypes, setAllowedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    adminApi.getEmailSettings()
      .then(s => {
        setSettings(s);
        setSmtpEnabled(s.smtp_enabled);
        setAllowedTypes(new Set(s.allowed_types));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => {
    if (!settings) return false;
    if (settings.smtp_enabled !== smtpEnabled) return true;
    const a = new Set(settings.allowed_types);
    if (a.size !== allowedTypes.size) return true;
    for (const t of allowedTypes) if (!a.has(t)) return true;
    return false;
  }, [settings, smtpEnabled, allowedTypes]);

  const toggleType = (key: string) => {
    setAllowedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setAll = (on: boolean) => {
    if (!settings) return;
    setAllowedTypes(on ? new Set(settings.all_types) : new Set());
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await adminApi.updateEmailSettings({
        smtp_enabled: smtpEnabled,
        allowed_types: Array.from(allowedTypes),
      });
      setSettings(updated);
      setSmtpEnabled(updated.smtp_enabled);
      setAllowedTypes(new Set(updated.allowed_types));
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const visibleTypes = useMemo(
    () => (settings ? settings.all_types : TYPE_META.map(t => t.key)),
    [settings],
  );

  const grouped = useMemo(() => {
    const meta = new Map(TYPE_META.map(m => [m.key, m]));
    const buckets: Record<TypeMeta["group"], TypeMeta[]> = {
      Course: [], "Mind Maps": [], Social: [], Other: [],
    };
    for (const k of visibleTypes) {
      const m = meta.get(k);
      if (m) buckets[m.group].push(m);
      else buckets.Other.push({
        key: k, label: k, description: "Custom notification type.",
        icon: Bell, group: "Other",
      });
    }
    return buckets;
  }, [visibleTypes]);

  // Auto-clear "saved" badge after 2.5s
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-dark-300 text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading email settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-accent-amber" />
            <h1 className="text-2xl font-bold text-white">Email Notifications</h1>
          </div>
          <p className="text-dark-300 mt-1 text-sm">
            Master switch for transactional SMTP emails sent by{" "}
            <code className="text-accent-amber">create_notification()</code>. Per-user
            preferences and admin broadcasts are unaffected.
          </p>
        </div>
        <AnimatePresence>
          {savedAt && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs"
            >
              <Check className="w-3.5 h-3.5" /> Saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Master switch */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={clsx(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                smtpEnabled ? "bg-emerald-400/15" : "bg-red-500/15",
              )}
            >
              {smtpEnabled
                ? <Mail  className="w-6 h-6 text-emerald-300" />
                : <MailX className="w-6 h-6 text-red-300" />}
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                SMTP {smtpEnabled ? "Enabled" : "Disabled"}
              </p>
              <p className="text-xs text-dark-300 mt-1 max-w-lg">
                When off, no transactional emails are sent. The in-app notifications
                continue to work normally.
              </p>
            </div>
          </div>

          {/* Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={smtpEnabled}
            onClick={() => setSmtpEnabled(v => !v)}
            className={clsx(
              "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              smtpEnabled ? "bg-emerald-500/80" : "bg-dark-700",
            )}
          >
            <span
              className={clsx(
                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                smtpEnabled ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>
      </div>

      {/* Type allow-list */}
      <div className={clsx("glass-card p-6 transition-opacity", !smtpEnabled && "opacity-50")}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">
              Notification Types
            </h2>
            <p className="text-xs text-dark-400 mt-1">
              Pick which kinds of notifications generate an email. Unchecked types
              still appear in-app.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="px-2.5 py-1 rounded-md text-accent-amber hover:bg-white/5 transition-colors"
            >
              Enable all
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="px-2.5 py-1 rounded-md text-dark-300 hover:bg-white/5 transition-colors"
            >
              Disable all
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {GROUPS.map(g => {
            const items = grouped[g];
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <p className="text-[10px] uppercase tracking-wider text-dark-400 mb-2">
                  {g}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map(t => {
                    const Icon = t.icon;
                    const checked = allowedTypes.has(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleType(t.key)}
                        disabled={!smtpEnabled}
                        className={clsx(
                          "flex items-start gap-3 p-3 rounded-xl border text-left transition-colors",
                          checked
                            ? "border-accent-amber/40 bg-accent-amber/5"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/5",
                          !smtpEnabled && "cursor-not-allowed",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                            checked ? "bg-accent-amber border-accent-amber" : "border-white/20",
                          )}
                        >
                          {checked && <Check className="w-3.5 h-3.5 text-dark-900" />}
                        </div>
                        <Icon className="w-4 h-4 mt-1 text-dark-200 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">{t.label}</p>
                          <p className="text-xs text-dark-400 mt-0.5">{t.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / save bar */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-dark-400">
          {settings?.updated_at
            ? <>Last updated {new Date(settings.updated_at).toLocaleString()}{settings.updated_by && <> by <span className="text-dark-200">{settings.updated_by}</span></>}</>
            : <>No saved settings yet — defaults are in effect.</>}
        </div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className={clsx(
            "btn-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity",
            (!dirty || saving) && "opacity-50 cursor-not-allowed",
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
