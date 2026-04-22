"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, RefreshCw, Loader2, UserCircle, Pencil, Plus, Trash2, Users, FileText } from "lucide-react";
import { mapsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface HistoryEntry {
  id: string;
  map_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  summary: string;
  created_at: string;
}

interface HistoryPanelProps {
  mapId: string | null;
  open: boolean;
  onClose: () => void;
}

function actionIcon(action: string) {
  switch (action) {
    case "created": return <Plus className="w-3.5 h-3.5 text-emerald-400" />;
    case "edited": return <Pencil className="w-3.5 h-3.5 text-accent-blue" />;
    case "deleted": return <Trash2 className="w-3.5 h-3.5 text-red-400" />;
    case "collaborator_added": return <Users className="w-3.5 h-3.5 text-accent-purple" />;
    case "collaborator_removed": return <Users className="w-3.5 h-3.5 text-amber-400" />;
    default: return <FileText className="w-3.5 h-3.5 text-dark-300" />;
  }
}

function actionColor(action: string) {
  switch (action) {
    case "created": return "border-emerald-500/30 bg-emerald-500/5";
    case "edited": return "border-accent-blue/30 bg-accent-blue/5";
    case "deleted": return "border-red-500/30 bg-red-500/5";
    case "collaborator_added": return "border-accent-purple/30 bg-accent-purple/5";
    case "collaborator_removed": return "border-amber-500/30 bg-amber-500/5";
    default: return "border-white/10 bg-white/5";
  }
}

export default function HistoryPanel({ mapId, open, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!mapId) return;
    setLoading(true);
    try {
      const data = await mapsApi.getHistory(mapId, 50);
      setEntries(data);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [mapId]);

  useEffect(() => {
    if (open && mapId) loadHistory();
  }, [open, mapId, loadHistory]);

  // Group entries by date
  const grouped = entries.reduce<Record<string, HistoryEntry[]>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full border-l border-white/5 bg-dark-800/90 overflow-hidden flex-shrink-0"
        >
          <div className="w-[320px] h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-accent-blue" />
                <h3 className="text-sm font-semibold text-white">History</h3>
                <span className="text-[10px] text-dark-400 bg-white/5 px-1.5 py-0.5 rounded-full">
                  {entries.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={loadHistory}
                  disabled={loading}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-dark-400 hover:text-white transition-colors"
                  title="Refresh"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-dark-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading && entries.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-dark-400" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <History className="w-8 h-8 mx-auto mb-2 text-dark-500" />
                  <p className="text-sm text-dark-400">No history yet</p>
                  <p className="text-xs text-dark-500 mt-1">Changes will appear here as you edit</p>
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {Object.entries(grouped).map(([date, dateEntries]) => (
                    <div key={date}>
                      <div className="sticky top-0 bg-dark-800/90 backdrop-blur-sm z-10 pb-2">
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">
                          {date}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {dateEntries.map((entry, i) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className={`rounded-xl p-3 border ${actionColor(entry.action)} transition-colors`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                {actionIcon(entry.action)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white leading-snug">
                                  {entry.summary}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="flex items-center gap-1 text-dark-400">
                                    <UserCircle className="w-3 h-3" />
                                    <span className="text-[10px] truncate max-w-[120px]">
                                      {entry.user_name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-dark-500">
                                    {new Date(entry.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
