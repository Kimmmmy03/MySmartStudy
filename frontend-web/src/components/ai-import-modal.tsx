"use client";

import { useState } from "react";
import { aiImportApi, ImportPreview } from "@/lib/api";
import Modal from "@/components/ui/modal";
import { Globe, Download, Check, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AiImportModalProps {
  courseId: string;
  onClose: () => void;
  onImported: () => void;
}

type Step = "url" | "preview" | "result";

export default function AiImportModal({ courseId, onClose, onImported }: AiImportModalProps) {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ modules_created: number; items_created: number } | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  const toggleModule = (index: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handlePreview = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await aiImportApi.previewGoogleSites(url, courseId);
      setPreview(data);
      // Expand all modules by default
      setExpandedModules(new Set(data.modules.map((_, i) => i)));
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to preview site");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await aiImportApi.importGoogleSites(url, courseId);
      setResult({ modules_created: data.modules_created, items_created: data.items_created });
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import site");
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    onImported();
    onClose();
  };

  const totalItems = preview?.modules.reduce((sum, m) => sum + m.items.length, 0) ?? 0;

  return (
    <Modal open onClose={onClose} title="Import from Google Sites" maxWidth="max-w-lg">
      <AnimatePresence mode="wait">
        {/* Step 1: URL Input */}
        {step === "url" && (
          <motion.div
            key="url"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <p className="text-sm text-dark-300">
              Paste a Google Sites URL to import its content as course modules and resources.
            </p>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Google Sites URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    type="url"
                    placeholder="https://sites.google.com/..."
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handlePreview()}
                    className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={loading || !url.trim()}
                className="btn-gradient relative z-10 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Preview
                    </>
                  )}
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <p className="text-sm text-dark-300">
              Found <span className="text-white font-medium">{preview.modules.length}</span> module{preview.modules.length !== 1 ? "s" : ""} with{" "}
              <span className="text-white font-medium">{totalItems}</span> item{totalItems !== 1 ? "s" : ""}. Review and confirm import.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {preview.modules.map((mod, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleModule(idx)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{mod.title}</h4>
                      {mod.description && (
                        <p className="text-xs text-dark-400 truncate mt-0.5">{mod.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-xs text-dark-400">{mod.items.length} item{mod.items.length !== 1 ? "s" : ""}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-dark-400 transition-transform ${expandedModules.has(idx) ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedModules.has(idx) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-1 border-t border-white/5">
                          {mod.items.map((item, iIdx) => (
                            <div key={iIdx} className="flex items-center gap-2 py-1.5 text-xs">
                              <span className="px-1.5 py-0.5 bg-accent-purple/10 text-accent-purple rounded text-[10px] uppercase font-medium shrink-0">
                                {item.type}
                              </span>
                              <span className="text-dark-200 truncate">{item.title}</span>
                            </div>
                          ))}
                          {mod.items.length === 0 && (
                            <p className="text-xs text-dark-400 py-1">No items</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setStep("url"); setError(""); }}
                className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="btn-gradient relative z-10 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Confirm Import
                    </>
                  )}
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Result */}
        {step === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 text-center py-4"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Import Complete</h4>
              <p className="text-sm text-dark-300 mt-1">
                Created <span className="text-white font-medium">{result.modules_created}</span> module{result.modules_created !== 1 ? "s" : ""} with{" "}
                <span className="text-white font-medium">{result.items_created}</span> item{result.items_created !== 1 ? "s" : ""}.
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={handleDone}
                className="btn-gradient relative z-10 px-6 py-2.5 rounded-xl text-sm font-medium"
              >
                <span className="relative z-10">Done</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
