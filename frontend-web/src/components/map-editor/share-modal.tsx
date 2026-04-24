"use client";

import { useState, useEffect, useRef } from "react";
import { mapsApi, messagingApi, type UserSearchResult, type MapVisibility } from "@/lib/api";
import Modal from "@/components/ui/modal";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, X, UserPlus, Search, Users, AlertTriangle, CheckCircle2, XCircle, Share2, Loader2, Eye } from "lucide-react";
import VisibilitySelector from "@/components/visibility-selector";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  mapId: string | null;
  shareCode: string;
  collaborators: string[];
  setCollaborators: (collabs: string[]) => void;
  visibility?: MapVisibility;
  onVisibilityChange?: (next: MapVisibility) => Promise<void> | void;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function ShareModal({
  open,
  onClose,
  mapId,
  shareCode,
  collaborators,
  setCollaborators,
  visibility = "private",
  onVisibilityChange,
}: ShareModalProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [allStudents, setAllStudents] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmAdd, setConfirmAdd] = useState<UserSearchResult | null>(null);
  const [confirmAddEmail, setConfirmAddEmail] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const MAX_COLLABORATORS = 5;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const loadedStudentsRef = useRef(false);
  const toastIdRef = useRef(0);

  const showToast = (type: "success" | "error", message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // Load all students once when modal opens
  useEffect(() => {
    if (!open || loadedStudentsRef.current) return;
    loadedStudentsRef.current = true;
    (async () => {
      try {
        const data = await messagingApi.searchUsers("@@", "student");
        setAllStudents(data);
      } catch { /* ignore */ }
    })();
  }, [open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      loadedStudentsRef.current = false;
      setConfirmAdd(null);
      setConfirmAddEmail(null);
      setConfirmRemove(null);
      setQuery("");
      setShowDropdown(false);
    }
  }, [open]);

  // Search users as they type
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      if (!query.trim()) setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await messagingApi.searchUsers(query.trim());
        setResults(data.filter(u => !collaborators.includes(u.email)));
        setShowDropdown(true);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, collaborators]);

  const displayResults = query.trim().length >= 2
    ? results
    : allStudents.filter(u => !collaborators.includes(u.email));

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestAddCollaborator = (email: string, user?: UserSearchResult) => {
    if (!email.trim() || !mapId) return;
    if (collaborators.length >= MAX_COLLABORATORS) {
      showToast("error", `Maximum ${MAX_COLLABORATORS} collaborators allowed`);
      return;
    }
    if (collaborators.includes(email.trim())) {
      showToast("error", `${email.trim()} is already a collaborator`);
      return;
    }
    if (user) {
      setConfirmAdd(user);
      setConfirmAddEmail(null);
    } else {
      setConfirmAdd(null);
      setConfirmAddEmail(email.trim());
    }
    setShowDropdown(false);
  };

  const handleConfirmAdd = async () => {
    const email = confirmAdd?.email || confirmAddEmail;
    if (!email || !mapId || adding) return;
    setAdding(true);
    try {
      await mapsApi.addCollaborator(mapId, email);
      setCollaborators([...collaborators, email]);
      setQuery("");
      showToast("success", `Added ${confirmAdd?.display_name || email} as collaborator`);
    } catch {
      showToast("error", `Failed to add ${email}`);
    }
    setConfirmAdd(null);
    setConfirmAddEmail(null);
    setAdding(false);
  };

  const handleRemoveCollaborator = async () => {
    if (!mapId || !confirmRemove || removing) return;
    setRemoving(true);
    try {
      await mapsApi.removeCollaborator(mapId, confirmRemove);
      setCollaborators(collaborators.filter(c => c !== confirmRemove));
      showToast("success", `Removed ${confirmRemove}`);
    } catch {
      showToast("error", `Failed to remove ${confirmRemove}`);
    }
    setConfirmRemove(null);
    setRemoving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Share & Collaborate" maxWidth="max-w-lg">
      {/* Toast notifications */}
      <div className="fixed top-6 right-6 z-[200] space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`share-toast flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md pointer-events-auto ${
                toast.type === "success"
                  ? "toast-success bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald"
                  : "toast-error bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {toast.type === "success"
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Visibility Section — Phase 1 followers foundation. Drives where the
          map appears (private / share code only / public on followers' feeds). */}
      {onVisibilityChange && (
        <div className="mb-5">
          <label className="text-sm font-semibold text-dark-200 mb-2 block flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent-cyan" /> Visibility
          </label>
          <VisibilitySelector
            value={visibility}
            onChange={(next) => { void onVisibilityChange(next); }}
          />
        </div>
      )}

      {/* Share Code Section — only relevant when the map is unlisted or public */}
      <div className="share-code-card rounded-xl bg-gradient-to-br from-accent-blue/5 to-accent-purple/5 border border-white/5 p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Share Code</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-3xl font-mono font-bold text-accent-blue tracking-[0.2em]">{shareCode}</span>
          <button
            onClick={handleCopy}
            className={`collab-copy-btn flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              copied
                ? "copied bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20"
                : "bg-white/5 text-dark-300 hover:bg-white/10 hover:text-white border border-white/5"
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-[11px] text-dark-500 mt-2">Share this code with others so they can find and access your map.</p>
      </div>

      {/* Add Collaborator Section */}
      <div className="mb-5" ref={dropdownRef}>
        <label className="text-sm font-semibold text-dark-200 mb-2 block flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-accent-purple" /> Add Collaborator
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-dark-400">{collaborators.length}/{MAX_COLLABORATORS}</span>
        </label>
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="glass-input w-full pl-9 pr-3 py-2.5 text-sm rounded-xl disabled:opacity-50"
                disabled={collaborators.length >= MAX_COLLABORATORS}
                onFocus={() => collaborators.length < MAX_COLLABORATORS && setShowDropdown(true)}
                onKeyDown={e => {
                  if (e.key === "Enter" && query.includes("@")) {
                    requestAddCollaborator(query);
                  }
                }}
              />
            </div>
            <button
              onClick={() => query.includes("@") && requestAddCollaborator(query)}
              disabled={adding || !query.includes("@") || collaborators.length >= MAX_COLLABORATORS}
              className="btn-gradient px-4 py-2.5 text-white rounded-xl text-sm flex items-center gap-1.5 relative z-10 disabled:opacity-40"
            >
              {adding
                ? <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                : <UserPlus className="w-4 h-4 relative z-10" />}
              <span className="relative z-10">Add</span>
            </button>
          </div>

          {/* Search results dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="collab-dropdown absolute top-full left-0 right-0 mt-1 glass-card rounded-xl border border-white/10 max-h-48 overflow-y-auto z-50 shadow-xl shadow-black/30"
              >
                {query.trim().length < 2 && displayResults.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-dark-400 font-semibold border-b border-white/5">All Students</div>
                )}
                {searching ? (
                  <div className="flex items-center justify-center gap-2 p-4">
                    <Loader2 className="w-3.5 h-3.5 text-dark-400 animate-spin" />
                    <span className="text-xs text-dark-400">Searching...</span>
                  </div>
                ) : displayResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-dark-400">
                    {query.trim().length >= 2 ? "No users found" : "Loading students..."}
                  </div>
                ) : (
                  displayResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => requestAddCollaborator(user.email, user)}
                      disabled={adding}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                    >
                      {user.photo_url ? (
                        <img src={user.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent-blue/15 flex items-center justify-center text-accent-blue text-xs font-bold">
                          {user.display_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-dark-100 font-medium truncate">{user.display_name}</p>
                        <p className="text-[11px] text-dark-400 truncate">{user.email}</p>
                      </div>
                      <span className="text-[10px] text-accent-blue font-medium px-2 py-0.5 bg-accent-blue/10 rounded-full">+ Add</span>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Max collaborators warning */}
      {collaborators.length >= MAX_COLLABORATORS && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-accent-amber/5 border border-accent-amber/10">
          <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0" />
          <span className="text-xs text-dark-300">Maximum of {MAX_COLLABORATORS} collaborators reached. Remove someone to add more.</span>
        </div>
      )}

      {/* Collaborators List */}
      <div>
        <label className="text-sm font-semibold text-dark-200 mb-2 block flex items-center gap-2">
          <Users className="w-4 h-4 text-accent-cyan" />
          Collaborators
          {collaborators.length > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-dark-400">{collaborators.length}/{MAX_COLLABORATORS}</span>
          )}
        </label>
        {collaborators.length === 0 ? (
          <div className="collab-empty-state text-center py-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
            <Users className="w-8 h-8 text-dark-500 mx-auto mb-2" />
            <p className="text-sm text-dark-400">No collaborators yet</p>
            <p className="text-xs text-dark-500 mt-1">Search and add people above to collaborate</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence>
              {collaborators.map(collab => (
                <motion.div
                  key={collab}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="collab-item flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-accent-purple/15 flex items-center justify-center text-accent-purple text-xs font-bold flex-shrink-0">
                      {collab.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-dark-200 truncate">{collab}</span>
                  </div>
                  <button
                    onClick={() => setConfirmRemove(collab)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group flex-shrink-0"
                    title="Remove collaborator"
                  >
                    <X className="w-3.5 h-3.5 text-dark-400 group-hover:text-red-400 transition-colors" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Confirmation Dialog */}
      <AnimatePresence>
        {(confirmAdd || confirmAddEmail) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => !adding && (setConfirmAdd(null), setConfirmAddEmail(null))} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="confirm-dialog relative glass-card rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-black/40"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-accent-blue" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Add Collaborator</h4>
                  <p className="text-xs text-dark-400 mt-0.5">They will be able to edit this map</p>
                </div>
              </div>
              {confirmAdd ? (
                <div className="flex items-center gap-3 mb-5 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/5">
                  {confirmAdd.photo_url ? (
                    <img src={confirmAdd.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent-blue/15 flex items-center justify-center text-accent-blue text-sm font-bold">
                      {confirmAdd.display_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{confirmAdd.display_name}</p>
                    <p className="text-xs text-dark-400 truncate">{confirmAdd.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-dark-300 mb-5">
                  Add <span className="font-semibold text-white">{confirmAddEmail}</span> as a collaborator?
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setConfirmAdd(null); setConfirmAddEmail(null); }}
                  disabled={adding}
                  className="confirm-cancel px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAdd}
                  disabled={adding}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-blue/20 hover:bg-accent-blue/30 border border-accent-blue/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Add
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove Confirmation Dialog */}
      <AnimatePresence>
        {confirmRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => !removing && setConfirmRemove(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="confirm-dialog relative glass-card rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-black/40"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Remove Collaborator</h4>
                  <p className="text-xs text-dark-400 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-dark-300 mb-5">
                Are you sure you want to remove <span className="font-semibold text-white">{confirmRemove}</span> from this map? They will lose access immediately.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmRemove(null)}
                  disabled={removing}
                  className="confirm-cancel px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveCollaborator}
                  disabled={removing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
