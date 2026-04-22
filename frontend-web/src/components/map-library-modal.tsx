"use client";

import { useState, useEffect } from "react";
import { mapsApi, type MapOut } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { X, Map, Check } from "lucide-react";

interface MapLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mapId: string, mapTitle: string) => void;
}

export default function MapLibraryModal({ open, onClose, onSelect }: MapLibraryModalProps) {
  const [maps, setMaps] = useState<MapOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelected(null);
      mapsApi.list(50).then(setMaps).finally(() => setLoading(false));
    }
  }, [open]);

  const handleSubmit = () => {
    if (!selected) return;
    const map = maps.find((m) => m.id === selected);
    if (map) onSelect(map.id, map.title);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card p-6 max-w-2xl mx-4 w-full max-h-[80vh] flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-3 right-3 text-dark-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                <Map className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Select a Map</h2>
                <p className="text-sm text-dark-300">Choose a thinking map to submit</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : maps.length === 0 ? (
                <div className="text-center py-12 text-dark-400">
                  <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No maps found. Create a map first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {maps.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelected(m.id)}
                      className={`relative rounded-xl border p-2 text-left transition-all ${
                        selected === m.id
                          ? "border-accent-blue bg-accent-blue/10"
                          : "border-white/5 hover:border-white/10 hover:bg-white/5"
                      }`}
                    >
                      {selected === m.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="aspect-[4/3] rounded-lg bg-dark-700 overflow-hidden mb-2">
                        {m.thumbnail ? (
                          <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Map className="w-8 h-8 text-dark-500" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate">{m.title}</p>
                      <p className="text-xs text-dark-400">
                        {new Date(m.last_modified).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-white/5">
              <button onClick={onClose} className="px-4 py-2 text-sm text-dark-300 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected}
                className="btn-gradient px-6 py-2 rounded-xl text-sm text-white font-medium relative z-10 disabled:opacity-40"
              >
                <span className="relative z-10">Select Map</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
