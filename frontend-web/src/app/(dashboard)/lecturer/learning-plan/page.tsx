"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, Sparkles, Download, ChevronRight, ChevronDown,
  Trash2, RefreshCw, CheckCircle2, AlertCircle, X, Plus, Minus, Edit3, Save,
  FileText, Clock, BookOpen,
} from "lucide-react";
import clsx from "clsx";
import {
  clpApi, CLPUploadResponse, CLPWeekData, CLPUploadMetadata,
  CLPGroupAttendance, CLPSessionDraft, CLPDraftListItem, CLPGenerateProgress,
} from "@/lib/api";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Configure", icon: FileSpreadsheet },
  { label: "Generate", icon: Sparkles },
  { label: "Download", icon: Download },
];

const EXCEPTION_LABELS = [
  "CUTI PERTENGAHAN SEMESTER IPG",
  "MINGGU ULANGKAJI",
  "PEPERIKSAAN AKHIR",
  "CUTI AKHIR SEMESTER IPG",
];

function isExceptionWeek(topik: string) {
  const t = topik.trim().toUpperCase();
  return EXCEPTION_LABELS.some((l) => t.includes(l) || l.includes(t));
}

export default function LearningPlanPage() {
  const { user } = useAuth();

  // Stepper
  const [step, setStep] = useState(0);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState("");
  const [metadata, setMetadata] = useState<CLPUploadMetadata | null>(null);
  const [weeks, setWeeks] = useState<CLPWeekData[]>([]);

  // Configure state
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [detailLevel, setDetailLevel] = useState<"normal" | "terperinci">("normal");
  const [kumpulanList, setKumpulanList] = useState<CLPGroupAttendance[]>([
    { nama: "Kumpulan A", jumlah_pelajar: 23, kehadiran: 23 },
  ]);
  const [tarikh, setTarikh] = useState("");

  // Generate state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<CLPGenerateProgress | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<CLPSessionDraft | null>(null);
  const [generateError, setGenerateError] = useState("");

  // Review/Edit state
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<CLPWeekData | null>(null);

  // Download state
  const [downloadWeeks, setDownloadWeeks] = useState<number[]>([]);
  const [downloadFormat, setDownloadFormat] = useState<"xlsx" | "zip">("xlsx");
  const [downloading, setDownloading] = useState(false);

  // Drafts
  const [drafts, setDrafts] = useState<CLPDraftListItem[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // Load saved drafts
  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const list = await clpApi.listDrafts();
      setDrafts(list);
    } catch {
      /* ignore */
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadDrafts();
  }, [user, loadDrafts]);

  // ── Upload handler ──
  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|pdf)$/i)) {
      setUploadError("Please upload .xlsx or .pdf files only.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const res: CLPUploadResponse = await clpApi.upload(file);
      setSessionId(res.session_id);
      setMetadata(res.metadata);
      setWeeks(res.weeks);
      // Auto-select non-exception weeks
      const selectable = res.weeks
        .filter((w) => w.topik && !isExceptionWeek(w.topik))
        .map((w) => w.minggu);
      setSelectedWeeks(selectable);
      setDownloadWeeks(selectable);
      setStep(1);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  // ── Resume draft ──
  const resumeDraft = async (sid: string) => {
    try {
      const draft = await clpApi.getDraft(sid);
      setSessionId(draft.session_id);
      setMetadata(draft.metadata);
      setWeeks(draft.weeks);
      setKumpulanList(draft.kumpulan_list?.length ? draft.kumpulan_list : kumpulanList);
      setTarikh(draft.tarikh || "");
      const hasEnriched = draft.weeks.some((w) => w.hasil_pembelajaran);
      if (hasEnriched) {
        setGeneratedDraft(draft);
        const selectable = draft.weeks
          .filter((w) => w.topik && !isExceptionWeek(w.topik))
          .map((w) => w.minggu);
        setSelectedWeeks(selectable);
        setDownloadWeeks(selectable);
        setStep(3);
      } else {
        const selectable = draft.weeks
          .filter((w) => w.topik && !isExceptionWeek(w.topik))
          .map((w) => w.minggu);
        setSelectedWeeks(selectable);
        setDownloadWeeks(selectable);
        setStep(1);
      }
      setShowDrafts(false);
    } catch {
      setUploadError("Failed to load draft.");
    }
  };

  const deleteDraft = async (sid: string) => {
    try {
      await clpApi.deleteDraft(sid);
      setDrafts((prev) => prev.filter((d) => d.session_id !== sid));
    } catch {
      /* ignore */
    }
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!sessionId || selectedWeeks.length === 0) return;
    setGenerating(true);
    setGenerateError("");
    setProgress(null);
    try {
      await clpApi.generate(
        {
          session_id: sessionId,
          tarikh,
          kumpulan_list: kumpulanList,
          selected_weeks: selectedWeeks,
          nama_kursus: metadata?.nama_kursus,
          kod_kursus: metadata?.kod_kursus,
          pensyarah: metadata?.pensyarah,
          detail_level: detailLevel,
        },
        (prog) => setProgress(prog),
        (draft) => {
          setGeneratedDraft(draft);
          setWeeks(draft.weeks);
          setStep(3);
        },
        (err) => setGenerateError(err),
      );
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Edit week ──
  const startEdit = (week: CLPWeekData) => {
    setEditingWeek(week.minggu);
    setEditBuffer({ ...week });
  };

  const saveEdit = async () => {
    if (!editBuffer || !generatedDraft) return;
    const updatedWeeks = generatedDraft.weeks.map((w) =>
      w.minggu === editBuffer.minggu ? editBuffer : w,
    );
    try {
      const updated = await clpApi.updateDraft(sessionId, { weeks: updatedWeeks });
      setGeneratedDraft(updated);
      setWeeks(updated.weeks);
      setEditingWeek(null);
      setEditBuffer(null);
    } catch {
      /* ignore */
    }
  };

  // ── Download ──
  const handleDownload = async () => {
    if (downloadWeeks.length === 0) return;
    setDownloading(true);
    try {
      const blob = await clpApi.download({
        session_id: sessionId,
        selected_weeks: downloadWeeks,
        format: downloadFormat,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = downloadFormat === "xlsx" ? "xlsx" : "zip";
      a.download = `RPP_${metadata?.kod_kursus || "Output"}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // ── Toggle helpers ──
  const toggleWeek = (minggu: number, list: number[], setter: (v: number[]) => void) => {
    setter(list.includes(minggu) ? list.filter((w) => w !== minggu) : [...list, minggu]);
  };

  const toggleAll = (available: number[], list: number[], setter: (v: number[]) => void) => {
    setter(list.length === available.length ? [] : [...available]);
  };

  // ── Reset ──
  const resetAll = () => {
    setStep(0);
    setSessionId("");
    setMetadata(null);
    setWeeks([]);
    setSelectedWeeks([]);
    setGeneratedDraft(null);
    setProgress(null);
    setGenerateError("");
    setUploadError("");
    setDownloadWeeks([]);
  };

  const enrichableWeeks = weeks.filter((w) => w.topik && !isExceptionWeek(w.topik));
  const reviewWeeks = generatedDraft?.weeks || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Course Learning Plan</h1>
          <p className="text-dark-300 text-sm mt-1">
            AI-powered weekly teaching plan generator (RPP Mingguan)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowDrafts(!showDrafts); if (!showDrafts) loadDrafts(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-dark-200 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <Clock className="w-4 h-4" />
            Saved Drafts
          </button>
          {step > 0 && (
            <button
              onClick={resetAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-dark-200 hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              New Plan
            </button>
          )}
        </div>
      </motion.div>

      {/* Stepper */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="glass-card p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={clsx(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                      active
                        ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white"
                        : done
                          ? "bg-accent-emerald/20 text-accent-emerald"
                          : "bg-white/5 text-dark-400",
                    )}
                  >
                    {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={clsx(
                      "text-sm font-medium hidden sm:block",
                      active ? "text-white" : done ? "text-accent-emerald" : "text-dark-400",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={clsx(
                      "flex-1 h-px mx-3",
                      i < step ? "bg-accent-emerald/40" : "bg-white/10",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Saved Drafts Panel */}
      <AnimatePresence>
        {showDrafts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">Saved Drafts</h3>
                <button onClick={() => setShowDrafts(false)}>
                  <X className="w-4 h-4 text-dark-400 hover:text-white" />
                </button>
              </div>
              {loadingDrafts ? (
                <p className="text-dark-400 text-sm">Loading...</p>
              ) : drafts.length === 0 ? (
                <p className="text-dark-400 text-sm">No saved drafts yet.</p>
              ) : (
                <div className="space-y-2">
                  {drafts.map((d) => (
                    <div
                      key={d.session_id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <button
                        onClick={() => resumeDraft(d.session_id)}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm text-white font-medium">
                          {d.nama_kursus || "Untitled"}{" "}
                          {d.kod_kursus && (
                            <span className="text-dark-400">({d.kod_kursus})</span>
                          )}
                        </p>
                        <p className="text-xs text-dark-400">
                          {d.week_count} weeks
                          {d.updated_at && ` \u00b7 ${new Date(d.updated_at).toLocaleDateString()}`}
                        </p>
                      </button>
                      <button
                        onClick={() => deleteDraft(d.session_id)}
                        className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 0: Upload ── */}
      {step === 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={clsx(
              "glass-card p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer border-2 border-dashed",
              dragOver
                ? "border-accent-purple bg-accent-purple/5"
                : "border-white/10 hover:border-white/20",
            )}
            onClick={() => document.getElementById("clp-file-input")?.click()}
          >
            <input
              id="clp-file-input"
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="hidden"
              onChange={onFileInput}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-accent-purple" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Upload Syllabus File
            </h3>
            <p className="text-dark-300 text-sm mb-4 max-w-md">
              Drag & drop your syllabus file (.xlsx or .pdf) here, or click to browse.
              The AI will extract course metadata and weekly topics.
            </p>
            {uploading && (
              <div className="flex items-center gap-2 text-accent-purple">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Extracting data...</span>
              </div>
            )}
            {uploadError && (
              <div className="flex items-center gap-2 text-red-400 mt-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{uploadError}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Step 1: Configure ── */}
      {step === 1 && metadata && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="space-y-4">
          {/* Metadata */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-purple" />
              Course Metadata
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "Course Name", key: "nama_kursus" as const },
                { label: "Course Code", key: "kod_kursus" as const },
                { label: "Lecturer", key: "pensyarah" as const },
                { label: "Program", key: "program" as const },
                { label: "Semester", key: "semester" as const },
                { label: "Year", key: "tahun" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-dark-400 mb-1 block">{label}</label>
                  <input
                    className="glass-input w-full text-sm"
                    value={metadata[key] || ""}
                    onChange={(e) =>
                      setMetadata({ ...metadata, [key]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Group attendance */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Groups (Kumpulan)</h3>
              <button
                onClick={() =>
                  setKumpulanList([
                    ...kumpulanList,
                    { nama: `Kumpulan ${String.fromCharCode(65 + kumpulanList.length)}`, jumlah_pelajar: 23, kehadiran: 23 },
                  ])
                }
                className="flex items-center gap-1 text-xs text-accent-purple hover:text-accent-blue transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Group
              </button>
            </div>
            {kumpulanList.map((g, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  className="glass-input flex-1 text-sm"
                  value={g.nama}
                  onChange={(e) => {
                    const copy = [...kumpulanList];
                    copy[i] = { ...copy[i], nama: e.target.value };
                    setKumpulanList(copy);
                  }}
                  placeholder="Group name"
                />
                <input
                  type="number"
                  className="glass-input w-20 text-sm text-center"
                  value={g.jumlah_pelajar}
                  onChange={(e) => {
                    const copy = [...kumpulanList];
                    copy[i] = { ...copy[i], jumlah_pelajar: parseInt(e.target.value) || 0 };
                    setKumpulanList(copy);
                  }}
                  placeholder="Students"
                />
                {kumpulanList.length > 1 && (
                  <button
                    onClick={() => setKumpulanList(kumpulanList.filter((_, j) => j !== i))}
                    className="text-dark-400 hover:text-red-400"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Week selection */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Select Weeks to Generate</h3>
              <button
                onClick={() => toggleAll(enrichableWeeks.map((w) => w.minggu), selectedWeeks, setSelectedWeeks)}
                className="text-xs text-accent-purple hover:text-accent-blue transition-colors"
              >
                {selectedWeeks.length === enrichableWeeks.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {weeks.map((w) => {
                const exception = isExceptionWeek(w.topik);
                const selected = selectedWeeks.includes(w.minggu);
                return (
                  <button
                    key={w.minggu}
                    disabled={exception}
                    onClick={() => toggleWeek(w.minggu, selectedWeeks, setSelectedWeeks)}
                    className={clsx(
                      "p-3 rounded-xl text-left text-sm transition-all",
                      exception
                        ? "bg-white/5 text-dark-500 cursor-not-allowed"
                        : selected
                          ? "bg-accent-purple/20 border border-accent-purple/40 text-white"
                          : "bg-white/5 hover:bg-white/10 text-dark-200",
                    )}
                  >
                    <span className="font-medium">Minggu {w.minggu}</span>
                    <p className="text-xs text-dark-400 truncate mt-1">{w.topik || "-"}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail level & generate */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-white font-semibold">AI Detail Level</h3>
            <div className="flex gap-3">
              {(["normal", "terperinci"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDetailLevel(level)}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    detailLevel === level
                      ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white"
                      : "bg-white/5 text-dark-300 hover:bg-white/10",
                  )}
                >
                  {level === "normal" ? "Normal" : "Detailed (Terperinci)"}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setStep(2); handleGenerate(); }}
              disabled={selectedWeeks.length === 0}
              className="btn-gradient w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Generate {selectedWeeks.length} Week{selectedWeeks.length > 1 ? "s" : ""}
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Step 2: Generating ── */}
      {step === 2 && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <div className="glass-card p-8 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent-purple animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Generating Content...</h3>
              <p className="text-dark-300 text-sm">
                AI is creating learning outcomes, teaching strategies, and reflections.
              </p>
            </div>
            {progress && (
              <div className="w-full max-w-md space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-300">
                    Week {progress.minggu}: {progress.topik?.slice(0, 40)}
                    {(progress.topik?.length || 0) > 40 ? "..." : ""}
                  </span>
                  <span className="text-accent-purple">
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
            {generateError && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{generateError}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Step 3: Review + Download ── */}
      {step === 3 && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="space-y-4">
          {/* Review table */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent-purple" />
              Review Generated Content
            </h3>
            <div className="space-y-2">
              {reviewWeeks.map((w) => {
                const exception = isExceptionWeek(w.topik);
                const expanded = expandedWeek === w.minggu;
                const editing = editingWeek === w.minggu;
                return (
                  <div key={w.minggu} className="rounded-xl bg-white/5 overflow-hidden">
                    <button
                      onClick={() => setExpandedWeek(expanded ? null : w.minggu)}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                            exception
                              ? "bg-amber-500/20 text-amber-400"
                              : w.hasil_pembelajaran
                                ? "bg-accent-emerald/20 text-accent-emerald"
                                : "bg-white/10 text-dark-400",
                          )}
                        >
                          {w.minggu}
                        </span>
                        <div className="text-left">
                          <p className="text-sm text-white font-medium">{w.topik || "-"}</p>
                          {w.tarikh && <p className="text-xs text-dark-400">{w.tarikh}</p>}
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-dark-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-dark-400" />
                      )}
                    </button>

                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3">
                            {!editing ? (
                              <>
                                {w.hasil_pembelajaran && (
                                  <ContentBlock
                                    label="Hasil Pembelajaran"
                                    content={w.hasil_pembelajaran}
                                  />
                                )}
                                {w.strategi_aktiviti && (
                                  <ContentBlock
                                    label="Strategi / Aktiviti"
                                    content={w.strategi_aktiviti}
                                  />
                                )}
                                {w.refleksi && (
                                  <ContentBlock label="Refleksi Kuliah" content={w.refleksi} />
                                )}
                                {w.refleksi_tutorial && (
                                  <ContentBlock
                                    label="Refleksi Tutorial"
                                    content={w.refleksi_tutorial}
                                  />
                                )}
                                {w.refleksi_epembelajaran && (
                                  <ContentBlock
                                    label="Refleksi E-Pembelajaran"
                                    content={w.refleksi_epembelajaran}
                                  />
                                )}
                                {!exception && (
                                  <button
                                    onClick={() => startEdit(w)}
                                    className="flex items-center gap-1 text-xs text-accent-purple hover:text-accent-blue transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" /> Edit
                                  </button>
                                )}
                              </>
                            ) : (
                              editBuffer && (
                                <div className="space-y-3">
                                  {(
                                    [
                                      { key: "hasil_pembelajaran" as const, label: "Hasil Pembelajaran" },
                                      { key: "strategi_aktiviti" as const, label: "Strategi / Aktiviti" },
                                      { key: "refleksi" as const, label: "Refleksi Kuliah" },
                                      { key: "refleksi_tutorial" as const, label: "Refleksi Tutorial" },
                                      { key: "refleksi_epembelajaran" as const, label: "Refleksi E-Pembelajaran" },
                                    ] as const
                                  ).map(({ key, label }) => (
                                    <div key={key}>
                                      <label className="text-xs text-dark-400 mb-1 block">{label}</label>
                                      <textarea
                                        className="glass-input w-full text-sm min-h-[80px]"
                                        value={editBuffer[key]}
                                        onChange={(e) =>
                                          setEditBuffer({ ...editBuffer, [key]: e.target.value })
                                        }
                                      />
                                    </div>
                                  ))}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={saveEdit}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium hover:bg-accent-emerald/30 transition-colors"
                                    >
                                      <Save className="w-3 h-3" /> Save
                                    </button>
                                    <button
                                      onClick={() => { setEditingWeek(null); setEditBuffer(null); }}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-dark-300 text-xs font-medium hover:bg-white/10 transition-colors"
                                    >
                                      <X className="w-3 h-3" /> Cancel
                                    </button>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download section */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Download className="w-4 h-4 text-accent-purple" />
              Download
            </h3>

            {/* Week selection for download */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-dark-400">Select weeks to include</label>
                <button
                  onClick={() => toggleAll(enrichableWeeks.map((w) => w.minggu), downloadWeeks, setDownloadWeeks)}
                  className="text-xs text-accent-purple hover:text-accent-blue transition-colors"
                >
                  {downloadWeeks.length === enrichableWeeks.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {enrichableWeeks.map((w) => {
                  const selected = downloadWeeks.includes(w.minggu);
                  return (
                    <button
                      key={w.minggu}
                      onClick={() => toggleWeek(w.minggu, downloadWeeks, setDownloadWeeks)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        selected
                          ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                          : "bg-white/5 text-dark-400 hover:bg-white/10",
                      )}
                    >
                      W{w.minggu}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format */}
            <div className="flex gap-3">
              {(["xlsx", "zip"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setDownloadFormat(fmt)}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    downloadFormat === fmt
                      ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white"
                      : "bg-white/5 text-dark-300 hover:bg-white/10",
                  )}
                >
                  {fmt === "xlsx" ? "Single Excel (.xlsx)" : "ZIP (per group)"}
                </button>
              ))}
            </div>

            <button
              onClick={handleDownload}
              disabled={downloadWeeks.length === 0 || downloading}
              className="btn-gradient w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                {downloading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating file...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download {downloadWeeks.length} Week{downloadWeeks.length > 1 ? "s" : ""}
                  </>
                )}
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ContentBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-accent-purple mb-1">{label}</p>
      <p className="text-sm text-dark-200 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}
