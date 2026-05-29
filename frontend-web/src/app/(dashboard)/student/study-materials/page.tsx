"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { aiStudyMaterialsApi, StudyMaterial } from "@/lib/api";
import Modal from "@/components/ui/modal";
import SummaryViewer from "@/components/ai-study-materials/summary-viewer";
import FlashcardViewer from "@/components/ai-study-materials/flashcard-viewer";
import PracticeQuiz from "@/components/ai-study-materials/practice-quiz";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, FileText, Layers, HelpCircle, Trash2, BookOpen, Loader2,
  UploadCloud, X, Search, Filter,
} from "lucide-react";

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: typeof FileText }> = {
  summary:    { label: "Summary",    color: "text-accent-cyan",   bg: "bg-accent-cyan/10",   icon: FileText },
  flashcards: { label: "Flashcards", color: "text-accent-purple", bg: "bg-accent-purple/10", icon: Layers },
  quiz:       { label: "Quiz",       color: "text-accent-pink",   bg: "bg-accent-pink/10",   icon: HelpCircle },
};

const GEN_TYPES: { type: "summary" | "flashcards" | "quiz"; label: string; desc: string; icon: typeof FileText }[] = [
  { type: "summary",    label: "Summary Notes", desc: "Concise notes with key concepts", icon: FileText },
  { type: "flashcards", label: "Flashcards",    desc: "10–15 Q&A cards for revision",     icon: Layers },
  { type: "quiz",       label: "Practice Quiz", desc: "MCQ & true/false questions",       icon: HelpCircle },
];

const FILTERS = ["all", "summary", "flashcards", "quiz"] as const;

