"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { mapsApi, MapOut } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import MapCard from "@/components/map-card";
import VisibilityBadge from "@/components/visibility-badge";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, LayoutGrid, List, Map as MapIcon, Pencil, Trash2, Users, Link2, Loader2 } from "lucide-react";
import clsx from "clsx";

type FilterTab = "my-maps" | "collaborated";

export default function MyMapsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<MapOut[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterTab, setFilterTab] = useState<FilterTab>("my-maps");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [expandingNewMap, setExpandingNewMap] = useState(false);
  const newMapCardRef = useRef<HTMLDivElement>(null);

  // Share code input
  const [shareCode, setShareCode] = useState("");
  const [shareCodeLoading, setShareCodeLoading] = useState(false);
  const [shareCodeError, setShareCodeError] = useState("");
  const [shareCodeSuccess, setShareCodeSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    const loadMaps = async () => {
      const data = await mapsApi.list();
      setMaps(data);
      setLoading(false);
    };
    loadMaps();
  }, [user]);

  const myMaps = maps.filter(m => m.owner_id === user?.id || m.owner_email === user?.email);
  const collaboratedMaps = maps.filter(m => m.owner_id !== user?.id && m.owner_email !== user?.email);

  const activeMaps = filterTab === "my-maps" ? myMaps : collaboratedMaps;
  const filteredMaps = activeMaps.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAddByCode = async () => {
    if (!shareCode.trim()) return;
    setShareCodeLoading(true);
    setShareCodeError("");
    setShareCodeSuccess("");
    try {
      const code = shareCode.trim().toUpperCase();
      const results = await mapsApi.searchByCode(code);
      if (results.length === 0) {
        setShareCodeError("No map found with that code.");
      } else {
        const map = results[0];
        const email = user?.email || "";
        // Check if user owns this map
        if (map.owner_email === email || map.owner_id === user?.id) {
          setShareCodeError("This is your own map.");
        } else if (map.collaborators?.includes(email)) {
          setShareCodeError("You are already a collaborator on this map.");
        } else {
          // Add current user as collaborator
          await mapsApi.addCollaborator(map.id, email);
          // Reload maps
          const data = await mapsApi.list();
          setMaps(data);
          setShareCodeSuccess(`Added "${map.title}" to your library!`);
          setShareCode("");
          setFilterTab("collaborated");
          setTimeout(() => setShareCodeSuccess(""), 3000);
        }
      }
    } catch {
      setShareCodeError("Invalid code or failed to add map.");
    }
    setShareCodeLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await mapsApi.delete(deleteTarget);
    setMaps(maps.filter(m => m.id !== deleteTarget));
    setDeleteTarget(null);
  };

  const handleRename = async () => {
    if (!renameTarget || !newTitle.trim()) return;
    await mapsApi.update(renameTarget.id, { title: newTitle.trim() });
    setMaps(maps.map(m => m.id === renameTarget.id ? { ...m, title: newTitle.trim() } : m));
    setRenameTarget(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">My Library</h1>
        <button
          onClick={() => router.push("/student/create-map")}
          className="btn-gradient flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white relative z-10"
        >
          <Plus className="w-4 h-4 relative z-10" /> <span className="relative z-10">New Map</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setFilterTab("my-maps")}
          className={clsx(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all",
            filterTab === "my-maps"
              ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/30"
              : "text-dark-300 hover:text-dark-100 hover:bg-white/5 border border-transparent"
          )}
        >
          My Maps
          <span className={clsx("ml-1.5 text-xs px-1.5 py-0.5 rounded-full", filterTab === "my-maps" ? "bg-accent-blue/20" : "bg-white/5")}>
            {myMaps.length}
          </span>
        </button>
        <button
          onClick={() => setFilterTab("collaborated")}
          className={clsx(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5",
            filterTab === "collaborated"
              ? "bg-accent-purple/15 text-accent-purple border border-accent-purple/30"
              : "text-dark-300 hover:text-dark-100 hover:bg-white/5 border border-transparent"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Collaborated
          <span className={clsx("text-xs px-1.5 py-0.5 rounded-full", filterTab === "collaborated" ? "bg-accent-purple/20" : "bg-white/5")}>
            {collaboratedMaps.length}
          </span>
        </button>
      </div>

      {/* Share Code Input */}
      <div className="glass-card p-3 mb-4" style={{ borderRadius: "12px" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Link2 className="w-4 h-4 text-dark-400 shrink-0" />
            <input
              type="text"
              placeholder="Enter share code to add a map..."
              value={shareCode}
              onChange={e => { setShareCode(e.target.value); setShareCodeError(""); }}
              onKeyDown={e => e.key === "Enter" && handleAddByCode()}
              className="glass-input w-full px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleAddByCode}
            disabled={shareCodeLoading || !shareCode.trim()}
            className="btn-gradient flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white relative z-10 disabled:opacity-40"
          >
            {shareCodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10" /> : <Plus className="w-3.5 h-3.5 relative z-10" />}
            <span className="relative z-10">Add Map</span>
          </button>
        </div>
        {shareCodeError && <p className="text-xs text-red-400 mt-2 ml-6">{shareCodeError}</p>}
        {shareCodeSuccess && <p className="text-xs text-emerald-400 mt-2 ml-6">{shareCodeSuccess}</p>}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 glass-card p-3" style={{ borderRadius: "12px" }}>
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search maps..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="peer glass-input w-full pl-10 pr-4 py-2 text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300 peer-focus:text-white transition-colors pointer-events-none" />
        </div>
        <div className="flex view-toggle-group rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("grid")}
            className={clsx("p-2 transition-colors", viewMode === "grid" ? "bg-accent-blue text-white" : "view-toggle-btn")}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")}
            className={clsx("p-2 transition-colors", viewMode === "list" ? "bg-accent-blue text-white" : "view-toggle-btn")}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Maps */}
      {loading ? (
        <div className="text-center py-12 text-dark-400">Loading maps...</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {/* + New Map card */}
          <motion.div
            ref={newMapCardRef}
            whileHover={expandingNewMap ? {} : { y: -4 }}
            onClick={() => {
              if (expandingNewMap) return;
              setExpandingNewMap(true);
              setTimeout(() => router.push("/student/create-map"), 500);
            }}
            className="group glass-card overflow-hidden cursor-pointer border-2 border-dashed border-white/10 hover:border-accent-blue/40 transition-colors"
          >
            <div className="h-[150px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={expandingNewMap ? { scale: 1.3 } : {}}
                  transition={{ duration: 0.4 }}
                  className="w-12 h-12 rounded-full bg-accent-blue/10 group-hover:bg-accent-blue/20 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-6 h-6 text-accent-blue" />
                </motion.div>
                <span className="text-sm font-medium text-dark-300 group-hover:text-dark-100 transition-colors">New Map</span>
              </div>
            </div>
            <div className="p-3">
              <h4 className="font-medium text-dark-300 text-sm">Create a new mind map</h4>
              <p className="text-xs text-dark-500 mt-1">Start from scratch or a template</p>
            </div>
          </motion.div>

          {/* Zoom-into overlay */}
          <AnimatePresence>
            {expandingNewMap && (
              <motion.div
                className="fixed inset-0 z-[100] pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeIn" }}
                style={{ background: "radial-gradient(circle, #1a1a2e 0%, #12121e 100%)" }}
              />
            )}
          </AnimatePresence>
          {filteredMaps.map(map => (
            <MapCard key={map.id} title={map.title} thumbnail={map.thumbnail} lastModified={formatDateTime(map.last_modified)}
              collaborators={map.collaborators}
              ownerEmail={filterTab === "collaborated" ? map.owner_email : undefined}
              visibility={map.visibility}
              onClick={() => router.push(`/student/create-map?id=${map.id}`)} showActions
              onRename={() => { setRenameTarget({ id: map.id, title: map.title }); setNewTitle(map.title); }}
              onDelete={() => setDeleteTarget(map.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMaps.map(map => (
            <div key={map.id} onClick={() => router.push(`/student/create-map?id=${map.id}`)}
              className="flex items-center gap-4 glass-card p-3 cursor-pointer group" style={{ borderRadius: "12px" }}>
              <div className="w-12 h-12 bg-dark-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {map.thumbnail ? <img src={map.thumbnail} alt="" className="w-full h-full object-cover" /> : <MapIcon className="w-6 h-6 text-dark-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-dark-100 text-sm truncate">{map.title}</h4>
                  {map.collaborators && map.collaborators.length > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-purple/15 text-accent-purple text-[10px] font-medium shrink-0">
                      <Users className="w-3 h-3" /> Collaboration
                    </span>
                  )}
                  {map.visibility && <VisibilityBadge visibility={map.visibility} size="sm" className="shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-dark-400">{formatDateTime(map.last_modified)}</p>
                  {filterTab === "collaborated" && map.owner_email && (
                    <span className="text-[10px] text-dark-400">
                      Owner: <span className="text-dark-300">{map.owner_email}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); setRenameTarget({ id: map.id, title: map.title }); setNewTitle(map.title); }}
                  className="p-2 hover:bg-white/5 rounded-lg text-dark-300 hover:text-accent-blue"><Pencil className="w-4 h-4" /></button>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(map.id); }}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-dark-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Map">
        <p className="text-dark-200 text-sm mb-4">Are you sure you want to delete this map? This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Delete</button>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename Map">
        <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
          className="glass-input w-full px-4 py-2.5 mb-4" onKeyDown={e => e.key === "Enter" && handleRename()} />
        <div className="flex justify-end gap-2">
          <button onClick={() => setRenameTarget(null)} className="px-4 py-2 text-sm text-dark-200 hover:bg-white/5 rounded-lg">Cancel</button>
          <button onClick={handleRename} className="btn-gradient px-4 py-2 text-sm text-white rounded-lg relative z-10"><span className="relative z-10">Save</span></button>
        </div>
      </Modal>
    </motion.div>
  );
}
