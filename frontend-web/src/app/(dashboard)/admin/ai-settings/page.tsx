"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type AiSettingsOut } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ZapOff, Check, AlertTriangle, Loader2, Save,
  MessageCircle, Brain, BookOpen, CalendarDays, GraduationCap,
  ShieldAlert, FileDown, Image as ImageIcon, Bot,
} from "lucide-react";
import clsx from "clsx";

// Friendly metadata for each AI feature key.
// Keep in sync with AI_FEATURES in backend/app/ai_service.py.
type FeatureMeta = {
  key: string;
  label: string;
  description: string;
  icon: typeof Bot;
  group: "Student" | "Lecturer" | "Shared";
};

const FEATURE_META: FeatureMeta[] = [
  { key: "companion",       label: "Study Companion",     description: "SmartBuddy chat — answers questions, offers encouragement, summarises material.",           icon: MessageCircle,  group: "Student" },
  { key: "mindmap_buddy",   label: "Mind Map Buddy",      description: "AI helper inside the mind-map editor — suggests nodes, explains concepts, expands branches.", icon: Brain,          group: "Student" },
  { key: "study_materials", label: "Study Materials",     description: "Generates summaries, flashcards and practice questions from notes or slides.",              icon: BookOpen,       group: "Student" },
  { key: "study_plan",      label: "Study Plan",          description: "Builds personalised study plans from grades, deadlines and the exam schedule.",              icon: CalendarDays,   group: "Student" },
  { key: "grading",         label: "AI Grading",          description: "Suggests rubric-based grades for student submissions.",                                       icon: GraduationCap,  group: "Lecturer" },
  { key: "plagiarism",      label: "Plagiarism Check",    description: "Estimates likelihood that a submission is AI-generated or plagiarised.",                      icon: ShieldAlert,    group: "Lecturer" },
  { key: "import",          label: "Course Import",       description: "Parses scraped course pages into structured modules + resources.",                            icon: FileDown,       group: "Lecturer" },
  { key: "images",          label: "AI Images",           description: "Generates cover art / illustrations using Gemini image models.",                              icon: ImageIcon,      group: "Shared" },
];

const GROUPS: FeatureMeta["group"][] = ["Student", "Lecturer", "Shared"];

export default function AdminAiSettingsPage() {
  const [settings, setSettings] = useState<AiSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  // The backend stores a *deny list*. We mirror that shape on the client so
  // the per-feature checkbox state maps directly: checked = enabled, unchecked
  // = disabled.
  const [disabledFeatures, setDisabledFeatures] = useState<Set<string>>(new Set());

  useEffect(() => {
    adminApi.getAiSettings()
      .then(s => {
        setSettings(s);
        setAiEnabled(s.ai_enabled);
        setDisabledFeatures(new Set(s.disabled_features));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => {
    if (!settings) return false;
    if (settings.ai_enabled !== aiEnabled) return true;
    const a = new Set(settings.disabled_features);
    if (a.size !== disabledFeatures.size) return true;
    for (const t of disabledFeatures) if (!a.has(t)) return true;
    return false;
  }, [settings, aiEnabled, disabledFeatures]);

  const toggleFeature = (key: string) => {
    setDisabledFeatures(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setAll = (enable: boolean) => {
    if (!settings) return;
    setDisabledFeatures(enable ? new Set() : new Set(settings.all_features));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await adminApi.updateAiSettings({
        ai_enabled: aiEnabled,
        disabled_features: Array.from(disabledFeatures),
      });
      setSettings(updated);
      setAiEnabled(updated.ai_enabled);
      setDisabledFeatures(new Set(updated.disabled_features));
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const visibleFeatures = useMemo(
    () => (settings ? settings.all_features : FEATURE_META.map(f => f.key)),
    [settings],
  );

  const grouped = useMemo(() => {
    const meta = new Map(FEATURE_META.map(m => [m.key, m]));
    const buckets: Record<FeatureMeta["group"], FeatureMeta[]> = {
      Student: [], Lecturer: [], Shared: [],
    };
    for (const k of visibleFeatures) {
      const m = meta.get(k);
      if (m) buckets[m.group].push(m);
      else buckets.Shared.push({
        key: k, label: k, description: "Custom AI feature.",
        icon: Bot, group: "Shared",
      });
    }
    return buckets;
  }, [visibleFeatures]);

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-dark-300 text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading AI settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent-purple" />
            <h1 className="text-2xl font-bold text-white">AI Features</h1>
          </div>
          <p className="text-dark-300 mt-1 text-sm">
            Master switch for every Gemini-powered feature. When off, all AI
            endpoints return <code className="text-accent-purple">503</code> and
            no calls are made to Google&rsquo;s API — useful for cost cutoffs,
            outages or compliance freezes.
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
                aiEnabled ? "bg-emerald-400/15" : "bg-red-500/15",
              )}
            >
              {aiEnabled
                ? <Sparkles className="w-6 h-6 text-emerald-300" />
                : <ZapOff   className="w-6 h-6 text-red-300" />}
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                AI {aiEnabled ? "Enabled" : "Disabled"}
              </p>
              <p className="text-xs text-dark-300 mt-1 max-w-lg">
                Gates the central <code className="text-accent-purple">ai_service</code>{" "}
                module. Affects companion chat, study materials, grading, plagiarism,
                study plans, course import, RAG retrieval, knowledge graph, GAG and
                image generation. Non-AI features are unaffected.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={aiEnabled}
            onClick={() => setAiEnabled(v => !v)}
            className={clsx(
              "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              aiEnabled ? "bg-emerald-500/80" : "bg-dark-700",
            )}
          >
            <span
              className={clsx(
                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                aiEnabled ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {!aiEnabled && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Master switch is OFF. The per-feature toggles below are kept for
              reference but ignored — no Gemini calls will be made until the
              master switch is turned back on.
            </span>
          </div>
        )}
      </div>

      {/* Per-feature kill list */}
      <div className={clsx("glass-card p-6 transition-opacity", !aiEnabled && "opacity-50")}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">
              Per-Feature Toggles
            </h2>
            <p className="text-xs text-dark-400 mt-1">
              Disable individual features without killing the master switch.
              Unchecked = disabled (returns 503 for that feature only).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="px-2.5 py-1 rounded-md text-accent-purple hover:bg-white/5 transition-colors"
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
                  {items.map(f => {
                    const Icon = f.icon;
                    const enabledForFeature = !disabledFeatures.has(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => toggleFeature(f.key)}
                        disabled={!aiEnabled}
                        className={clsx(
                          "flex items-start gap-3 p-3 rounded-xl border text-left transition-colors",
                          enabledForFeature
                            ? "border-accent-purple/40 bg-accent-purple/5"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/5",
                          !aiEnabled && "cursor-not-allowed",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                            enabledForFeature ? "bg-accent-purple border-accent-purple" : "border-white/20",
                          )}
                        >
                          {enabledForFeature && <Check className="w-3.5 h-3.5 text-dark-900" />}
                        </div>
                        <Icon className="w-4 h-4 mt-1 text-dark-200 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          {/*
                            text-dark-100 (not text-white) — globals.css has a
                            greedy `html.light [class*="bg-accent"] .text-white`
                            !important rule that matches `bg-accent-purple/5` on
                            this button and forces white-on-white in light mode.
                          */}
                          <p className="text-sm font-medium text-dark-100">{f.label}</p>
                          <p className="text-xs text-dark-400 mt-0.5">{f.description}</p>
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
