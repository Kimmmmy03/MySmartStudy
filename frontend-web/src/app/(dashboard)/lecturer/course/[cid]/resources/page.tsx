"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { modulesApi, ModuleOut, ModuleItemOut } from "@/lib/api";
import Modal from "@/components/ui/modal";
import AiImportModal from "@/components/ai-import-modal";
import ResourcePreview from "@/components/resource-preview";
import {
  ArrowLeft, Plus, Trash2, FileText, Video, Link as LinkIcon, File,
  ExternalLink, Upload, Calendar, Map, Lock, X, Globe, Eye,
  Presentation, Sheet, FormInput, Search, Filter, ChevronDown, BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText, video: Video, link: Globe, doc: File, map_template: Map,
  slides: Presentation, document: File, form: FormInput, spreadsheet: Sheet,
  content: FileText, image: FileText, google_slides: Presentation, google_doc: File,
  google_form: FormInput, google_sheets: Sheet, youtube: Video,
  drive_file: File, drive_folder: File, google_drive: File,
  padlet: Globe, canva: Globe, kahoot: Globe, quizizz: Globe, mentimeter: Globe,
};

const fileTypeLabels: Record<string, string> = {
  pdf: "PDF", video: "Video", link: "Link", doc: "Document", map_template: "Map Template",
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

/** Check if a URL is valid and not a Google Sites page URL */
function hasValidUrl(url?: string | null): boolean {
  if (!url || url.trim() === "") return false;
  if (url.includes("sites.google.com")) return false;
  return true;
}

/** Check if a resource can be previewed inline (embedded iframe) */
function canPreviewInline(item: ModuleItemOut): boolean {
  if (item.embed_url) return true;
  if (item.file_path) return true;
  if (item.type === "content" && item.description) return true;
  const url = item.url || "";
  if (
    url.includes("docs.google.com/presentation") ||
    url.includes("docs.google.com/document") ||
    url.includes("docs.google.com/spreadsheets") ||
    url.includes("docs.google.com/forms") ||
    url.includes("drive.google.com/file") ||
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.toLowerCase().endsWith(".pdf")
  ) return true;
  return false;
}

export default function LecturerResourcesPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleOut[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [showAddModule, setShowAddModule] = useState(false);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<ModuleItemOut | null>(null);

  // Add resource form state
  const [itemTitle, setItemTitle] = useState("");
  const [itemType, setItemType] = useState("link");
  const [itemUrl, setItemUrl] = useState("");
  const [itemUnlockDate, setItemUnlockDate] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("url");
  const [showImportModal, setShowImportModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dropRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  useEffect(() => {
    if (!cid) return;
    setLoadingModules(true);
    modulesApi.list(cid as string).then(data => {
      data.sort((a, b) => {
        const weekA = parseInt(a.title.match(/Week\s+(\d+)/i)?.[1] || "999");
        const weekB = parseInt(b.title.match(/Week\s+(\d+)/i)?.[1] || "999");
        if (weekA !== weekB) return weekA - weekB;
        return a.title.localeCompare(b.title);
      });
      setModules(data);
    }).finally(() => setLoadingModules(false));
  }, [cid]);

  const resetItemForm = () => {
    setItemTitle("");
    setItemType("link");
    setItemUrl("");
    setItemUnlockDate("");
    setUploadFile(null);
    setUploadMode("url");
  };

  const handleAddModule = async () => {
    if (!moduleTitle.trim() || !cid) return;
    const created = await modulesApi.createModule(cid as string, { title: moduleTitle, description: moduleDescription });
    setModules(prev => [...prev, created]);
    setShowAddModule(false);
    setModuleTitle("");
    setModuleDescription("");
  };

  const handleAddItem = async () => {
    if (!itemTitle.trim() || !showAddItem || !cid) return;
    setLoading(true);
    try {
      let created: ModuleItemOut;

      if (uploadMode === "file" && uploadFile) {
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("title", itemTitle);
        fd.append("file_type", itemType);
        if (itemUnlockDate) fd.append("unlock_date", new Date(itemUnlockDate).toISOString());
        created = await modulesApi.uploadItem(cid as string, showAddItem, fd);
      } else {
        created = await modulesApi.createItem(cid as string, showAddItem, {
          title: itemTitle,
          type: itemType,
          url: itemUrl,
          file_type: itemType,
          unlock_date: itemUnlockDate ? new Date(itemUnlockDate).toISOString() : null,
        });
      }

      setModules(prev => prev.map(m =>
        m.id === showAddItem ? { ...m, items: [...m.items, created] } : m
      ));
      setShowAddItem(null);
      resetItemForm();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add resource");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (modId: string) => {
    if (!cid || !confirm("Delete this module and all its items?")) return;
    await modulesApi.deleteModule(cid as string, modId);
    setModules(prev => prev.filter(m => m.id !== modId));
  };

  const handleDeleteItem = async (modId: string, itemId: string) => {
    if (!cid) return;
    await modulesApi.deleteItem(cid as string, modId, itemId);
    setModules(prev => prev.map(m =>
      m.id === modId ? { ...m, items: m.items.filter(i => i.id !== itemId) } : m
    ));
  };

  const handleItemClick = (item: ModuleItemOut) => {
    // Always open preview panel
    setPreviewItem(item);
  };

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadFile(file);
      setUploadMode("file");
      if (!itemTitle) setItemTitle(file.name.replace(/\.[^/.]+$/, ""));
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") setItemType("pdf");
      else if (["doc", "docx", "pptx"].includes(ext || "")) setItemType("doc");
    }
  }, [itemTitle]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark-100">Resources</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-dark-200 hover:bg-white/10 hover:text-dark-100 transition-colors">
            <Globe className="w-4 h-4" /> Import from Google Sites
          </button>
          <button onClick={() => setShowAddModule(true)} className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Module</span>
          </button>
        </div>
      </div>

      {/* Search + filters */}
      {!loadingModules && modules.length > 0 && (
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
                    ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                    : "bg-white/5 text-dark-300 border border-white/5 hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingModules ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card overflow-hidden animate-pulse">
              <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="h-5 w-36 bg-white/10 rounded" />
                <div className="flex gap-1">
                  <div className="w-7 h-7 bg-white/5 rounded" />
                  <div className="w-7 h-7 bg-white/5 rounded" />
                </div>
              </div>
              <div className="p-4 space-y-2">
                {[1, 2].map(j => (
                  <div key={j} className="flex items-center gap-3 p-3 rounded-lg">
                    <div className="w-5 h-5 bg-white/10 rounded shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-white/10 rounded w-3/4" />
                      <div className="h-3 bg-white/5 rounded w-1/3" />
                    </div>
                    <div className="h-5 w-12 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <BookOpen className="w-12 h-12 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300 font-medium">No modules yet</p>
          <p className="text-dark-400 text-sm mt-1">Click &quot;Add Module&quot; to create your first one.</p>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Search className="w-10 h-10 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300">No items match your search or filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredModules.map(mod => {
          const isCollapsed = collapsed.has(mod.id);
          return (
            <div key={mod.id} className="glass-card overflow-hidden">
              <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-3">
                <button
                  onClick={() => toggleCollapsed(mod.id)}
                  className="p-1 rounded hover:bg-white/5 shrink-0"
                  aria-label="Toggle module"
                >
                  <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-dark-100 truncate">{mod.title}</h3>
                  {mod.description && <p className="text-xs text-dark-400 mt-0.5 truncate">{mod.description}</p>}
                </div>
                <span className="text-xs text-dark-400 px-2 py-0.5 bg-white/5 border border-white/5 rounded shrink-0">
                  {mod.items.length} {mod.items.length === 1 ? "item" : "items"}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => { setShowAddItem(mod.id); resetItemForm(); }}
                    className="p-1.5 hover:bg-accent-purple/10 rounded text-dark-400 hover:text-accent-purple">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteModule(mod.id)}
                    className="p-1.5 hover:bg-red-500/10 rounded text-dark-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
                  <p className="text-sm text-dark-400">No items. Click + to add resources.</p>
                ) : (
                  mod.items.map((item: ModuleItemOut) => {
                    const ftype = item.file_type || item.type;
                    const Icon = typeIcons[ftype] || File;
                    const isLocked = item.unlock_date && new Date(item.unlock_date) > new Date();
                    const previewable = canPreviewInline(item);
                    const validUrl = hasValidUrl(item.url);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors group ${
                          previewable || validUrl || item.description
                            ? "hover:bg-white/5 cursor-pointer"
                            : ""
                        }`}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          ftype === "content" ? "bg-amber-500/10" :
                          ["google_slides", "slides"].includes(ftype) ? "bg-yellow-500/10" :
                          ["google_doc", "document", "doc"].includes(ftype) ? "bg-blue-500/10" :
                          ["google_form", "form"].includes(ftype) ? "bg-purple-500/10" :
                          ["google_sheets", "spreadsheet"].includes(ftype) ? "bg-green-500/10" :
                          ["youtube", "video"].includes(ftype) ? "bg-red-500/10" :
                          "bg-accent-purple/10"
                        }`}>
                          <Icon className={`w-4.5 h-4.5 ${
                            ftype === "content" ? "text-amber-400" :
                            ["google_slides", "slides"].includes(ftype) ? "text-yellow-400" :
                            ["google_doc", "document", "doc"].includes(ftype) ? "text-blue-400" :
                            ["google_form", "form"].includes(ftype) ? "text-purple-400" :
                            ["google_sheets", "spreadsheet"].includes(ftype) ? "text-green-400" :
                            ["youtube", "video"].includes(ftype) ? "text-red-400" :
                            "text-accent-purple"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-dark-100 truncate block font-medium">{item.title}</span>
                          {item.description && item.type !== "content" && (
                            <span className="text-xs text-dark-400 truncate block">{item.description.slice(0, 80)}</span>
                          )}
                          {item.file_name && item.file_size && (
                            <span className="text-xs text-dark-400">{item.file_name} &middot; {formatFileSize(item.file_size)}</span>
                          )}
                          {!validUrl && !item.file_path && item.type !== "content" && (
                            <span className="text-xs text-dark-500">No external link</span>
                          )}
                        </div>
                        <span className="text-xs text-dark-400 px-2 py-0.5 bg-white/5 rounded shrink-0">
                          {fileTypeLabels[ftype] || ftype}
                        </span>
                        {isLocked && (
                          <span className="text-xs text-amber-400 flex items-center gap-1 shrink-0" title={`Unlocks ${new Date(item.unlock_date!).toLocaleDateString()}`}>
                            <Lock className="w-3 h-3" />
                            {new Date(item.unlock_date!).toLocaleDateString()}
                          </span>
                        )}
                        {/* Attach PDF for link-based items (e.g., Canva private designs) */}
                        {ftype !== "content" && ftype !== "map_template" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "application/pdf";
                              input.onchange = async (ev) => {
                                const f = (ev.target as HTMLInputElement).files?.[0];
                                if (!f || !cid) return;
                                try {
                                  const updated = await modulesApi.attachPdf(cid as string, mod.id, item.id, f);
                                  setModules(prev => prev.map(m =>
                                    m.id === mod.id
                                      ? { ...m, items: m.items.map(i => i.id === item.id ? updated : i) }
                                      : m
                                  ));
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : "Attach failed");
                                }
                              };
                              input.click();
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs shrink-0 transition-colors ${
                              item.file_path
                                ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                                : "opacity-0 group-hover:opacity-100 text-accent-purple bg-accent-purple/10 border border-accent-purple/20 hover:bg-accent-purple/20"
                            }`}
                            title={item.file_path ? "PDF attached — click to replace" : "Attach a PDF for AI generation"}
                          >
                            <Upload className="w-3 h-3" />
                            {item.file_path ? "PDF" : "Attach PDF"}
                          </button>
                        )}
                        {(previewable || validUrl || item.description) && (
                          <Eye className="w-4 h-4 text-dark-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                        )}
                        {validUrl && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1 hover:bg-accent-purple/10 rounded text-dark-400 hover:text-accent-purple opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(mod.id, item.id); }}
                          className="p-1 hover:bg-red-500/10 rounded text-dark-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Resource Preview Panel */}
      <ResourcePreview item={previewItem} onClose={() => setPreviewItem(null)} />

      {/* Add Module Modal */}
      <Modal open={showAddModule} onClose={() => { setShowAddModule(false); setModuleTitle(""); setModuleDescription(""); }} title="Add Module">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Module Title</label>
            <input
              type="text"
              placeholder="e.g. Week 1 - Introduction"
              value={moduleTitle}
              onChange={e => setModuleTitle(e.target.value)}
              className="glass-input w-full px-4 py-2.5 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Description <span className="text-dark-400 font-normal">(optional)</span></label>
            <textarea
              placeholder="Brief description of what this module covers..."
              value={moduleDescription}
              onChange={e => setModuleDescription(e.target.value)}
              rows={3}
              className="glass-input w-full px-4 py-2.5 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowAddModule(false); setModuleTitle(""); setModuleDescription(""); }}
              className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleAddModule} disabled={!moduleTitle.trim()}
              className="btn-gradient relative z-10 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="relative z-10">Add Module</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Google Sites Import Modal */}
      {showImportModal && (
        <AiImportModal
          courseId={cid as string}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            modulesApi.list(cid as string).then(data => {
              data.sort((a, b) => {
                const weekA = parseInt(a.title.match(/Week\s+(\d+)/i)?.[1] || "999");
                const weekB = parseInt(b.title.match(/Week\s+(\d+)/i)?.[1] || "999");
                if (weekA !== weekB) return weekA - weekB;
                return a.title.localeCompare(b.title);
              });
              setModules(data);
            });
          }}
        />
      )}

      {/* Add Resource Item Modal */}
      <Modal open={!!showAddItem} onClose={() => { setShowAddItem(null); resetItemForm(); }} title="Add Resource">
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-dark-300 mb-1 block">Title</label>
            <input type="text" placeholder="Resource title" value={itemTitle}
              onChange={e => setItemTitle(e.target.value)} className="glass-input w-full" />
          </div>

          {/* File Type Selector */}
          <div>
            <label className="text-xs text-dark-300 mb-1 block">Type</label>
            <div className="flex gap-2 flex-wrap">
              {["link", "pdf", "video", "doc", "map_template"].map(t => (
                <button key={t} onClick={() => setItemType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    itemType === t
                      ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                      : "bg-white/5 text-dark-300 border border-white/10 hover:bg-white/10"
                  }`}>
                  {fileTypeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Upload mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setUploadMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
                uploadMode === "url" ? "bg-white/10 text-dark-100" : "text-dark-400 hover:text-dark-100"
              }`}>
              <LinkIcon className="w-3.5 h-3.5" /> URL
            </button>
            {itemType !== "map_template" && (
              <button onClick={() => setUploadMode("file")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
                  uploadMode === "file" ? "bg-white/10 text-dark-100" : "text-dark-400 hover:text-dark-100"
                }`}>
                <Upload className="w-3.5 h-3.5" /> File Upload
              </button>
            )}
          </div>

          {/* URL input or File drop zone */}
          {uploadMode === "url" ? (
            <div>
              <input type="url" placeholder={itemType === "map_template" ? "Map ID or share code" : "https://..."}
                value={itemUrl} onChange={e => setItemUrl(e.target.value)} className="glass-input w-full" />
            </div>
          ) : (
            <div
              ref={dropRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? "border-accent-purple bg-accent-purple/5"
                  : "border-white/10 hover:border-white/20"
              }`}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.png,.jpg,.jpeg,.docx,.pptx";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    setUploadFile(file);
                    if (!itemTitle) setItemTitle(file.name.replace(/\.[^/.]+$/, ""));
                  }
                };
                input.click();
              }}
            >
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-accent-purple" />
                  <div className="text-left">
                    <p className="text-sm text-dark-100">{uploadFile.name}</p>
                    <p className="text-xs text-dark-400">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                    className="p-1 hover:bg-red-500/10 rounded text-dark-400 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                  <p className="text-sm text-dark-300">Drag & drop a file here, or click to browse</p>
                  <p className="text-xs text-dark-400 mt-1">PDF, DOCX, PPTX, PNG, JPG (max 20MB)</p>
                </>
              )}
            </div>
          )}

          {/* Unlock Date */}
          <div>
            <label className="text-xs text-dark-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Unlock Date (optional)
            </label>
            <input type="datetime-local" value={itemUnlockDate}
              onChange={e => setItemUnlockDate(e.target.value)}
              className="glass-input w-full" />
            {itemUnlockDate && (
              <p className="text-xs text-amber-400 mt-1">
                Students won&apos;t see this resource until {new Date(itemUnlockDate).toLocaleString()}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowAddItem(null); resetItemForm(); }}
              className="px-4 py-2 text-sm text-dark-300 hover:text-dark-100 hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleAddItem} disabled={loading || !itemTitle.trim()}
              className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              <span className="relative z-10">{loading ? "Uploading..." : "Add Resource"}</span>
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
