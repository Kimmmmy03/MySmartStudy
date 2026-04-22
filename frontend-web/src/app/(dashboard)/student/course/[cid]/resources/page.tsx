"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { modulesApi, aiStudyMaterialsApi, StudyMaterial, ModuleOut, ModuleItemOut, ResourceProgressOut } from "@/lib/api";
import Modal from "@/components/ui/modal";
import ResourcePreview from "@/components/resource-preview";
import SummaryViewer from "@/components/ai-study-materials/summary-viewer";
import FlashcardViewer from "@/components/ai-study-materials/flashcard-viewer";
import PracticeQuiz from "@/components/ai-study-materials/practice-quiz";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Video, File, CheckCircle2, Circle, Map, Copy, Sparkles,
  Loader2, ChevronDown, Globe, Eye, Presentation, Sheet, FormInput, Search,
  Filter, BookOpen, Trash2, History,
} from "lucide-react";

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText, video: Video, link: Globe, doc: File, map_template: Map,
  slides: Presentation, document: File, form: FormInput, spreadsheet: Sheet,
  content: FileText, image: FileText, google_slides: Presentation, google_doc: File,
  google_form: FormInput, google_sheets: Sheet, youtube: Video,
  drive_file: File, drive_folder: File, google_drive: File,
  padlet: Globe, canva: Globe, kahoot: Globe, quizizz: Globe, mentimeter: Globe,
};

const fileTypeLabels: Record<string, string> = {
  pdf: "PDF", video: "Video", link: "Link", doc: "Document", map_template: "Template",
  slides: "Slides", document: "Document", form: "Form", spreadsheet: "Spreadsheet",
  content: "Content", image: "Image", google_slides: "Slides", google_doc: "Document",
  google_form: "Form", google_sheets: "Sheets", youtube: "YouTube",
  drive_file: "Drive File", drive_folder: "Drive Folder", google_drive: "Drive",
  padlet: "Padlet", canva: "Canva", kahoot: "Kahoot", quizizz: "Quizizz", mentimeter: "Mentimeter",
};

const FILTERS: { key: string; label: string; match: (t: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "docs", label: "Docs", match: t => ["pdf", "doc", "document", "google_doc"].includes(t) },
  { key: "slides", label: "Slides", match: t => ["slides", "google_slides", "canva"].includes(t) },
  { key: "video", label: "Video", match: t => ["video", "youtube"].includes(t) },
  { key: "links", label: "Links", match: t => ["link", "padlet", "kahoot", "quizizz", "mentimeter"].includes(t) },
  { key: "templates", label: "Templates", match: t => t === "map_template" },
];

const GEN_OPTS = [
  { type: "summary" as const, label: "Summary Notes" },
  { type: "flashcards" as const, label: "Flashcards" },
  { type: "quiz" as const, label: "Practice Quiz" },
];

const GENERATABLE = (ftype: string) => ["pdf", "doc", "canva"].includes(ftype);

