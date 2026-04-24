"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MessageCircle, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import { mapsApi, type MapOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, resolveBackendUrl } from "@/lib/utils";
import FollowButton from "@/components/follow-button";
import LikeButton from "@/components/like-button";
import CommentsDrawer from "@/components/comments-drawer";
import VisibilityBadge from "@/components/visibility-badge";
import PublicProfileLink from "@/components/public-profile-link";

const ReactFlowViewer = dynamic(() => import("@/components/map-editor/map-viewer"), { ssr: false });

/**
 * Read-only map viewer with Like + Comments + Follow actions. Used by
 * feed / explore / public profile links. Lecturers have their own
 * /lecturer/view-map/[mapId] with annotation tools; this route stays
 * lightweight for casual browsing.
 *
 * If a stranger opens a private map the backend returns 404, which
 * surfaces as the generic "couldn't load" state — matches the backend's
 * existence-hiding behaviour.
 */
export default function ViewMapPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const mapId = String(params?.id || "");

  const [map, setMap] = useState<MapOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (!mapId) return;
    setLoading(true);
    setError(false);
    mapsApi.get(mapId)
      .then(m => {
        setMap(m);
        setCommentCount(m.comment_count ?? 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [mapId]);

  const { nodes, edges } = useMemo(() => {
    if (!map?.graph_data) return { nodes: [], edges: [] };
    try {
      const parsed = JSON.parse(map.graph_data);
      return { nodes: parsed.nodes || [], edges: parsed.edges || [] };
    } catch {
      return { nodes: [], edges: [] };
    }
  }, [map]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-accent-purple animate-spin" />
      </div>
    );
  }

  if (error || !map) {
    return (
      <div className="max-w-lg mx-auto glass-card p-10 text-center">
        <p className="text-dark-200 font-medium">Couldn&apos;t load that mind map</p>
        <p className="text-xs text-dark-400 mt-1">It may have been removed or isn&apos;t public.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    );
  }

  const ownerPhoto = map.owner_photo_url
    ? (map.owner_photo_url.startsWith("http") ? map.owner_photo_url : resolveBackendUrl(map.owner_photo_url))
    : "";
  const isOwnMap = !!profile && profile.id === map.owner_id;
  const displayName = map.owner_name || map.owner_email?.split("@")[0] || "Unknown";

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Header — back + owner + follow + title */}
      <div className="glass-card p-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs text-dark-300 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <PublicProfileLink uid={map.owner_id} className="shrink-0">
              {ownerPhoto ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={ownerPhoto} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-sm font-bold">
                  {displayName[0]?.toUpperCase() || "?"}
                </div>
              )}
            </PublicProfileLink>
            <div className="min-w-0">
              <PublicProfileLink
                uid={map.owner_id}
                className="text-sm font-semibold text-white truncate hover:underline inline-block"
              >
                {displayName}
              </PublicProfileLink>
              <p className="text-[11px] text-dark-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {map.published_at ? formatDateTime(map.published_at) : formatDateTime(map.last_modified)}
              </p>
            </div>
          </div>
          {!isOwnMap && map.owner_id && (
            <FollowButton
              targetUserId={map.owner_id}
              initialFollowing={!!map.owner_is_followed_by_me}
              size="sm"
            />
          )}
        </div>
        {/* Title row */}
        <div className="mt-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-white truncate">{map.title || "Untitled map"}</h1>
            <div className="mt-1.5">
              <VisibilityBadge visibility={map.visibility} size="sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LikeButton
              mapId={map.id}
              initialLiked={!!map.is_liked_by_me}
              initialCount={map.like_count ?? 0}
              size="sm"
            />
            <button
              onClick={() => setCommentsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-dark-200 hover:bg-white/10 hover:text-white text-xs font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="tabular-nums">{commentCount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="glass-card overflow-hidden h-[calc(100vh-220px)] min-h-[480px]">
        <ReactFlowViewer nodes={nodes} edges={edges} />
      </div>

      {/* Comments drawer */}
      <CommentsDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        mapId={map.id}
        mapOwnerId={map.owner_id}
        onCountChange={setCommentCount}
      />
    </motion.div>
  );
}
