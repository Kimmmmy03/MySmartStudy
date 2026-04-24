"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, MessageCircle, ArrowUpRight, Map as MapIcon } from "lucide-react";
import type { MapOut } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import FollowButton from "@/components/follow-button";
import PublicProfileLink from "@/components/public-profile-link";
import VisibilityBadge from "@/components/visibility-badge";

/**
 * Rich feed card for a public mind map — used in /student/feed, Explore →
 * Trending, and the Maps tab on public profiles.
 *
 * Shows author info (clickable to profile), thumbnail, title, truncated
 * nodes_text as a teaser, like/comment counts, and the viewer's follow state.
 * Uses PublicProfileLink instead of a raw Link so the stopPropagation behaviour
 * is consistent with other call sites.
 */
export default function MapFeedCard({
  map,
  currentUserId,
  showFollowButton = true,
  onFollowChange,
}: {
  map: MapOut;
  currentUserId?: string;
  showFollowButton?: boolean;
  onFollowChange?: (uid: string, followingNow: boolean) => void;
}) {
  const ownerId = map.owner_id;
  const isOwnMap = !!currentUserId && currentUserId === ownerId;
  const ownerName = map.owner_name || map.owner_email?.split("@")[0] || "Unknown";
  const publishedStr = map.published_at ? formatDateTime(map.published_at) : formatDateTime(map.last_modified);

  const teaserRaw = (map.nodes_text || "").replace(/\s+/g, " ").trim();
  const teaser = teaserRaw.length > 160 ? teaserRaw.slice(0, 160) + "…" : teaserRaw;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Author row */}
      <div className="flex items-center justify-between p-4 pb-3">
        <PublicProfileLink uid={ownerId} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
          {map.owner_photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={map.owner_photo_url} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-blue/40 to-accent-purple/40 flex items-center justify-center text-white text-xs font-bold">
              {ownerName[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{ownerName}</p>
            <p className="text-[11px] text-dark-400">{publishedStr}</p>
          </div>
        </PublicProfileLink>
        {showFollowButton && !isOwnMap && ownerId && (
          <FollowButton
            targetUserId={ownerId}
            initialFollowing={!!map.owner_is_followed_by_me}
            size="sm"
            onChange={next => onFollowChange?.(ownerId, next)}
          />
        )}
      </div>

      {/* Thumbnail */}
      <Link href={`/view-map/${map.id}`} className="block relative">
        <div className="h-[240px] bg-dark-700 overflow-hidden">
          {map.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={map.thumbnail} alt={map.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapIcon className="w-12 h-12 text-dark-400" />
            </div>
          )}
        </div>
        <div className="absolute top-3 left-3">
          <VisibilityBadge visibility={map.visibility} size="sm" />
        </div>
      </Link>

      {/* Title + teaser + counts */}
      <div className="p-4 pt-3 space-y-2">
        <Link href={`/view-map/${map.id}`} className="block">
          <h3 className="text-base font-semibold text-white hover:text-accent-blue transition-colors line-clamp-2">
            {map.title}
          </h3>
        </Link>
        {teaser && (
          <p className="text-xs text-dark-300 line-clamp-2 leading-relaxed">{teaser}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-4 text-xs text-dark-400">
            <span className="flex items-center gap-1">
              <Heart className={`w-3.5 h-3.5 ${map.is_liked_by_me ? "fill-accent-pink text-accent-pink" : ""}`} />
              {map.like_count ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {map.comment_count ?? 0}
            </span>
          </div>
          <Link
            href={`/view-map/${map.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline"
          >
            Open <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