export default function StudyMaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Upload + generate state
  const [file, setFile] = useState<File | null>(null);
  const [genType, setGenType] = useState<typeof GEN_TYPES[number]["type"]>("summary");
  const [customTitle, setCustomTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz attempt history
  const [quizAttempts, setQuizAttempts] = useState<{ id: string; score: number; total: number; percentage: number; createdAt: string }[]>([]);

  // List filter
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await aiStudyMaterialsApi.list();
        setMaterials(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await aiStudyMaterialsApi.delete(id);
      setMaterials(prev => prev.filter(m => m.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const handleFilePicked = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are supported.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      alert("PDF must be under 20MB.");
      return;
    }
    setFile(f);
    if (!customTitle) setCustomTitle(f.name.replace(/\.pdf$/i, ""));
  };

  const handleGenerate = async () => {
    if (!file || generating) return;
    setGenerating(true);
    try {
      const result = await aiStudyMaterialsApi.generateFromUpload(file, genType, customTitle);
      setMaterials(prev => [result, ...prev.filter(m => m.id !== result.id)]);
      openMaterial(result);
      setFile(null);
      setCustomTitle("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter(m => {
      if (filter !== "all" && m.type !== filter) return false;
      if (!q) return true;
      return m.title.toLowerCase().includes(q);
    });
  }, [materials, search, filter]);

  const grouped = useMemo(() => {
    const uploaded: StudyMaterial[] = [];
    const byCourse = new Map<string, StudyMaterial[]>();
    for (const m of filtered) {
      if (m.course_id === "uploaded" || !m.course_id) {
        uploaded.push(m);
      } else {
        if (!byCourse.has(m.course_id)) byCourse.set(m.course_id, []);
        byCourse.get(m.course_id)!.push(m);
      }
    }
    return { uploaded, byCourse };
  }, [filtered]);

  const openMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material);
    if (material.type === "quiz") {
      aiStudyMaterialsApi.listQuizAttempts(material.id).then(setQuizAttempts).catch(() => setQuizAttempts([]));
    } else {
      setQuizAttempts([]);
    }
  };

  const handleQuizComplete = async (score: number, total: number, percentage: number) => {
    if (!selectedMaterial) return;
    try {
      const attempt = await aiStudyMaterialsApi.saveQuizAttempt(selectedMaterial.id, { score, total, percentage });
      setQuizAttempts(prev => [attempt, ...prev]);
    } catch {
      // silent fail
    }
  };

  const renderViewer = (material: StudyMaterial) => {
    switch (material.type) {
      case "summary":    return <SummaryViewer content={material.content} />;
      case "flashcards": return <FlashcardViewer content={material.content} />;
      case "quiz":       return <PracticeQuiz content={material.content} onComplete={handleQuizComplete} attempts={quizAttempts} />;
      default:           return <SummaryViewer content={material.content} />;
    }
  };

  /** Provenance banner shown above the viewer — tells the student whether the
   *  content came from their course notes, academic literature, or AI general
   *  knowledge (and whether the citations were verified). */
  const renderProvenanceBanner = (material: StudyMaterial) => {
    const tier = material.evidence_tier;
    if (!tier) return null;
    const isCourse = tier === "course";
    const isOnline = tier === "online";
    const styles = isCourse
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : isOnline
        ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
        : "border-amber-500/30 bg-amber-500/10 text-amber-100";
    const heading = isCourse
      ? "🎓 Generated from your lecturer's course notes"
      : isOnline
        ? "⚠️ NOT from your course notes — sourced from academic literature (last 6 years)"
        : "⚠️ NOT from your course notes — AI-generated with cited references";
    const cites = material.citations || [];
    return (
      <div className={`mb-4 rounded-2xl border ${styles} p-3 text-sm`}>
        <p className="font-semibold mb-1">{heading}</p>
        {cites.length > 0 && (
          <ul className="space-y-0.5 text-[12px] leading-relaxed">
            {cites.slice(0, 5).map((c, i) => {
              const head = `${c.authors || "Unknown"} (${c.year ?? "n.d."}). ${c.title || ""}.`;
              const venue = c.venue ? ` ${c.venue}.` : "";
              const unverified = !isCourse && tier === "general_knowledge" && c.verified === false;
              return (
                <li key={i} className="opacity-90">
                  – {c.url ? <a className="underline hover:opacity-80" href={c.url} target="_blank" rel="noopener noreferrer">{head}</a> : head}
                  {venue}
                  {unverified && <span className="ml-1 text-amber-300">(unverified)</span>}
                </li>
              );
            })}
          </ul>
        )}
        {tier === "general_knowledge" && (
          <p className="mt-1 text-[11px] opacity-80">Please verify each citation before relying on it.</p>
        )}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="w-6 h-6 text-accent-blue" />
        <h1 className="text-2xl font-bold text-white">Study Materials</h1>
      </div>
      <p className="text-sm text-dark-400 mb-6">
        Upload a PDF or use your course resources to instantly generate notes, flashcards, quizzes, and mind maps.
      </p>

      {/* Generator panel */}
      <div className="glass-card p-5 mb-8">
        <h2 className="text-sm font-semibold text-dark-100 mb-3 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-accent-blue" />
          Generate from a PDF
        </h2>

        <div className="grid md:grid-cols-5 gap-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFilePicked(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`md:col-span-2 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-accent-blue bg-accent-blue/5"
                : file
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/10 hover:border-white/20 hover:bg-white/3"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFilePicked(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3 text-left">
                <FileText className="w-8 h-8 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-dark-100 truncate">{file.name}</p>
                  <p className="text-xs text-dark-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setCustomTitle(""); }}
                  className="p-1 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                <p className="text-sm text-dark-200">Drag & drop a PDF here</p>
                <p className="text-xs text-dark-400 mt-1">or click to browse &middot; max 20MB</p>
              </>
            )}
          </div>

          {/* Type + Title + Action */}
          <div className="md:col-span-3 space-y-3">
            <div>
              <label className="text-xs text-dark-300 mb-1.5 block">Output type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GEN_TYPES.map(t => {
                  const Icon = t.icon;
                  const active = genType === t.type;
                  return (
                    <button
                      key={t.type}
                      onClick={() => setGenType(t.type)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-colors ${
                        active
                          ? "bg-accent-blue/15 border-accent-blue/40 text-accent-blue"
                          : "bg-white/3 border-white/5 text-dark-300 hover:bg-white/5"
                      }`}
                      title={t.desc}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-dark-300 mb-1.5 block">Title (optional)</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Derived from filename if empty"
                  className="glass-input w-full px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={!file || generating}
                className="btn-gradient relative z-10 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Library header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-dark-100">Your Library</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="glass-input pl-9 pr-3 py-2 text-sm w-full sm:w-56"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-dark-400" />
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/30"
                    : "bg-white/5 text-dark-300 border border-white/5 hover:bg-white/10"
                }`}
              >
                {f === "all" ? "All" : TYPE_META[f]?.label || f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 w-24 bg-white/10 rounded mb-3" />
              <div className="h-5 w-48 bg-white/10 rounded mb-2" />
              <div className="h-3 w-20 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BookOpen className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-300 text-lg font-medium mb-1">No study materials yet</p>
          <p className="text-dark-400 text-sm">Upload a PDF above or generate from a course resource.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Search className="w-8 h-8 text-dark-500 mx-auto mb-2" />
          <p className="text-dark-400 text-sm">No materials match your search or filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.uploaded.length > 0 && (
            <Section title="Uploaded PDFs" items={grouped.uploaded} onOpen={openMaterial} onDelete={handleDelete} deleting={deleting} />
          )}
          {Array.from(grouped.byCourse.entries()).map(([cid, items]) => (
            <Section
              key={cid}
              title={`Course · ${cid.slice(0, 8)}`}
              items={items}
              onOpen={openMaterial}
              onDelete={handleDelete}
              deleting={deleting}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
        title={selectedMaterial?.title || ""}
        maxWidth="max-w-3xl"
      >
        {selectedMaterial && (
          <>
            {renderProvenanceBanner(selectedMaterial)}
            {renderViewer(selectedMaterial)}
          </>
        )}
      </Modal>
    </motion.div>
  );
}

function Section({
  title, items, onOpen, onDelete, deleting,
}: {
  title: string;
  items: StudyMaterial[];
  onOpen: (m: StudyMaterial) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-dark-300 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {items.map(material => {
            const meta = TYPE_META[material.type] || TYPE_META.summary;
            const Icon = meta.icon;
            return (
              <motion.div
                key={material.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -2 }}
                className="glass-card p-4 cursor-pointer hover:border-white/10 transition-colors group"
                onClick={() => onOpen(material)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{meta.label}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(material.id); }}
                    disabled={deleting === material.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/5 transition-all"
                  >
                    {deleting === material.id
                      ? <Loader2 className="w-4 h-4 text-dark-400 animate-spin" />
                      : <Trash2 className="w-4 h-4 text-dark-400 hover:text-red-400" />}
                  </button>
                </div>
                <h3 className="text-sm font-medium text-white mb-1 line-clamp-2">{material.title}</h3>
                <p className="text-xs text-dark-400">
                  {new Date(material.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
