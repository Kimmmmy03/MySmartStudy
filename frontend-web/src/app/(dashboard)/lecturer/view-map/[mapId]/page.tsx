"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { mapsApi, usersApi, MapOut, UserOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft, User, Clock, Hash, MessageSquare, StickyNote, Pencil,
  Trash2, RefreshCw, Users, Crown, GitCommitHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate, resolveBackendUrl } from "@/lib/utils";
import dynamic from "next/dynamic";
import clsx from "clsx";

const ReactFlowViewer = dynamic(() => import("@/components/map-editor/map-viewer"), { ssr: false });
const AnnotationLayer = dynamic(() => import("@/components/map-editor/annotation-layer"), { ssr: false });

interface AnnotationItem {
  id: string;
  authorId: string;
  authorName: string;
  type: string;
  content: string;
  position: { x: number; y: number };
  color: string;
  path?: string;
  createdAt: string;
}

interface PresenceUser {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  lockedNodeId: string | null;
  lastSeen: string;
}

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

interface ContributorStat {
  user_id: string;
  user_name: string;
  user_email: string;
  changes: number;
}

export default function ViewMapPage() {
  const { mapId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [map, setMap] = useState<MapOut | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<UserOut | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [showPanel, setShowPanel] = useState<"annotations" | "info">("annotations");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [contributors, setContributors] = useState<ContributorStat[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  // Load map + owner profile
  useEffect(() => {
    if (!mapId) return;
    mapsApi.get(mapId as string).then(m => {
      setMap(m);
      // Record view on backend (syncs across web + mobile)
      mapsApi.markViewed(m.id).catch(() => {});
      // Fetch owner profile for display name
      if (m.owner_id) {
        usersApi.getUser(m.owner_id).then(setOwnerProfile).catch(() => {});
      }
      // Fetch history for contribution stats
      mapsApi.getHistory(mapId as string, 200).then(h => {
        setHistory(h);
        // Build contributor stats (exclude "viewed" actions)
        const stats: Record<string, ContributorStat> = {};
        for (const entry of h) {
          if (entry.action === "viewed") continue;
          if (!stats[entry.user_id]) {
            stats[entry.user_id] = {
              user_id: entry.user_id,
              user_name: entry.user_name,
              user_email: entry.user_email,
              changes: 0,
            };
          }
          stats[entry.user_id].changes++;
        }
        const sorted = Object.values(stats).sort((a, b) => b.changes - a.changes);
        setContributors(sorted);
      }).catch(() => {});
    });
  }, [mapId]);

  // Lecturer presence heartbeat
  useEffect(() => {
    if (!mapId || !user) return;
    const heartbeat = () => mapsApi.updatePresence(mapId as string, {}).catch(() => {});
    heartbeat();
    const interval = setInterval(heartbeat, 10000);
    return () => clearInterval(interval);
  }, [mapId, user]);

  // Poll presence
  useEffect(() => {
    if (!mapId) return;
    const poll = async () => {
      try {
        setPresence(await mapsApi.getPresence(mapId as string));
      } catch { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [mapId]);

  const fetchAnnotations = useCallback(async () => {
    if (!mapId) return;
    try {
      setAnnotations(await mapsApi.getAnnotations(mapId as string) as AnnotationItem[]);
    } catch { /* silent */ }
  }, [mapId]);

  useEffect(() => {
    fetchAnnotations();
    const interval = setInterval(fetchAnnotations, 8000);
    return () => clearInterval(interval);
  }, [fetchAnnotations]);

  const handleDeleteAnnotation = async (annId: string) => {
    try {
      await mapsApi.deleteAnnotation(mapId as string, annId);
      setAnnotations(prev => prev.filter(a => a.id !== annId));
    } catch { /* silent */ }
  };

  if (!map) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
      </div>
    );
  }

  let nodes: unknown[] = [];
  let edges: unknown[] = [];
  if (map.graph_data) {
    try {
      const parsed = JSON.parse(map.graph_data);
      nodes = parsed.nodes || [];
      edges = parsed.edges || [];
    } catch { /* empty */ }
  }

  const notes = annotations.filter(a => a.type === "note");
  const drawings = annotations.filter(a => a.type === "drawing");

  const ownerPresence = presence.find(p => p.userId === map.owner_id);
  const ownerOnline = !!ownerPresence;
  const collaboratorEmails = map.collaborators || [];

  // Determine which collaborators are currently online
  const onlineUserIds = new Set(presence.map(p => p.userId));
  const ownerName = ownerProfile?.display_name || map.owner_email;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <button onClick={() => router.back()} className="text-sm text-gray-500 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 mb-3 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Review Maps
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{map.title}</h1>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 dark:text-dark-400 flex-wrap">
            {/* Owner with name */}
            <span className="flex items-center gap-1.5">
              {ownerProfile?.photo_url ? (
                <img src={resolveBackendUrl(ownerProfile.photo_url)} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              <span className="text-gray-900 dark:text-white font-medium">{ownerName}</span>
              <span title="Owner"><Crown className="w-3 h-3 text-amber-400" /></span>
            </span>
            {map.share_code && <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> {map.share_code}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(map.last_modified)}</span>
            {collaboratorEmails.length > 0 && (
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {collaboratorEmails.length} collaborator{collaboratorEmails.length !== 1 ? "s" : ""}</span>
            )}

            {/* Animated online status */}
            <span className={clsx("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all",
              ownerOnline
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-500 border border-gray-200 dark:border-white/5"
            )}>
              <span className="relative flex h-2 w-2">
                {ownerOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={clsx("relative inline-flex rounded-full h-2 w-2", ownerOnline ? "bg-emerald-400" : "bg-dark-600")} />
              </span>
              {ownerOnline ? "Owner editing live" : "Owner offline"}
            </span>
          </div>
        </div>

        {/* Panel toggle buttons */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setShowPanel("annotations")}
            className={clsx("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              showPanel === "annotations" ? "bg-accent-purple/20 text-accent-purple" : "text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Annotations ({annotations.length})
          </button>
          <button
            onClick={() => setShowPanel("info")}
            className={clsx("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              showPanel === "info" ? "bg-accent-purple/20 text-accent-purple" : "text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
            )}
          >
            <Users className="w-3.5 h-3.5" /> People
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 15rem)" }}>
        <div className="flex-1 glass-card overflow-hidden relative">
          <ReactFlowViewer nodes={nodes} edges={edges} onViewportChange={setViewport} />
          {user && (
            <AnnotationLayer
              mapId={mapId as string}
              currentUserId={user.id || user.uid}
              currentUserName={user.email}
              readOnly={false}
              viewport={viewport}
            />
          )}
        </div>

        {/* Sidebar */}
        <motion.div
          layout
          className="w-[320px] glass-card overflow-hidden flex-shrink-0 flex flex-col"
        >
          {showPanel === "info" ? (
            /* ── People Panel ── */
            <>
              <div className="p-4 border-b border-gray-200 dark:border-white/5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">People & Contributions</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Owner */}
                <div>
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Owner
                  </p>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="relative">
                      {ownerProfile?.photo_url ? (
                        <img src={resolveBackendUrl(ownerProfile.photo_url)} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
                          {ownerName[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                        {ownerOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                        <span className={clsx("relative inline-flex rounded-full h-3 w-3 border-2 border-dark-800", ownerOnline ? "bg-emerald-400" : "bg-dark-600")} />
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ownerName}</p>
                      <p className="text-[10px] text-gray-500 dark:text-dark-400">{map.owner_email}</p>
                      <p className={clsx("text-[10px] mt-0.5", ownerOnline ? "text-emerald-400" : "text-gray-400 dark:text-dark-500")}>
                        {ownerOnline ? "Editing now" : "Offline"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Collaborators */}
                {collaboratorEmails.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-accent-blue uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Collaborators ({collaboratorEmails.length})
                    </p>
                    <div className="space-y-1.5">
                      {collaboratorEmails.map(email => {
                        // Try to find this collaborator in presence
                        const online = presence.some(p => {
                          // Match by display name or check contributor stats
                          const contrib = contributors.find(c => c.user_email === email);
                          return contrib ? onlineUserIds.has(contrib.user_id) : false;
                        });
                        const contrib = contributors.find(c => c.user_email === email);
                        return (
                          <div key={email} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <div className="w-7 h-7 rounded-full bg-accent-blue/20 flex items-center justify-center text-[10px] font-bold text-accent-blue">
                                  {email[0]?.toUpperCase()}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                                  {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                                  <span className={clsx("relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-dark-800", online ? "bg-emerald-400" : "bg-dark-600")} />
                                </span>
                              </div>
                              <div>
                                <p className="text-xs text-gray-900 dark:text-white">{contrib?.user_name || email}</p>
                                {contrib?.user_name && <p className="text-[10px] text-gray-400 dark:text-dark-500">{email}</p>}
                              </div>
                            </div>
                            {contrib && (() => {
                              const totalChanges = contributors.reduce((sum, c) => sum + c.changes, 0);
                              const pct = totalChanges > 0 ? Math.round((contrib.changes / totalChanges) * 100) : 0;
                              return (
                                <span className="text-[10px] text-gray-500 dark:text-dark-400 flex items-center gap-1">
                                  <GitCommitHorizontal className="w-3 h-3" /> {contrib.changes}
                                  <span className="px-1.5 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-semibold">{pct}%</span>
                                </span>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Contribution ranking */}
                {contributors.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-accent-purple uppercase tracking-wide mb-2 flex items-center gap-1">
                      <GitCommitHorizontal className="w-3 h-3" /> Top Contributors
                    </p>
                    <div className="space-y-1">
                      {contributors.slice(0, 10).map((c, i) => {
                        const isOnline = onlineUserIds.has(c.user_id);
                        const totalChanges = contributors.reduce((sum, ct) => sum + ct.changes, 0);
                        const barWidth = totalChanges > 0 ? Math.max(5, (c.changes / totalChanges) * 100) : 0;
                        const pct = totalChanges > 0 ? Math.round((c.changes / totalChanges) * 100) : 0;
                        return (
                          <div key={c.user_id} className="flex items-center gap-2 py-1">
                            <span className="text-[10px] text-gray-400 dark:text-dark-500 w-4 text-right font-mono">{i + 1}</span>
                            <div className="relative">
                              <div className="w-6 h-6 rounded-full bg-accent-purple/15 flex items-center justify-center text-[9px] font-bold text-accent-purple">
                                {(c.user_name || c.user_email)[0]?.toUpperCase()}
                              </div>
                              {isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-900 dark:text-white truncate">{c.user_name || c.user_email}</p>
                                <span className="text-[10px] text-gray-500 dark:text-dark-400 ml-2 flex-shrink-0 flex items-center gap-1">
                                  {c.changes} change{c.changes !== 1 ? "s" : ""}
                                  <span className="px-1.5 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple font-semibold">{pct}%</span>
                                </span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full mt-0.5 overflow-hidden">
                                <div className="h-full bg-accent-purple/40 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Currently online on this map */}
                {presence.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                      Online Now ({presence.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presence.map(p => (
                        <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/15 rounded-full">
                          {p.photoURL ? (
                            <img src={resolveBackendUrl(p.photoURL)} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-bold text-emerald-400">
                              {p.displayName?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-300">{p.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Annotations Panel ── */
            <>
              <div className="p-4 border-b border-gray-200 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Annotations</h3>
                  <button onClick={fetchAnnotations}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-dark-400 hover:text-gray-600 dark:hover:text-dark-200 transition-colors" title="Refresh">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">Add sticky notes or draw highlights on the map</p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {annotations.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-10 h-10 text-gray-300 dark:text-dark-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-dark-500">No annotations yet</p>
                    <p className="text-[10px] text-gray-300 dark:text-dark-600 mt-1">Use the toolbar on the map to add feedback</p>
                  </div>
                ) : (
                  <>
                    {drawings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <Pencil className="w-3 h-3" /> Drawings ({drawings.length})
                        </p>
                        {drawings.map(ann => (
                          <div key={ann.id} className="mb-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 group relative">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-medium text-red-700 dark:text-red-300">{ann.authorName}</p>
                                <p className="text-[9px] text-red-400/70 dark:text-red-400/50 mt-0.5">{new Date(ann.createdAt).toLocaleString()}</p>
                              </div>
                              {user && ann.authorId === (user.id || user.uid) && (
                                <button onClick={() => handleDeleteAnnotation(ann.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {notes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <StickyNote className="w-3 h-3" /> Notes ({notes.length})
                        </p>
                        {notes.map(ann => (
                          <div key={ann.id} className="mb-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 group relative">
                            <div className="flex items-start gap-2">
                              <StickyNote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300">{ann.authorName}</p>
                                <p className="text-xs text-gray-700 dark:text-white/90 mt-0.5 break-words">{ann.content}</p>
                                <p className="text-[9px] text-gray-400 dark:text-dark-500 mt-1">{new Date(ann.createdAt).toLocaleString()}</p>
                              </div>
                              {user && ann.authorId === (user.id || user.uid) && (
                                <button onClick={() => handleDeleteAnnotation(ann.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/5 text-dark-400 transition-all flex-shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
