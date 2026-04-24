"use client";

import { useState, useEffect, useRef } from "react";
import { coursesApi, aiImportApi, siteImportApi, CourseOut, ImportModule, SiteImportPreview, SiteImportResult } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Copy, Check, Pencil, Trash2, FolderOpen, Users,
  Globe, Loader2, Sparkles, X, ChevronDown, ChevronRight,
  CopyPlus, BookOpen, FileText, Video, Link2,
  AlertTriangle, CheckCircle2, ExternalLink, Download,
  Search, Brain, FolderInput, LayoutGrid, ClipboardList,
  UserCheck, Zap, Database, Eye, Layers,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { COURSE_NAMES, COURSE_CODES } from "@/lib/constants";
import { getPatternStyle, getPatternLayerStyle, PATTERN_LIST } from "@/lib/patterns";
import { semesterLabel } from "@/lib/utils";

type ImportStep = "url" | "scanning" | "preview" | "importing" | "success";

const FALLBACK_PATTERNS = ["songket", "batik", "pucuk_rebung", "ipg_education"];

const CLASS_COLORS = [
  { id: "blue",    label: "Blue",    bg: "from-blue-400/30 to-blue-600/20 dark:from-blue-500/20 dark:to-indigo-900/20",         border: "border-blue-300/30 dark:border-blue-400/20",     text: "text-blue-600 dark:text-blue-300",      accent: "#1d4ed8" },
  { id: "purple",  label: "Purple",  bg: "from-violet-400/30 to-violet-600/20 dark:from-violet-500/20 dark:to-indigo-900/20",  border: "border-violet-300/30 dark:border-violet-400/20", text: "text-violet-600 dark:text-violet-300",  accent: "#7c3aed" },
  { id: "emerald", label: "Slate",   bg: "from-slate-400/25 to-indigo-500/20 dark:from-slate-500/20 dark:to-indigo-900/20",    border: "border-slate-300/25 dark:border-slate-400/25",   text: "text-slate-600 dark:text-slate-300",    accent: "#475569" },
  { id: "rose",    label: "Rose",    bg: "from-rose-400/25 to-rose-600/15 dark:from-rose-500/15 dark:to-stone-800/20",         border: "border-rose-300/25 dark:border-rose-400/20",     text: "text-rose-600 dark:text-rose-300",      accent: "#9f1239" },
  { id: "amber",   label: "Amber",   bg: "from-amber-400/25 to-amber-600/15 dark:from-amber-500/15 dark:to-stone-800/20",      border: "border-amber-300/25 dark:border-amber-400/15",   text: "text-amber-600 dark:text-amber-300",    accent: "#b45309" },
  { id: "cyan",    label: "Sky",     bg: "from-sky-400/25 to-blue-500/20 dark:from-sky-500/20 dark:to-blue-900/20",            border: "border-sky-300/25 dark:border-sky-400/20",       text: "text-sky-600 dark:text-sky-300",        accent: "#0369a1" },
  { id: "indigo",  label: "Indigo",  bg: "from-indigo-400/30 to-indigo-600/20 dark:from-indigo-500/20 dark:to-slate-900/20",   border: "border-indigo-300/30 dark:border-indigo-400/20", text: "text-indigo-600 dark:text-indigo-300",  accent: "#4338ca" },
  { id: "pink",    label: "Pink",    bg: "from-pink-400/25 to-pink-600/15 dark:from-pink-500/15 dark:to-slate-800/20",         border: "border-pink-300/25 dark:border-pink-400/15",     text: "text-pink-600 dark:text-pink-300",      accent: "#be185d" },
];

function getClassColor(colorId: string) {
  return CLASS_COLORS.find(c => c.id === colorId) || CLASS_COLORS[0];
}

