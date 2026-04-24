"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Users, UserPlus2, Loader2, Mail, Map as MapIcon } from "lucide-react";
import { socialApi, mapsApi, type PublicProfileOut, type MapOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { resolveBackendUrl } from "@/lib/utils";
import FollowButton from "@/components/follow-button";
import MapFeedCard from "@/components/map-feed-card";

/**
 * Public profile page (Phase 1 — no map grid yet; feed/explore come in Phase 2).
 *
 * If the UID matches the current user, redirect to the self-profile editor so
 * there's one source of truth for profile editing. Otherwise render the
 * public view: cover photo, avatar, name, bio, follower/following counts,
 * follow button.
 */
export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { profile: me } = useAuth();
  const uid = String((params as { uid?: string }).uid || "");

  const [profile, setProfile] = useState<PublicProfileOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [localFollowerCount, setLocalFollowerCount] = useState(0);
  const [maps, setMaps] = useState<MapOut[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);

  const isSelf = useMemo(() => !!me && me.id === uid, [me, uid]);

  useEffect(() => {
    // Self-view → push to editable profile so we don't have two places to edit.
    if (isSelf) {
      router.replace("/student/profile");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMapsLoading(true);
    setNotFound(false);
    socialApi
      .profile(uid)
      .then(p => {
        if (cancelled) return;
        setProfile(p);
        setLocalFollowerCount(p.follower_count);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    mapsApi
      .publicByUser(uid, 30)
      .then(list => {
        if (!cancelled) setMaps(list);
      })
      .catch(() => {
        if (!cancelled) setMaps([]);
      })
      .finally(() => {
        if (!cancelled) setMapsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, isSelf, router]);

  if (isSelf) return null; // redirect in progress

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-accent-purple animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-xl mx-auto glass-card p-10 text-center">
        <p className="text-dark-200 font-medium">Profile not found</p>
        <p className="text-dark-400 text-xs mt-1">This account may have been deleted.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    );
  }

  const avatar = profile.photo_url
    ? (profile.photo_url.startsWith("http") ? profile.photo_url : resolveBackendUrl(profile.photo_url))
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || "U")}&background=6366f1&color=fff&size=128`;
  const cover = profile.cover_photo_url
    ? (profile.cover_photo_url.startsWith("http") ? profile.cover_photo_url : resolveBackendUrl(profile.cover_photo_url))
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-dark-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="glass-card overflow-hidden">
        {/* Cover strip */}
        <div
          className="h-40 bg-gradient-to-br from-accent-purple/30 via-accent-blue/20 to-accent-cyan/20 relative"
          style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Header row — avatar overlaps cover */}
        <div className="px-6 pb-6 -mt-10 relative">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-4">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt=""
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-dark-800 shadow-lg bg-dark-700"
                />
              </div>
              <div className="pb-1 min-w-0">
                <h1 className="text-xl font-bold text-white truncate">{profile.display_name || "Unknown"}</h1>
                <p className="text-xs text-dark-400 capitalize flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {profile.role}
                </p>
              </div>
            </div>
            <FollowButton
              targetUserId={profile.id}
              initialFollowing={profile.is_followed_by_me}
              onChange={next => setLocalFollowerCount(c => c + (next ? 1 : -1))}
            />
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-dark-200 leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}

          {/* Counts */}
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-dark-300">
              <Users className="w-4 h-4 text-accent-purple" />
              <strong className="text-white">{localFollowerCount}</strong>
              <span>follower{localFollowerCount === 1 ? "" : "s"}</span>
            </span>
            <span className="flex items-center gap-1.5 text-dark-300">
              <UserPlus2 className="w-4 h-4 text-accent-blue" />
              <strong className="text-white">{profile.following_count}</strong>
              <span>following</span>
            </span>
          </div>
        </div>

        {/* Public maps grid (Phase 2) */}
        <div className="border-t border-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapIcon className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-white">
              Public mind maps
              {maps.length > 0 && <span className="text-dark-400 font-normal ml-2">({maps.length})</span>}
            </h2>
          </div>
          {mapsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
            </div>
          ) : maps.length === 0 ? (
            <div className="text-center py-10">
              <MapIcon className="w-10 h-10 text-dark-500 mx-auto mb-2" />
              <p className="text-xs text-dark-400">
                {profile.display_name || "This student"} hasn&apos;t posted any public mind maps yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maps.map(m => (
                <MapFeedCard key={m.id} map={m} currentUserId={me?.id} showFollowButton={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