export default function ResourcesPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleOut[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [progress, setProgress] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<ModuleItemOut | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateDropdown, setGenerateDropdown] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [generatedMaterial, setGeneratedMaterial] = useState<StudyMaterial | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StudyMaterial[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cid) return;
    const load = async () => {
      setLoadingModules(true);
      try {
        const [data, prog] = await Promise.all([
          modulesApi.list(cid as string),
          modulesApi.getProgress(cid as string),
        ]);
        setModules(data);
        setProgress(new Set(prog.map((p: ResourceProgressOut) => p.resource_id)));
      } finally {
        setLoadingModules(false);
      }
    };
    load();
  }, [cid]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGenerateDropdown(null);
        setDropdownRect(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleOpenResource = (item: ModuleItemOut) => {
    if (!cid) return;
    modulesApi.trackProgress(cid as string, item.module_id, item.id).catch(() => {});
    setProgress(prev => new Set([...prev, item.id]));
    setPreviewItem(item);
  };

  const handleCloneTemplate = async (item: ModuleItemOut) => {
    if (!cid) return;
    setCloning(item.id);
    try {
      const result = await modulesApi.cloneTemplate(cid as string, item.module_id, item.id);
      modulesApi.trackProgress(cid as string, item.module_id, item.id).catch(() => {});
      setProgress(prev => new Set([...prev, item.id]));
      router.push(`/student/create-map?mapId=${result.map_id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to clone template");
    } finally {
      setCloning(null);
    }
  };

  const handleGenerate = async (itemId: string, type: "summary" | "flashcards" | "quiz" | "mindmap") => {
    if (!cid) return;
    setGenerateDropdown(null);
    setGeneratingId(itemId);
    try {
      const result = await aiStudyMaterialsApi.generate({
        resource_id: itemId,
        course_id: cid as string,
        type,
      });
      setGeneratedMaterial(result);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate study material");
    } finally {
      setGeneratingId(null);
    }
  };

  const toggleCollapsed = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openHistory = async () => {
    if (!cid) return;
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const list = await aiStudyMaterialsApi.list({ course_id: cid as string });
      setHistory(list);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteHistory = async (id: string) => {
    try {
      await aiStudyMaterialsApi.delete(id);
      setHistory(prev => prev.filter(m => m.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filt = FILTERS.find(f => f.key === filter) || FILTERS[0];
    return modules.map(mod => ({
      ...mod,
      items: mod.items.filter(item => {
        const ftype = item.file_type || item.type;
        if (!filt.match(ftype)) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          (item.file_name || "").toLowerCase().includes(q)
        );
      }),
    })).filter(m => m.items.length > 0 || (!q && filter === "all"));
  }, [modules, search, filter]);

  const totals = useMemo(() => {
    const allItems = modules.flatMap(m => m.items);
    const opened = allItems.filter(i => progress.has(i.id)).length;
    return { total: allItems.length, opened };
  }, [modules, progress]);

  const renderGeneratedViewer = (material: StudyMaterial) => {
    switch (material.type) {
      case "summary": return <SummaryViewer content={material.content} />;
      case "flashcards": return <FlashcardViewer content={material.content} />;
      case "quiz": return <PracticeQuiz content={material.content} />;
      default: return <SummaryViewer content={material.content} />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-dark-100 flex items-center gap-1 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Resources</h1>
          {totals.total > 0 && (
            <p className="text-sm text-dark-400 mt-1">
              {totals.opened} of {totals.total} items opened
            </p>
          )}
        </div>
        <button
          onClick={openHistory}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-dark-200 transition-colors"
        >
          <History className="w-4 h-4" />
          My Materials
        </button>
      </div>

      {/* Overall progress bar */}
      {totals.total > 0 && (
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-accent-blue to-accent-purple transition-all"
            style={{ width: `${(totals.opened / totals.total) * 100}%` }}
          />
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="glass-input w-full pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="w-4 h-4 text-dark-400 shrink-0" />
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/30"
                  : "bg-white/5 text-dark-300 border border-white/5 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loadingModules ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card overflow-hidden animate-pulse">
              <div className="px-5 py-3 border-b border-white/5 bg-white/3">
                <div className="h-5 w-40 bg-white/10 rounded" />
              </div>
              <div className="p-4 space-y-2">
                {[1, 2].map(j => (
                  <div key={j} className="flex items-center gap-3 p-3 rounded-xl">
                    <div className="w-5 h-5 bg-white/10 rounded-full shrink-0" />
                    <div className="w-5 h-5 bg-white/10 rounded shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-white/10 rounded w-2/3" />
                      <div className="h-3 bg-white/5 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <BookOpen className="w-12 h-12 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300 font-medium">No resources yet</p>
          <p className="text-dark-400 text-sm mt-1">Your lecturer hasn&apos;t added any modules for this course.</p>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Search className="w-10 h-10 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300">No items match your search or filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredModules.map(mod => {
            const modOpened = mod.items.filter(i => progress.has(i.id)).length;
            const isCollapsed = collapsed.has(mod.id);
            return (
              <div key={mod.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => toggleCollapsed(mod.id)}
                  className="w-full px-5 py-3 border-b border-white/5 bg-white/3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                >
                  <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-dark-100 truncate">{mod.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue/70"
                          style={{ width: `${mod.items.length ? (modOpened / mod.items.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-dark-400">{modOpened}/{mod.items.length}</span>
                    </div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-1">
                        {mod.items.length === 0 ? (
                          <p className="text-sm text-dark-400 px-3 py-2">No matching items.</p>
                        ) : (
                          mod.items.map(item => {
                            const ftype = item.file_type || item.type;
                            const Icon = typeIcons[ftype] || File;
                            const isOpened = progress.has(item.id);
                            const isTemplate = ftype === "map_template";
                            const canGen = !isTemplate && (GENERATABLE(ftype) || !!item.file_path);

                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
                                onClick={() => isTemplate ? handleCloneTemplate(item) : handleOpenResource(item)}
                              >
                                {isOpened ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Circle className="w-5 h-5 text-dark-500 shrink-0" />
                                )}

                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  ftype === "content" ? "bg-amber-500/10" :
                                  ["google_slides", "slides"].includes(ftype) ? "bg-yellow-500/10" :
                                  ["google_doc", "document", "doc"].includes(ftype) ? "bg-blue-500/10" :
                                  ["google_form", "form"].includes(ftype) ? "bg-purple-500/10" :
                                  ["google_sheets", "spreadsheet"].includes(ftype) ? "bg-green-500/10" :
                                  ["youtube", "video"].includes(ftype) ? "bg-red-500/10" :
                                  ftype === "canva" ? "bg-cyan-500/10" :
                                  "bg-accent-blue/10"
                                }`}>
                                  <Icon className={`w-4.5 h-4.5 ${
                                    ftype === "content" ? "text-amber-400" :
                                    ["google_slides", "slides"].includes(ftype) ? "text-yellow-400" :
                                    ["google_doc", "document", "doc"].includes(ftype) ? "text-blue-400" :
                                    ["google_form", "form"].includes(ftype) ? "text-purple-400" :
                                    ["google_sheets", "spreadsheet"].includes(ftype) ? "text-green-400" :
                                    ["youtube", "video"].includes(ftype) ? "text-red-400" :
                                    ftype === "canva" ? "text-cyan-400" :
                                    "text-accent-blue"
                                  }`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-dark-100 truncate block font-medium">{item.title}</span>
                                  {item.description && item.type !== "content" && (
                                    <span className="text-xs text-dark-400 truncate block">{item.description.slice(0, 80)}</span>
                                  )}
                                  {item.file_name && item.file_size && (
                                    <span className="text-xs text-dark-400">
                                      {item.file_name} &middot; {item.file_size < 1024 * 1024
                                        ? `${(item.file_size / 1024).toFixed(1)} KB`
                                        : `${(item.file_size / (1024 * 1024)).toFixed(1)} MB`}
                                    </span>
                                  )}
                                </div>

                                <span className="text-xs text-dark-400 px-2 py-0.5 bg-white/5 border border-white/5 rounded shrink-0">
                                  {fileTypeLabels[ftype] || ftype}
                                </span>

                                {canGen && (
                                  <div className="shrink-0" onClick={e => e.stopPropagation()}>
                                    {generatingId === item.id ? (
                                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Generating...
                                      </span>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          if (generateDropdown === item.id) {
                                            setGenerateDropdown(null);
                                            setDropdownRect(null);
                                          } else {
                                            setDropdownRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                                            setGenerateDropdown(item.id);
                                          }
                                        }}
                                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Generate
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {isTemplate ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCloneTemplate(item); }}
                                    disabled={cloning === item.id}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors shrink-0 disabled:opacity-50"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    {cloning === item.id ? "Cloning..." : "Use Template"}
                                  </button>
                                ) : (
                                  <Eye className="w-4 h-4 text-dark-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Portal-rendered Generate menu — escapes overflow-hidden ancestors */}
      {typeof window !== "undefined" && generateDropdown && dropdownRect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownRect.bottom + 4,
            left: Math.max(8, Math.min(dropdownRect.right - 176, window.innerWidth - 184)),
            width: 176,
            zIndex: 9999,
          }}
          className="rounded-xl glass-card dropdown-menu py-1 shadow-xl overflow-hidden"
        >
          {GEN_OPTS.map(opt => (
            <button
              key={opt.type}
              onClick={() => {
                const id = generateDropdown;
                setDropdownRect(null);
                if (id) handleGenerate(id, opt.type);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-dark-200 hover:bg-white/5 hover:text-dark-100 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      <ResourcePreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onGenerate={(itemId, type) => handleGenerate(itemId, type)}
        generatingId={generatingId}
        canGenerate={previewItem ? !((previewItem.file_type || previewItem.type) === "map_template") && (GENERATABLE(previewItem.file_type || previewItem.type) || !!previewItem.file_path) : false}
      />

      <Modal
        open={!!generatedMaterial}
        onClose={() => setGeneratedMaterial(null)}
        title={generatedMaterial?.title || "Study Material"}
        maxWidth="max-w-3xl"
      >
        {generatedMaterial && renderGeneratedViewer(generatedMaterial)}
      </Modal>

      {/* History drawer */}
      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="My Generated Materials"
        maxWidth="max-w-2xl"
      >
        {historyLoading ? (
          <div className="py-8 text-center text-dark-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-dark-400 text-center py-8">You haven&apos;t generated any materials yet.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {history.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => { setGeneratedMaterial(m); setShowHistory(false); }}
              >
                <Sparkles className="w-4 h-4 text-accent-blue shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-dark-100 truncate">{m.title}</div>
                  <div className="text-xs text-dark-400 capitalize">{m.type} &middot; {new Date(m.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteHistory(m.id); }}
                  className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