function patternColor(accent: string): string {
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.18)`;
}

function getColorFor(course: CourseOut) {
  if (course.theme_color) {
    const found = CLASS_COLORS.find(c => c.id === course.theme_color);
    if (found) return found;
  }
  let hash = 0;
  for (let i = 0; i < course.id.length; i++) hash = course.id.charCodeAt(i) + ((hash << 5) - hash);
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
}

function getPatternFor(course: CourseOut): string {
  if (course.pattern) return course.pattern;
  let hash = 0;
  for (let i = 0; i < course.id.length; i++) hash = course.id.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PATTERNS[Math.abs(hash) % FALLBACK_PATTERNS.length];
}

const ITEM_TYPE_ICONS: Record<string, typeof FileText> = {
  slides: FileText, document: FileText, pdf: FileText, video: Video,
  form: ClipboardList, link: Link2, content: BookOpen, spreadsheet: LayoutGrid, image: FileText,
};
function ItemTypeIcon({ type }: { type: string }) {
  const Icon = ITEM_TYPE_ICONS[type] || Link2;
  return <Icon className="w-3.5 h-3.5 flex-shrink-0" />;
}

// ── AI Scanning progress steps ──
const SCAN_STEPS = [
  { id: "fetch", icon: Globe, label: "Fetching site pages", detail: "Connecting to Google Sites..." },
  { id: "extract", icon: Search, label: "Extracting content", detail: "Reading text, links, and embedded resources..." },
  { id: "extract_done", icon: Search, label: "Extraction complete", detail: "All content extracted" },
  { id: "analyze", icon: Brain, label: "AI analyzing structure", detail: "Gemini is organizing content into modules..." },
  { id: "build", icon: FolderInput, label: "Building course preview", detail: "Mapping resources to course structure..." },
];

const STEP_INDEX: Record<string, number> = {};
SCAN_STEPS.forEach((s, i) => { STEP_INDEX[s.id] = i; });

export default function ClassManagementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<CourseOut | null>(null);
  const [form, setForm] = useState({ courseName: "", courseCode: "", semester: "1", year: "", academicSession: "", themeColor: "", pattern: "" });
  const [saving, setSaving] = useState(false);

  // Import modal (separate)
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>("url");
  const [googleSiteUrl, setGoogleSiteUrl] = useState("");
  const [importError, setImportError] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDetail, setScanDetail] = useState("");
  const [scanStats, setScanStats] = useState<{ pages?: string; embeds?: number; texts?: number; resources?: number; cached?: boolean }>({});
  const [scanLogs, setScanLogs] = useState<{ time: string; text: string; type: string }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [sitePreview, setSitePreview] = useState<SiteImportPreview | null>(null);
  const [siteRawData, setSiteRawData] = useState<Record<string, unknown> | null>(null);
  const [siteImportResult, setSiteImportResult] = useState<SiteImportResult | null>(null);
  const [expandedSiteModules, setExpandedSiteModules] = useState<Set<number>>(new Set());
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Group split state
  const [showGroupSplit, setShowGroupSplit] = useState(false);
  const [splitByGroups, setSplitByGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Other modals
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<CourseOut | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // Legacy AI import state (kept for backward compat with create modal)
  const [previewModules, setPreviewModules] = useState<ImportModule[]>([]);

  useEffect(() => {
    if (!user) return;
    coursesApi.teaching().then(list => { setCourses(list); setLoading(false); });
  }, [user]);

  const resetCreateState = () => {
    setShowCreate(false);
    setForm({ courseName: "", courseCode: "", semester: "1", year: "", academicSession: "", themeColor: "", pattern: "" });
    setPreviewModules([]);
  };

  const resetImportState = () => {
    setShowImport(false);
    setImportStep("url");
    setGoogleSiteUrl("");
    setImportError("");
    setScanProgress(0);
    setScanDetail("");
    setScanStats({});
    setSitePreview(null);
    setSiteRawData(null);
    setSiteImportResult(null);
    setExpandedSiteModules(new Set());
    setShowGroupSplit(false);
    setSplitByGroups(false);
    setSelectedGroups(new Set());
    if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
  };

  // ── Create handlers ──
  const handleCreate = async () => {
    if (saving) return;
    if (!form.courseName.trim() || !form.courseCode.trim() || !user) return;
    setSaving(true);
    try {
      const created = await coursesApi.create({
        course_name: form.courseName,
        course_code: form.courseCode.toUpperCase(),
        semester: form.semester,
        year: form.year ? parseInt(form.year, 10) : null,
        academic_session: form.academicSession.trim(),
        theme_color: form.themeColor,
        pattern: form.pattern,
      });
      if (previewModules.length > 0) {
        try { await aiImportApi.importEditedModules(created.id, previewModules); } catch { /* ok */ }
      }
      setCourses(prev => [created, ...prev]);
      resetCreateState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (saving) return;
    if (!editTarget || !form.courseName.trim() || !form.courseCode.trim()) return;
    setSaving(true);
    try {
      const updated = await coursesApi.update(editTarget.id, {
        course_name: form.courseName, course_code: form.courseCode.toUpperCase(),
        semester: form.semester,
        year: form.year ? parseInt(form.year, 10) : null,
        academic_session: form.academicSession.trim(),
        theme_color: form.themeColor, pattern: form.pattern,
      });
      setCourses(prev => prev.map(c => c.id === editTarget.id ? updated : c));
      setEditTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    const snapshot = courses;
    // Optimistic: remove from list and close modal immediately; cascade runs in background.
    setCourses(prev => prev.filter(c => c.id !== id));
    setDeleteTarget(null);
    try {
      await coursesApi.delete(id);
    } catch (err: unknown) {
      setCourses(snapshot);
      alert(err instanceof Error ? err.message : "Failed to delete class");
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEdit = (c: CourseOut) => {
    setForm({
      courseName: c.course_name,
      courseCode: c.course_code,
      semester: c.semester,
      year: c.year != null ? String(c.year) : "",
      academicSession: c.academic_session || "",
      themeColor: c.theme_color || "",
      pattern: c.pattern || "",
    });
    setEditTarget(c);
  };

  // ── Import handlers ──
  const handleStartScan = async () => {
    if (!googleSiteUrl.trim()) return;
    setImportStep("scanning");
    setImportError("");
    setScanProgress(0);
    setScanDetail("");
    setScanStats({});

    try {
      const result = await siteImportApi.previewStream(googleSiteUrl.trim(), 80, (evt) => {
        // Update progress based on SSE events
        const step = evt.step as string;
        if (step && STEP_INDEX[step] !== undefined) {
          setScanProgress(STEP_INDEX[step]);
        }
        if (evt.detail) {
          setScanDetail(evt.detail as string);
        }
        // Update live stats
        setScanStats(prev => ({
          ...prev,
          ...(evt.pages_found ? { pages: `${evt.pages_found} pages found` } : {}),
          ...(evt.page_current ? { pages: `${evt.page_current}/${evt.page_total} pages` } : {}),
          ...(evt.embeds_so_far !== undefined ? { embeds: evt.embeds_so_far as number } : {}),
          ...(evt.total_embeds !== undefined ? { embeds: evt.total_embeds as number } : {}),
          ...(evt.text_blocks_so_far !== undefined ? { texts: evt.text_blocks_so_far as number } : {}),
          ...(evt.total_text_blocks !== undefined ? { texts: evt.total_text_blocks as number } : {}),
          ...(evt.resources_so_far !== undefined ? { resources: evt.resources_so_far as number } : {}),
          ...(evt.total_resources !== undefined ? { resources: evt.total_resources as number } : {}),
          ...(evt.cached ? { cached: true } : {}),
        }));
      });

      setScanProgress(SCAN_STEPS.length - 1);
      setSitePreview(result);
      setSiteRawData(result.raw_data);
      const initial = new Set<number>();
      result.preview?.modules?.forEach((_: unknown, i: number) => { if (i < 3) initial.add(i); });
      setExpandedSiteModules(initial);
      setTimeout(() => setImportStep("preview"), 600);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Failed to analyze site.");
      setImportStep("url");
    }
  };

  const handleConfirmImport = () => {
    if (!siteRawData) return;
    // If groups detected and user hasn't chosen yet, show the group split popup
    const groups = sitePreview?.preview?.groups || [];
    if (groups.length > 1 && !showGroupSplit) {
      setSelectedGroups(new Set(groups.map(g => g.name)));
      setShowGroupSplit(true);
      return;
    }
  };

  const executeImport = async (split: boolean) => {
    if (!siteRawData) return;
    setShowGroupSplit(false);
    setImportStep("importing");
    try {
      const groupNames = split ? Array.from(selectedGroups) : undefined;
      const result = await siteImportApi.importFromData(siteRawData, split, groupNames);
      setSiteImportResult(result);
      if (result.ok) {
        const list = await coursesApi.teaching();
        setCourses(list);
      }
      setImportStep("success");
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImportStep("preview");
    }
  };

  const toggleSiteModuleExpand = (idx: number) => {
    setExpandedSiteModules(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // Duplicate
  const handleDuplicate = async () => {
    if (!duplicateTarget || !user) return;
    setDuplicating(true);
    try {
      const created = await coursesApi.create({
        course_name: duplicateTarget.course_name, course_code: duplicateTarget.course_code,
        semester: duplicateTarget.semester,
        year: duplicateTarget.year ?? null,
        academic_session: duplicateTarget.academic_session || "",
        description: (duplicateTarget as CourseOut & { description?: string }).description || "",
      });
      try {
        const { modulesApi } = await import("@/lib/api");
        const modules = await modulesApi.list(duplicateTarget.id);
        for (const mod of modules) {
          const newMod = await modulesApi.createModule(created.id, { title: mod.title, description: mod.description || "" });
          if (mod.items?.length) {
            for (const item of mod.items) {
              await modulesApi.createItem(created.id, newMod.id, { title: item.title, type: item.type, url: item.url || "" });
            }
          }
        }
      } catch { /* ok */ }
      setCourses(prev => [created, ...prev]);
      setDuplicateTarget(null);
    } catch { /* ok */ } finally { setDuplicating(false); }
  };

  const preview = sitePreview?.preview;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Class Management</h1>
          <p className="text-sm text-dark-300 mt-1">Create and manage your course classes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetImportState(); setShowImport(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-accent-purple/30 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors">
            <Download className="w-4 h-4" />
            Import from Google Sites
          </button>
          <button onClick={() => { resetCreateState(); setShowCreate(true); }}
            className="btn-gradient flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white relative">
            <Plus className="w-4 h-4 relative z-[1]" />
            <span className="relative z-[1]">Create Class</span>
          </button>
        </div>
      </div>

      {/* Course cards */}
      {loading ? (
        <p className="text-dark-400 text-center py-8">Loading...</p>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 text-dark-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-dark-200">No Classes Found</p>
          <p className="text-sm text-dark-400">Click Create Class to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {courses.map((c, i) => {
            const color = getColorFor(c);
            const pattern = getPatternFor(c);
            const patStyle = getPatternStyle(pattern, patternColor(color.accent));
            return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              className="glass-card overflow-hidden cursor-pointer hover:border-accent-purple/30 transition-colors"
              onClick={() => router.push(`/lecturer/course/${c.id}`)}>
              <div className={`px-5 py-4 bg-gradient-to-r ${color.bg} border-b ${color.border} relative overflow-hidden`}>
                {patStyle && (
                  <div
                    className="absolute inset-y-0 right-0 w-1/2 pointer-events-none"
                    style={{ ...patStyle, mixBlendMode: "normal", opacity: 0.2, maskImage: "linear-gradient(to right, transparent, black)", WebkitMaskImage: "linear-gradient(to right, transparent, black)" }}
                  />
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 relative z-[1]">{c.course_name}</h3>
                <p className="text-sm text-gray-600 dark:text-dark-300 relative z-[1]">
                  {c.course_code} &middot; Semester {semesterLabel(c.semester)}
                  {c.year ? ` · Year ${c.year}` : ""}
                  {c.academic_session ? ` · ${c.academic_session}` : ""}
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between bg-accent-cyan/5 border border-accent-cyan/20 rounded-xl px-3 py-2">
                  <span className="font-mono font-bold text-accent-cyan tracking-wider">{c.join_code}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleCopy(c.join_code, c.id); }} className="p-1 hover:bg-white/5 rounded transition-colors">
                    {copiedId === c.id ? <Check className="w-4 h-4 text-accent-emerald" /> : <Copy className="w-4 h-4 text-accent-cyan" />}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs text-dark-300">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.enrolled_count || 0} students</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-xs text-dark-400">Manage Class</span>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setDuplicateTarget(c); }} className="p-2 hover:bg-accent-cyan/10 rounded-lg text-dark-300 hover:text-accent-cyan transition-colors" title="Duplicate"><CopyPlus className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-2 hover:bg-accent-amber/10 rounded-lg text-dark-300 hover:text-accent-amber transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.id); }} className="p-2 hover:bg-red-500/10 rounded-lg text-dark-300 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          IMPORT FROM GOOGLE SITES MODAL — wide landscape
         ═══════════════════════════════════════════════════════════════ */}
      <Modal open={showImport} onClose={resetImportState}
        title={importStep === "success" ? "" : undefined}
        noPadding
        maxWidth={importStep === "url" ? "max-w-2xl" : importStep === "scanning" ? "max-w-2xl" : "max-w-6xl"}>

        {/* ── URL Input Step ── */}
        {importStep === "url" && (
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 border border-accent-purple/20 flex items-center justify-center mx-auto">
                <Globe className="w-7 h-7 text-accent-purple" />
              </div>
              <h2 className="text-xl font-bold text-dark-100">Import from Google Sites</h2>
              <p className="text-sm text-dark-300 max-w-md mx-auto">
                Paste your Google Sites URL below. Our AI will analyze the site structure and automatically create a course with modules, resources, and groups.
              </p>
            </div>

            {/* URL Input */}
            <div className="max-w-lg mx-auto space-y-3">
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="url"
                  value={googleSiteUrl}
                  onChange={e => { setGoogleSiteUrl(e.target.value); setImportError(""); }}
                  placeholder="https://sites.google.com/..."
                  className="glass-input w-full pl-12 pr-4 py-3.5 text-sm rounded-xl"
                  onKeyDown={e => { if (e.key === "Enter") handleStartScan(); }}
                  autoFocus
                />
              </div>
              {importError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{importError}</p>
                </div>
              )}
              <button
                onClick={handleStartScan}
                disabled={!googleSiteUrl.trim()}
                className="w-full btn-gradient px-6 py-3 text-sm text-white rounded-xl relative z-10 disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Scan & Analyze Site
                </span>
              </button>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
              {[
                { icon: Search, label: "Crawls all pages", desc: "Reads navigation & content" },
                { icon: Brain, label: "AI-powered analysis", desc: "Gemini structures the data" },
                { icon: FolderInput, label: "Auto-creates course", desc: "Modules, groups & resources" },
              ].map(c => (
                <div key={c.label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                  <c.icon className="w-5 h-5 text-accent-purple mx-auto mb-1.5" />
                  <p className="text-[11px] font-medium text-dark-200">{c.label}</p>
                  <p className="text-[10px] text-dark-400">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Scanning Step with progress ── */}
        {importStep === "scanning" && (
          <div className="p-8 space-y-8">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-dark-100">Analyzing Google Site</h2>
              <p className="text-xs text-dark-400 font-mono truncate max-w-md mx-auto">{googleSiteUrl}</p>
              {scanStats.cached && (
                <p className="text-[11px] text-accent-emerald font-medium mt-1">⚡ Cached — same site structure detected, skipping AI</p>
              )}
            </div>

            {/* Progress bar */}
            <div className="max-w-md mx-auto">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full"
                  initial={{ width: "5%" }}
                  animate={{ width: `${Math.min(((scanProgress + 1) / SCAN_STEPS.length) * 100, 95)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-dark-400">Step {scanProgress + 1} of {SCAN_STEPS.length}</span>
                <span className="text-[10px] text-dark-400">{Math.round(((scanProgress + 1) / SCAN_STEPS.length) * 100)}%</span>
              </div>
            </div>

            {/* Live stats counters */}
            {(scanStats.pages || scanStats.embeds !== undefined || scanStats.resources !== undefined) && (
              <div className="max-w-md mx-auto grid grid-cols-4 gap-2">
                {[
                  { label: "Pages", value: scanStats.pages || "0", color: "text-accent-purple" },
                  { label: "Embeds", value: scanStats.embeds ?? 0, color: "text-accent-cyan" },
                  { label: "Texts", value: scanStats.texts ?? 0, color: "text-accent-blue" },
                  { label: "Resources", value: scanStats.resources ?? 0, color: "text-accent-emerald" },
                ].map(s => (
                  <motion.div key={s.label} layout className="bg-white/3 border border-white/5 rounded-lg px-2 py-2 text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-dark-500 uppercase tracking-wider">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Step cards */}
            <div className="max-w-md mx-auto space-y-2.5">
              {SCAN_STEPS.map((step, i) => {
                const isActive = i === scanProgress;
                const isDone = i < scanProgress;
                // Show live detail text from SSE for active step
                const detailText = isActive && scanDetail ? scanDetail : isActive ? step.detail : isDone ? "Completed" : "Waiting...";
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${
                      isActive
                        ? "bg-accent-purple/10 border-accent-purple/30"
                        : isDone
                        ? "bg-accent-emerald/5 border-accent-emerald/20"
                        : "bg-white/2 border-white/5 opacity-40"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive ? "bg-accent-purple/20" : isDone ? "bg-accent-emerald/20" : "bg-white/5"
                    }`}>
                      {isDone ? (
                        <Check className="w-5 h-5 text-accent-emerald" />
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
                      ) : (
                        <step.icon className="w-5 h-5 text-dark-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isActive ? "text-dark-100" : isDone ? "text-accent-emerald" : "text-dark-400"}`}>
                        {step.label}
                      </p>
                      <p className={`text-[11px] truncate ${isActive ? "text-dark-300" : "text-dark-500"}`}>
                        {detailText}
                      </p>
                    </div>
                    {isActive && (
                      <div className="flex gap-1">
                        {[0, 1, 2].map(d => (
                          <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-accent-purple"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: d * 0.3 }} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Preview Step — wide landscape ── */}
        {importStep === "preview" && preview && (
          <div className="flex flex-col" style={{ maxHeight: "85vh" }}>
            {/* Top header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent-purple" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-dark-100">{preview.course.course_name}</h2>
                  <p className="text-xs text-dark-400">
                    <span className="font-mono text-dark-300">{preview.course.course_code}</span> &middot; Semester {semesterLabel(preview.course.semester)} &middot; {preview.pages_scraped} pages analyzed
                  </p>
                </div>
              </div>
              <button onClick={resetImportState} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5 text-dark-300" />
              </button>
            </div>

            {/* Two-column layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Modules */}
              <div className="flex-1 border-r border-white/5 flex flex-col min-w-0">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                  <p className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-accent-purple" />
                    Modules ({preview.modules_count})
                  </p>
                  <span className="text-[11px] text-dark-400">{preview.total_items} total items</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {preview.modules.map((mod, mi) => (
                    <div key={mi} className="border border-white/8 rounded-xl overflow-hidden bg-white/2">
                      <div className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => toggleSiteModuleExpand(mi)}>
                        {expandedSiteModules.has(mi)
                          ? <ChevronDown className="w-4 h-4 text-dark-400 flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-dark-400 flex-shrink-0" />}
                        <BookOpen className="w-4 h-4 text-accent-purple flex-shrink-0" />
                        <span className="flex-1 text-sm font-medium text-dark-100 truncate">{mod.title}</span>
                        <span className="text-[10px] text-dark-400 bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">{mod.items_count} items</span>
                      </div>
                      <AnimatePresence>
                        {expandedSiteModules.has(mi) && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5">
                            {mod.description && (
                              <p className="px-4 py-2 text-[11px] text-dark-400 bg-white/2">{mod.description.substring(0, 200)}{mod.description.length > 200 ? "..." : ""}</p>
                            )}
                            <div className="p-3 space-y-1">
                              {mod.items_preview.map((item, ii) => (
                                <div key={ii} className="flex items-center gap-2.5 text-[11px] text-dark-300 bg-white/3 rounded-lg px-3 py-1.5 hover:bg-white/5 transition-colors">
                                  <ItemTypeIcon type={item.type} />
                                  <span className="flex-1 truncate">{item.title}</span>
                                  <span className="text-[9px] text-dark-500 uppercase bg-white/5 px-1.5 py-0.5 rounded">{item.type}</span>
                                  {item.group_name && (
                                    <span className="text-[9px] text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">{item.group_name}</span>
                                  )}
                                </div>
                              ))}
                              {mod.items_count > mod.items_preview.length && (
                                <p className="text-[10px] text-dark-500 text-center py-1">+{mod.items_count - mod.items_preview.length} more items</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Summary sidebar */}
              <div className="w-[320px] flex-shrink-0 flex flex-col overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Stats grid */}
                  <div>
                    <p className="text-xs font-semibold text-dark-200 mb-2">Import Summary</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Modules", value: preview.modules_count, color: "text-accent-purple", bg: "bg-accent-purple/10" },
                        { label: "Items", value: preview.total_items, color: "text-accent-blue", bg: "bg-accent-blue/10" },
                        { label: "Groups", value: preview.groups.length, color: "text-accent-cyan", bg: "bg-accent-cyan/10" },
                        { label: "Assignments", value: preview.assignments_count, color: "text-accent-amber", bg: "bg-accent-amber/10" },
                      ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] text-dark-400">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Groups */}
                  {preview.groups.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-dark-200 mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-accent-cyan" /> Detected Groups
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {preview.groups.map((g, i) => (
                          <span key={i} className="px-2.5 py-1 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg text-[11px] text-dark-200 font-medium">{g.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignments */}
                  {preview.assignments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-dark-200 mb-2 flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-accent-amber" /> Assignments ({preview.assignments_count})
                      </p>
                      <div className="space-y-1.5">
                        {preview.assignments.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white/3 rounded-lg px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              a.type === "rubric_attachment" ? "bg-accent-amber/15 text-accent-amber" : "bg-accent-purple/15 text-accent-purple"
                            }`}>
                              {a.type === "rubric_attachment" ? "Rubric" : "Task"}
                            </span>
                            <span className="text-[11px] text-dark-200 truncate flex-1">{a.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attendance */}
                  {preview.attendance_sessions_count > 0 && (
                    <div className="bg-accent-emerald/5 border border-accent-emerald/20 rounded-xl p-3">
                      <p className="text-xs font-medium text-accent-emerald flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" /> {preview.attendance_sessions_count} Attendance Sessions
                      </p>
                    </div>
                  )}

                  {/* Warnings */}
                  {preview.warnings.length > 0 && (
                    <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-medium text-accent-amber flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Warnings
                      </p>
                      {preview.warnings.map((w, i) => (
                        <p key={i} className="text-[10px] text-dark-400 leading-relaxed">{w}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 flex-shrink-0 bg-dark-900/50">
              {importError && <p className="text-xs text-red-400 flex-1">{importError}</p>}
              <button onClick={() => { setImportStep("url"); setSitePreview(null); setSiteRawData(null); }}
                className="text-sm text-dark-400 hover:text-dark-200 transition-colors flex items-center gap-1.5">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back
              </button>
              <div className="flex gap-2 ml-auto">
                <button onClick={resetImportState}
                  className="px-5 py-2.5 text-sm text-dark-200 hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                <button onClick={handleConfirmImport}
                  className="btn-gradient px-6 py-2.5 text-sm text-white rounded-xl relative z-10">
                  <span className="relative z-10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Create Course
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Importing Step ── */}
        {importStep === "importing" && (
          <div className="p-12 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent-purple animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-dark-100">Creating your course...</p>
              <p className="text-sm text-dark-400">Setting up modules, groups, assignments, and resources</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map(d => (
                <motion.div key={d} className="w-2 h-2 rounded-full bg-accent-purple"
                  animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Success Step ── */}
        {importStep === "success" && siteImportResult && (
          <div className="p-8 space-y-6">
            {/* Success animation */}
            <div className="text-center space-y-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-emerald/20 to-accent-cyan/20 border border-accent-emerald/20 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-accent-emerald" />
              </motion.div>
              <h2 className="text-xl font-bold text-dark-100">Course Imported Successfully!</h2>
              <p className="text-sm text-dark-300">
                {siteImportResult.summary.course_name} <span className="text-dark-400">({siteImportResult.summary.course_code})</span>
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
              {[
                ...(siteImportResult.split_courses
                  ? [{ label: "Classes", value: siteImportResult.summary.courses_created || siteImportResult.split_courses.length, color: "text-accent-cyan" }]
                  : [{ label: "Groups", value: siteImportResult.summary.groups_created, color: "text-accent-cyan" }]
                ),
                { label: "Modules", value: siteImportResult.summary.modules_created, color: "text-accent-purple" },
                { label: "Items", value: siteImportResult.summary.items_created, color: "text-accent-blue" },
                { label: "Assignments", value: siteImportResult.summary.assignments_created, color: "text-accent-amber" },
              ].map(s => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-dark-400">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Split courses list */}
            {siteImportResult.split_courses && siteImportResult.split_courses.length > 0 ? (
              <div className="max-w-lg mx-auto space-y-2">
                <p className="text-xs font-semibold text-dark-200 mb-2">Created Classes:</p>
                {siteImportResult.split_courses.map((sc, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-100 font-medium truncate">{sc.course_name}</p>
                      <p className="text-[11px] text-dark-400">{sc.modules_created} modules &middot; {sc.items_created} items</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-bold text-accent-cyan">{sc.join_code}</span>
                      <button onClick={() => { resetImportState(); router.push(`/lecturer/course/${sc.course_id}`); }}
                        className="text-xs text-accent-blue hover:text-accent-blue/80 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Single course join code */
              <div className="max-w-sm mx-auto bg-accent-cyan/5 border border-accent-cyan/20 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-dark-300">Join Code</span>
                <span className="font-mono text-lg font-bold text-accent-cyan tracking-widest">{siteImportResult.join_code}</span>
              </div>
            )}

            {/* Warnings */}
            {siteImportResult.warnings && siteImportResult.warnings.length > 0 && (
              <div className="max-w-lg mx-auto bg-accent-amber/5 border border-accent-amber/20 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-medium text-accent-amber flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Warnings</p>
                {siteImportResult.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-dark-400">{w}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={resetImportState} className="px-5 py-2.5 text-sm text-dark-200 hover:bg-white/5 rounded-xl border border-white/10 transition-colors">Close</button>
              {!siteImportResult.split_courses && (
                <button onClick={() => { resetImportState(); router.push(`/lecturer/course/${siteImportResult.course_id}`); }}
                  className="btn-gradient px-6 py-2.5 text-sm text-white rounded-xl relative z-10">
                  <span className="relative z-10 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Go to Course
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Class Modal */}
      <Modal open={showCreate || !!editTarget} onClose={() => { if (saving) return; resetCreateState(); setEditTarget(null); }}
        title={editTarget ? "Edit Class" : "Create New Class"} maxWidth="max-w-2xl">
        <div className="space-y-5">
          {/* Live preview card */}
          {(() => {
            const previewColor = form.themeColor ? getClassColor(form.themeColor) : CLASS_COLORS[0];
            const previewPattern = form.pattern || FALLBACK_PATTERNS[0];
            return (
              <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-lg">
                <div
                  className={`relative h-28 px-5 flex items-end bg-gradient-to-br ${previewColor.bg}`}
                  style={getPatternStyle(previewPattern, previewColor.accent) || undefined}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="relative z-10 pb-4">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${previewColor.text} bg-black/20 backdrop-blur-sm`}>
                      <BookOpen className="w-3 h-3" />
                      {form.courseCode.trim().toUpperCase() || "CODE"}
                    </div>
                    <div className="text-white font-semibold text-base mt-1 drop-shadow-sm">
                      {form.courseName.trim() || "Class name preview"}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-2.5 bg-gray-100 dark:bg-dark-800/60 flex items-center justify-between text-xs text-gray-600 dark:text-dark-300">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span>Semester {semesterLabel(form.semester)}</span>
                    {form.year && <span>· Year {form.year}</span>}
                    {form.academicSession.trim() && <span>· {form.academicSession.trim()}</span>}
                  </span>
                  <span className="font-medium">{previewColor.label} · {PATTERN_LIST.find(p => p.id === previewPattern)?.label || "Pattern"}</span>
                </div>
              </div>
            );
          })()}

          {/* Form grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1.5">Course Name</label>
              <input
                type="text"
                value={form.courseName}
                onChange={e => setForm(p => ({ ...p, courseName: e.target.value }))}
                list="course-name-suggestions"
                placeholder="Type or pick a course name"
                required
                className="glass-input w-full px-4 py-2.5 text-sm rounded-xl"
                maxLength={120}
              />
              <datalist id="course-name-suggestions">
                {COURSE_NAMES.map(name => <option key={name} value={name} />)}
              </datalist>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-dark-400">
                Type any course name. Common ones appear as suggestions.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1.5">Course Code</label>
              <input
                type="text"
                value={form.courseCode}
                onChange={e => setForm(p => ({ ...p, courseCode: e.target.value.toUpperCase() }))}
                list="course-code-suggestions"
                placeholder="e.g. EDUP3033"
                required
                className="glass-input w-full px-4 py-2.5 text-sm rounded-xl font-mono uppercase"
                maxLength={20}
              />
              <datalist id="course-code-suggestions">
                {COURSE_CODES.map(code => <option key={code} value={code} />)}
              </datalist>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-dark-400">
                Type any code. Suggestions appear as you type.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1.5">Semester</label>
              <select value={form.semester} onChange={e => setForm(p => ({ ...p, semester: e.target.value }))}
                className="glass-input w-full px-4 py-2.5 text-sm rounded-xl">
                {[1, 2, 3].map(n => <option key={n} value={n}>Semester {semesterLabel(n)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1.5">Year</label>
              <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                className="glass-input w-full px-4 py-2.5 text-sm rounded-xl">
                <option value="">Not specified</option>
                {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200 mb-1.5">Academic Session</label>
              <input
                type="text"
                value={form.academicSession}
                onChange={e => setForm(p => ({ ...p, academicSession: e.target.value }))}
                placeholder="e.g. 2025/2026"
                className="glass-input w-full px-4 py-2.5 text-sm rounded-xl"
                maxLength={32}
              />
            </div>
          </div>

          {/* Theme color */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200">Theme Color</label>
              <span className="text-xs text-gray-500 dark:text-dark-400">{form.themeColor ? getClassColor(form.themeColor).label : "Auto-assigned"}</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {CLASS_COLORS.map(color => {
                const selected = form.themeColor === color.id;
                return (
                  <button key={color.id} type="button"
                    onClick={() => setForm(p => ({ ...p, themeColor: color.id }))}
                    className={`group relative aspect-square rounded-xl transition-all flex items-center justify-center shadow-sm ${selected ? "ring-2 ring-gray-900 dark:ring-white/80 scale-105" : "ring-1 ring-gray-300 dark:ring-white/10 hover:ring-gray-500 dark:hover:ring-white/30 hover:scale-105"}`}
                    style={{ backgroundColor: color.accent }}
                    title={color.label}
                    aria-label={color.label}>
                    {selected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pattern */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-200">Pattern</label>
              <span className="text-xs text-gray-500 dark:text-dark-400">{PATTERN_LIST.find(p => p.id === form.pattern)?.label || PATTERN_LIST[0]?.label}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {PATTERN_LIST.map(p => {
                const selected = form.pattern === p.id;
                const accent = (form.themeColor ? getClassColor(form.themeColor) : CLASS_COLORS[0]).accent;
                const layerStyle = getPatternLayerStyle(p.id);
                return (
                  <button key={p.id} type="button"
                    onClick={() => setForm(pr => ({ ...pr, pattern: p.id }))}
                    className={`relative h-14 rounded-xl overflow-hidden transition-all ${selected ? "ring-2 ring-gray-900 dark:ring-white/80" : "ring-1 ring-gray-300 dark:ring-white/10 hover:ring-gray-500 dark:hover:ring-white/30"}`}
                    style={{ backgroundColor: accent }}
                    title={p.label}>
                    {layerStyle && <span aria-hidden className="absolute inset-0" style={layerStyle} />}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute left-2 bottom-1 text-[11px] font-medium text-white drop-shadow">{p.label}</span>
                    {selected && <Check className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-white/10">
            <button onClick={() => { if (saving) return; resetCreateState(); setEditTarget(null); }}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-700 dark:text-dark-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50">Cancel</button>
            <button onClick={editTarget ? handleEdit : handleCreate}
              disabled={saving || !form.courseName.trim() || !form.courseCode.trim()}
              className="btn-gradient px-5 py-2 text-sm text-white rounded-lg relative z-10 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span className="relative z-10">{editTarget ? "Saving…" : "Creating…"}</span></>
              ) : (
                <span className="relative z-10">{editTarget ? "Save Changes" : "Create Class"}</span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Duplicate Modal */}
      <Modal open={!!duplicateTarget} onClose={() => setDuplicateTarget(null)} title="Duplicate Class">
        <div className="space-y-3">
          <p className="text-sm text-dark-200">
            This will create a copy of <span className="font-semibold text-dark-100">{duplicateTarget?.course_name}</span> with all its resources and modules, but without any enrolled students.
          </p>
          <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg p-3 text-xs text-dark-300 space-y-1">
            <p>What will be duplicated:</p>
            <ul className="list-disc list-inside text-dark-400 space-y-0.5">
              <li>Course details (name, code, semester)</li>
              <li>All modules and their resource items</li>
            </ul>
            <p className="text-accent-amber mt-2">Students will NOT be copied — the new class starts empty.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDuplicateTarget(null)} className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg">Cancel</button>
            <button onClick={handleDuplicate} disabled={duplicating}
              className="btn-gradient px-4 py-2 text-sm text-white rounded-lg relative z-10 disabled:opacity-50">
              <span className="relative z-10 flex items-center gap-1.5">
                {duplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyPlus className="w-3.5 h-3.5" />}
                {duplicating ? "Duplicating..." : "Duplicate Class"}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Group Split Decision Modal */}
      <Modal open={showGroupSplit} onClose={() => setShowGroupSplit(false)} title="Groups Detected" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-dark-200">
            We detected <span className="font-semibold text-accent-cyan">{sitePreview?.preview?.groups?.length || 0} groups</span> in this site.
            How would you like to import?
          </p>

          {/* Option 1: Single class */}
          <button
            onClick={() => { setSplitByGroups(false); executeImport(false); }}
            className={`w-full text-left p-4 rounded-xl border transition-colors ${
              !splitByGroups ? "border-accent-purple/40 bg-accent-purple/5" : "border-white/10 bg-white/3 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5 text-accent-purple" />
              </div>
              <div>
                <p className="text-sm font-semibold text-dark-100">Single Class</p>
                <p className="text-xs text-dark-400 mt-0.5">Create one class with all groups inside it</p>
              </div>
            </div>
          </button>

          {/* Option 2: Separate classes */}
          <div className={`rounded-xl border transition-colors ${
            splitByGroups ? "border-accent-cyan/40 bg-accent-cyan/5" : "border-white/10 bg-white/3"
          }`}>
            <button
              onClick={() => setSplitByGroups(true)}
              className="w-full text-left p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-accent-cyan" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark-100">Separate Classes</p>
                  <p className="text-xs text-dark-400 mt-0.5">Create a separate class for each group with its own join code</p>
                </div>
              </div>
            </button>

            {/* Group checkboxes */}
            <AnimatePresence>
              {splitByGroups && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                    <p className="text-[11px] text-dark-400 font-medium">Select groups to create as classes:</p>
                    {(sitePreview?.preview?.groups || []).map((g) => (
                      <label key={g.name} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(g.name)}
                          onChange={() => {
                            setSelectedGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(g.name)) next.delete(g.name); else next.add(g.name);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-cyan focus:ring-accent-cyan/30"
                        />
                        <span className="text-sm text-dark-200 group-hover:text-dark-100 transition-colors">{g.name}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Confirm button for split mode */}
          {splitByGroups && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => executeImport(true)}
                disabled={selectedGroups.size === 0}
                className="btn-gradient px-6 py-2.5 text-sm text-white rounded-xl relative z-10 disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Create {selectedGroups.size} Classes
                </span>
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Delete Class">
        <p className="text-sm text-dark-200 mb-4">Are you sure? This will permanently delete this class and all its data.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg disabled:opacity-50">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-2">
            {deleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</> : "Yes, Delete"}
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}
