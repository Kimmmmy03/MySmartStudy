"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2, MessageCircle } from "lucide-react";
import { socialApi, type MapCommentOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import PublicProfileLink from "@/components/public-profile-link";
import { formatDateTime, resolveBackendUrl } from "@/lib/utils";

const MAX = 500;
const POLL_MS = 5000;

/**
 * Right-side slide-over for map comments. Polls every 5s to match the
 * existing discussion/chat cadence — fine for classroom-scale traffic and
 * doesn't require Firestore realtime listeners bypassing the API layer.
 *
 * Delete rules: authors can delete their own; the map owner can delete any
 * comment on their map (backend enforces this — the UI just shows the icon
 * conditionally).
 */
export default function CommentsDrawer({
  open,
  onClose,
  mapId,
  mapOwnerId,
  onCountChange,
}: {
  open: boolean;
  onClose: () => void;
  mapId: string;
  mapOwnerId: string;
  onCountChange?: (count: number) => void;
}) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<MapCommentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerId = profile?.id;
  const viewerIsOwner = !!viewerId && viewerId === mapOwnerId;

  const load = useCallback(async () => {
    try {
      const rows = await socialApi.listComments(mapId);
      setComments(rows);
      onCountChange?.(rows.length);
      setError(null);
    } catch {
      setError("Failed to load comments");
    }
  }, [mapId, onCountChange]);

  // Load + poll while open.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load().finally(() => setLoading(false));
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, load]);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const created = await socialApi.createComment(mapId, trimmed.slice(0, MAX));
      // Prepend optimistically (server already persisted it; polling would pick
      // it up in up to 5s, but instant feedback feels better).
      setComments(prev => [created, ...prev.filter(c => c.id !== created.id)]);
      onCountChange?.(comments.length + 1);
      setText("");
    } catch {
      setError("Couldn't post your comment");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    const prev = comments;
    setComments(p => p.filter(c => c.id !== commentId));
    try {
      await socialApi.deleteComment(mapId, commentId);
      onCountChange?.(Math.max(0, comments.length - 1));
    } catch {
      // Restore on failure
      setComments(prev);
      setError("Couldn't delete the comment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40"
          />
          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-[61] bg-dark-800 border-l border-white/10 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-accent-cyan" />
                <h2 className="text-sm font-semibold text-white">
                  Comments
                  <span className="ml-2 text-dark-400 font-normal">({comments.length})</span>
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-dark-200 hover:bg-white/5 hover:text-white transition-colors"
                aria-label="Close comments"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {loading && comments.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageCircle className="w-10 h-10 text-dark-500 mx-auto mb-2" />
                  <p className="text-sm text-dark-200">No comments yet</p>
                  <p className="text-xs text-dark-400 mt-1">Be the first to leave a thought.</p>
                </div>
              ) : (
                comments.map(c => {
                  const canDelete = viewerId === c.author_id || viewerIsOwner;
                  const photoRaw = c.author_photo_url;
                  const photo = photoRaw
                    ? (photoRaw.startsWith("http") ? photoRaw : resolveBackendUrl(photoRaw))
                    : "";
                  return (
                    <article key={c.id} className="flex gap-3">
                      <PublicProfileLink uid={c.author_id} className="shrink-0">
                        {photo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={photo} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-[11px] font-bold">
                            {(c.author_name || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                      </PublicProfileLink>
                      <div className="flex-1 min-w-0 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <PublicProfileLink
                            uid={c.author_id}
                            className="text-xs font-semibold text-white truncate hover:underline"
                          >
                            {c.author_name || "Unknown"}
                          </PublicProfileLink>
                          <span className="text-[10px] text-dark-400 shrink-0">
                            {formatDateTime(c.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-dark-100 mt-1 whitespace-pre-wrap break-words">{c.text}</p>
                        {canDelete && (
                          <div className="mt-1.5 flex justify-end">
                            <button
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="inline-flex items-center gap-1 text-[10px] text-dark-400 hover:text-red-400 transition-colors"
                            >
                              {deletingId === c.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
              {error && (
                <p className="text-xs text-red-400 text-center py-2">{error}</p>
              )}
            </div>

            {/* Composer */}
            <footer className="border-t border-white/10 p-3">
              <div className="relative">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, MAX))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePost();
                    }
                  }}
                  placeholder="Share your thoughts…"
                  rows={2}
                  maxLength={MAX}
                  disabled={posting}
                  className="glass-input w-full px-3 py-2 pr-12 text-sm resize-none rounded-xl"
                />
                <button
                  onClick={handlePost}
                  disabled={posting || !text.trim()}
                  aria-label="Post comment"
                  className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-end mt-1 text-[10px] text-dark-400">
                <span>{text.length}/{MAX}</span>
              </div>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
