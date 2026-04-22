"use client";

import { useState, useEffect, useRef } from "react";
import { adminApi, HomepageContentOut } from "@/lib/api";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Edit3, Eye, EyeOff, Image as ImageIcon,
  Newspaper, GripVertical, Upload, X, ArrowUp, ArrowDown,
  Monitor, FileText, Maximize2,
} from "lucide-react";
import clsx from "clsx";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

// Backend may return image_url (snake_case) but TS interface expects imageUrl (camelCase)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getItemImage = (item: HomepageContentOut): string => item.imageUrl || (item as any).image_url || "";

export default function HomepageEditorPage() {
  const [items, setItems] = useState<HomepageContentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<HomepageContentOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "news", title: "", content: "", image_url: "" });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItem, setPreviewItem] = useState<HomepageContentOut | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadContent = async () => {
    setError("");
    try {
      const data = await adminApi.getHomepageContent();
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load homepage content";
      setError(msg);
    }
    setLoading(false);
  };

  useEffect(() => { loadContent(); }, []);

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await adminApi.createHomepageContent(form);
      setShowAdd(false);
      setForm({ type: "news", title: "", content: "", image_url: "" });
      setLocalPreviewUrl(null);
      await loadContent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add content");
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setSaving(true);
    setError("");
    try {
      await adminApi.updateHomepageContent(editItem.id, {
        type: form.type,
        title: form.title,
        content: form.content,
        image_url: form.image_url,
      });
      setEditItem(null);
      setForm({ type: "news", title: "", content: "", image_url: "" });
      setLocalPreviewUrl(null);
      await loadContent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update content");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError("");
    try {
      await adminApi.deleteHomepageContent(deleteTarget);
      setDeleteTarget(null);
      await loadContent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete content");
    }
  };

  const toggleVisibility = async (item: HomepageContentOut) => {
    try {
      await adminApi.updateHomepageContent(item.id, { visible: !item.visible });
      await loadContent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle visibility");
    }
  };

  const moveItem = async (item: HomepageContentOut, direction: "up" | "down") => {
    const idx = items.findIndex(i => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    try {
      await adminApi.updateHomepageContent(item.id, { order: items[swapIdx].order });
      await adminApi.updateHomepageContent(items[swapIdx].id, { order: item.order });
      await loadContent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reorder");
    }
  };

  // Local blob preview URL for the image just uploaded (shown instantly, no backend dependency)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local blob preview immediately
    setLocalPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setError("");
    try {
      const res = await adminApi.uploadHomepageImage(file);
      setForm(prev => ({ ...prev, image_url: res.image_url }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setLocalPreviewUrl(null);
    }
    setUploading(false);
  };

  const openEdit = (item: HomepageContentOut) => {
    setEditItem(item);
    setLocalPreviewUrl(null);
    setForm({
      type: item.type,
      title: item.title,
      content: item.content,
      image_url: getItemImage(item),
    });
  };

  const resolveImageUrl = (url: string) =>
    url.startsWith("/") ? `${BACKEND_URL}${url}` : url;

  // Poster preview component — mimics homepage carousel rendering (landscape)
  const PosterPreviewModal = ({ item }: { item: HomepageContentOut | null }) => {
    if (!item) return null;
    const rawImgUrl = getItemImage(item);
    const imgUrl = rawImgUrl ? resolveImageUrl(rawImgUrl) : "";
    const title = item.title;
    const content = item.content;

    return (
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Homepage Preview" maxWidth="max-w-6xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-dark-400 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> Preview — this is how it will appear on the homepage
            </p>
            <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium",
              item.type === "poster"
                ? "bg-accent-purple/15 text-accent-purple border border-accent-purple/20"
                : "bg-accent-blue/15 text-accent-blue border border-accent-blue/20"
            )}>{item.type}</span>
          </div>

          {/* Simulated homepage poster card — landscape */}
          <div className="rounded-2xl overflow-hidden border border-gray-200/50 dark:border-white/10 bg-white dark:bg-dark-800 shadow-lg shadow-black/10">
            <div className="h-[22rem] sm:h-[26rem] relative">
              <div className="flex flex-row h-full">
                {imgUrl ? (
                  <div className="w-1/2 h-full flex-shrink-0 bg-gray-100 dark:bg-dark-900">
                    <img src={imgUrl} alt={title}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ) : (
                  <div className="w-1/2 h-full flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-900 flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-300 dark:text-dark-600" />
                  </div>
                )}
                <div className="flex-1 p-8 sm:p-10 flex flex-col justify-center">
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">{title || "Untitled"}</h3>
                  {content && <p className="text-sm sm:text-base leading-relaxed text-gray-600 dark:text-dark-300">{content}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* News card preview — shown additionally for news type */}
          {item.type === "news" && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-900/50 border border-gray-200/50 dark:border-white/5">
              <p className="text-xs text-gray-400 dark:text-dark-500 mb-3">News card appearance:</p>
              <div className="rounded-xl overflow-hidden border border-gray-200/50 dark:border-white/10 bg-white dark:bg-dark-800 p-4 max-w-sm">
                {imgUrl && <img src={imgUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-3" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{title || "Untitled"}</h4>
                {content && <p className="text-xs text-gray-500 dark:text-dark-400 mt-1 line-clamp-3">{content}</p>}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1 border-t border-gray-200/50 dark:border-white/5">
            <button onClick={() => setShowPreview(false)}
              className="px-5 py-2 text-sm text-gray-500 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
              Close
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // Best available preview: local blob (instant) > backend URL (resolved)
  const previewImgSrc = localPreviewUrl || (form.image_url ? resolveImageUrl(form.image_url) : null);

  // Clear local preview when image is removed
  const clearImage = () => {
    setForm(p => ({ ...p, image_url: "" }));
    setLocalPreviewUrl(null);
  };

  const formImagePreview = previewImgSrc ? (
    <div className="relative rounded-xl overflow-hidden border border-gray-200/50 dark:border-white/10 mb-2 group">
      <img src={previewImgSrc}
        alt="Preview" className="w-full h-48 object-cover bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-800" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <button onClick={clearImage}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 transition-colors">
        <X className="w-4 h-4 text-white" />
      </button>
      <div className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded">
        Image attached
      </div>
    </div>
  ) : null;

  const renderContentForm = (onSubmit: () => void, submitLabel: string) => (
    <div className="flex gap-6">
      {/* Left: Form */}
      <div className="flex-1 space-y-4">
        {/* Type selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1.5">Content Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, type: "news" }))}
              className={clsx("flex items-center gap-2.5 p-3.5 rounded-xl border transition-all",
                form.type === "news"
                  ? "border-accent-blue bg-accent-blue/10 ring-1 ring-accent-blue/20"
                  : "border-gray-200/50 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-gray-50 dark:bg-white/3"
              )}>
              <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center",
                form.type === "news" ? "bg-accent-blue/20" : "bg-gray-100 dark:bg-white/5")}>
                <Newspaper className={clsx("w-5 h-5", form.type === "news" ? "text-accent-blue" : "text-gray-400 dark:text-dark-400")} />
              </div>
              <div className="text-left">
                <p className={clsx("text-sm font-medium", form.type === "news" ? "text-accent-blue" : "text-gray-600 dark:text-dark-200")}>News</p>
                <p className="text-[10px] text-gray-400 dark:text-dark-500">Article or announcement</p>
              </div>
            </button>
            <button type="button" onClick={() => setForm(p => ({ ...p, type: "poster" }))}
              className={clsx("flex items-center gap-2.5 p-3.5 rounded-xl border transition-all",
                form.type === "poster"
                  ? "border-accent-purple bg-accent-purple/10 ring-1 ring-accent-purple/20"
                  : "border-gray-200/50 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-gray-50 dark:bg-white/3"
              )}>
              <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center",
                form.type === "poster" ? "bg-accent-purple/20" : "bg-gray-100 dark:bg-white/5")}>
                <ImageIcon className={clsx("w-5 h-5", form.type === "poster" ? "text-accent-purple" : "text-gray-400 dark:text-dark-400")} />
              </div>
              <div className="text-left">
                <p className={clsx("text-sm font-medium", form.type === "poster" ? "text-accent-purple" : "text-gray-600 dark:text-dark-200")}>Poster</p>
                <p className="text-[10px] text-gray-400 dark:text-dark-500">Featured banner or image</p>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Title</label>
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="glass-input w-full px-4 py-2.5 text-sm" placeholder={form.type === "poster" ? "e.g. New Semester Registration Open" : "e.g. Important Announcement"} />
          <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">The headline displayed on the homepage</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Content</label>
          <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            className="glass-input w-full px-4 py-2.5 text-sm min-h-[100px] resize-y" placeholder="Enter description or body text..." />
          <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">Supporting text shown below the title</p>
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1">Image</label>
          <p className="text-[10px] text-gray-400 dark:text-dark-500 mb-2">
            {form.type === "poster"
              ? "Recommended: landscape image (16:9 ratio, at least 1200x675px) for best display in the carousel"
              : "Optional image to accompany the news article"}
          </p>
          {formImagePreview}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200/50 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-sm text-gray-600 dark:text-dark-200 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : (form.image_url || localPreviewUrl) ? "Change Image" : "Upload Image"}
            </button>
            {(form.image_url || localPreviewUrl) && (
              <button onClick={clearImage}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <X className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.svg,.webp,.gif,.bmp,.ico,.tiff,.heic,.heif,.avif" className="hidden" onChange={handleImageUpload} />
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-gray-200/50 dark:border-white/5">
          <button onClick={() => { setShowAdd(false); setEditItem(null); }}
            className="px-4 py-2.5 text-sm text-gray-500 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onSubmit} disabled={saving || !form.title.trim()}
              className="btn-gradient px-5 py-2.5 text-sm text-white rounded-xl relative z-10 disabled:opacity-50">
              <span className="relative z-10">{saving ? "Saving..." : submitLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Live Preview Panel */}
      <div className="w-[300px] flex-shrink-0 space-y-3">
        <p className="text-[10px] font-medium text-gray-400 dark:text-dark-500 uppercase tracking-wider">Live Preview</p>

        {form.type === "poster" ? (
          <div className="rounded-xl overflow-hidden border border-gray-200/50 dark:border-white/10 bg-white dark:bg-dark-800">
            <div className="h-64 relative">
              <div className="flex flex-col h-full">
                {previewImgSrc ? (
                  <div className="h-40 flex-shrink-0">
                    <img src={previewImgSrc} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-40 flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-800 flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-gray-300 dark:text-dark-600" />
                  </div>
                )}
                <div className="p-3 flex-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                    {form.title || "Poster Title"}
                  </h4>
                  {(form.content || !form.title) && (
                    <p className="text-[10px] text-gray-500 dark:text-dark-400 mt-1 line-clamp-2">
                      {form.content || "Description will appear here"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-gray-200/50 dark:border-white/10 bg-white dark:bg-dark-800 p-4">
            {previewImgSrc && (
              <img src={previewImgSrc} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-medium">news</span>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mt-2">
              {form.title || "News Title"}
            </h4>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1 line-clamp-3">
              {form.content || "News content will appear here"}
            </p>
          </div>
        )}

        <p className="text-[10px] text-gray-400 dark:text-dark-500 text-center">
          {form.type === "poster" ? "Poster slides in the homepage carousel" : "News card in the latest updates section"}
        </p>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Homepage Editor</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300 mt-1">Manage news and poster content displayed on the homepage</p>
        </div>
        <button onClick={() => { setShowAdd(true); setForm({ type: "news", title: "", content: "", image_url: "" }); setLocalPreviewUrl(null); }}
          className="btn-gradient px-4 py-2.5 rounded-xl text-sm text-white font-medium inline-flex items-center gap-2 relative z-10">
          <Plus className="w-4 h-4 relative z-10" />
          <span className="relative z-10">Add Content</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-accent-blue/20 border-t-accent-blue animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Newspaper className="w-12 h-12 text-gray-300 dark:text-dark-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-dark-300 mb-2">No homepage content yet</p>
          <p className="text-sm text-gray-400 dark:text-dark-400">Add news or poster images to display on the homepage</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <motion.div key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={clsx("glass-card p-4 flex flex-wrap sm:flex-nowrap items-start gap-3 sm:gap-4 transition-all group", !item.visible && "opacity-50")}>
              <div className="flex sm:flex-col gap-1 pt-1">
                <button onClick={() => moveItem(item, "up")} disabled={idx === 0}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition-colors">
                  <ArrowUp className="w-4 h-4 text-gray-400 dark:text-dark-400" />
                </button>
                <GripVertical className="w-4 h-4 text-gray-300 dark:text-dark-500 mx-auto hidden sm:block" />
                <button onClick={() => moveItem(item, "down")} disabled={idx === items.length - 1}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 transition-colors">
                  <ArrowDown className="w-4 h-4 text-gray-400 dark:text-dark-400" />
                </button>
              </div>

              {getItemImage(item) ? (
                <img src={resolveImageUrl(getItemImage(item))}
                  alt={item.title} className="hidden sm:block w-28 h-20 rounded-xl object-cover flex-shrink-0 border border-gray-200/50 dark:border-white/10"
                  onError={e => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="hidden sm:flex w-28 h-20 rounded-xl bg-gray-100 dark:bg-dark-700 items-center justify-center flex-shrink-0 border border-gray-200/50 dark:border-white/10">
                  {item.type === "poster" ? <ImageIcon className="w-6 h-6 text-gray-300 dark:text-dark-500" /> : <FileText className="w-6 h-6 text-gray-300 dark:text-dark-500" />}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium",
                    item.type === "news"
                      ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/20"
                      : "bg-accent-purple/15 text-accent-purple border border-accent-purple/20"
                  )}>
                    {item.type}
                  </span>
                  {!item.visible && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-500 text-gray-400 dark:text-dark-300 border border-gray-200/50 dark:border-white/5">Hidden</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{item.title}</h3>
                {item.content && <p className="text-xs text-gray-500 dark:text-dark-300 mt-1 line-clamp-2">{item.content}</p>}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-auto sm:ml-0">
                {/* Preview button */}
                <button onClick={() => { setPreviewItem(item); setShowPreview(true); }}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" title="Preview on homepage">
                  <Maximize2 className="w-4 h-4 text-gray-400 dark:text-dark-300" />
                </button>
                <button onClick={() => toggleVisibility(item)}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" title={item.visible ? "Hide" : "Show"}>
                  {item.visible ? <Eye className="w-4 h-4 text-gray-400 dark:text-dark-300" /> : <EyeOff className="w-4 h-4 text-gray-400 dark:text-dark-400" />}
                </button>
                <button onClick={() => openEdit(item)}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" title="Edit">
                  <Edit3 className="w-4 h-4 text-gray-400 dark:text-dark-300" />
                </button>
                <button onClick={() => setDeleteTarget(item.id)}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4 text-gray-400 dark:text-dark-400 hover:text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Modal — Landscape with preview */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Homepage Content" maxWidth="max-w-3xl">
        {renderContentForm(handleAdd, "Add Content")}
      </Modal>

      {/* Edit Modal — Landscape with preview */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Content" maxWidth="max-w-3xl">
        {renderContentForm(handleUpdate, "Save Changes")}
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Content">
        <p className="text-sm text-gray-600 dark:text-dark-200 mb-4">Are you sure you want to delete this content? This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-500 dark:text-dark-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">Delete</button>
        </div>
      </Modal>

      {/* Homepage Preview Modal */}
      <PosterPreviewModal item={previewItem} />
    </motion.div>
  );
}
