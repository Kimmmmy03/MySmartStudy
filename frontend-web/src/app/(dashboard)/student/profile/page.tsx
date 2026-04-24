"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Camera, Loader2, CheckCircle, Brain, ImagePlus, Users, UserPlus2, ExternalLink, Bell, Heart, MessageCircle, Map as MapIcon } from "lucide-react";
import SelectWithOther from "@/components/ui/select-with-other";
import { CLASS_UNITS } from "@/lib/constants";
import { semesterLabel } from "@/lib/utils";

const avatarBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [className, setClassName] = useState(profile?.className || "");
  const [year, setYear] = useState(String(profile?.year || 1));
  const [semester, setSemester] = useState(String(profile?.semester || 1));
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [smartBuddyOn, setSmartBuddyOn] = useState(true);

  useEffect(() => {
    setSmartBuddyOn(localStorage.getItem("mss-smartbuddy-off") !== "true");
  }, []);

  // Sync local inputs with the live profile so reloads / external refreshes
  // don't clobber in-flight edits but do pick up uploaded avatar/cover URLs.
  useEffect(() => {
    if (profile?.bio !== undefined) setBio(prev => (prev === "" && profile.bio) ? profile.bio : prev);
  }, [profile?.bio]);

  const photoUrl = profile?.photoURL;
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "U")}&background=6366f1&color=fff&size=120`;
  const avatarUrl = photoUrl
    ? (photoUrl.startsWith("http") ? photoUrl : `${avatarBase}${photoUrl}`)
    : fallbackAvatar;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await usersApi.uploadAvatar(file);
      await refreshProfile();
    } catch {
      setMessage("Failed to upload photo.");
    }
    setUploading(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Cover photo must be under 5MB.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    setUploadingCover(true);
    try {
      await usersApi.uploadCoverPhoto(file);
      await refreshProfile();
    } catch {
      setMessage("Failed to upload cover photo.");
    }
    setUploadingCover(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: {
        display_name?: string; class_name?: string; year?: number; semester?: number;
        bio?: string;
      } = {
        display_name: displayName,
        class_name: className,
        bio: bio.slice(0, 280),
      };
      if (profile?.role === "student") {
        updates.year = parseInt(year);
        updates.semester = parseInt(semester);
      }
      await usersApi.updateMe(updates);
      await refreshProfile();
      setMessage("Profile updated successfully!");
    } catch {
      setMessage("Failed to update profile.");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  const coverUrl = profile?.coverPhotoURL
    ? (profile.coverPhotoURL.startsWith("http") ? profile.coverPhotoURL : `${avatarBase}${profile.coverPhotoURL}`)
    : "";
  const followerCount = profile?.followerCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const isStudent = profile?.role === "student";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
      <div className="glass-card overflow-hidden">
        {/* Cover photo strip — click to replace */}
        {isStudent && (
          <div
            onClick={() => coverRef.current?.click()}
            className="relative h-32 cursor-pointer group bg-gradient-to-br from-accent-purple/30 via-accent-blue/20 to-accent-cyan/20"
            style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingCover ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : (
                <span className="inline-flex items-center gap-2 text-sm text-white">
                  <ImagePlus className="w-4 h-4" /> {coverUrl ? "Change cover" : "Add cover photo"}
                </span>
              )}
            </div>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>
        )}

        <div className={isStudent ? "p-8 pt-4" : "p-8"}>
        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div onClick={() => fileRef.current?.click()}
            className="relative w-28 h-28 rounded-2xl overflow-hidden cursor-pointer group ring-2 ring-accent-blue/30">
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== fallbackAvatar) img.src = fallbackAvatar;
              }}
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <h2 className="text-xl font-bold text-white mt-3">{profile?.displayName}</h2>
          <span className="text-sm text-dark-300 capitalize">{profile?.role}</span>
          {isStudent && (
            <>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1 text-dark-300">
                  <Users className="w-3.5 h-3.5 text-accent-purple" />
                  <strong className="text-white">{followerCount}</strong> follower{followerCount === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1 text-dark-300">
                  <UserPlus2 className="w-3.5 h-3.5 text-accent-blue" />
                  <strong className="text-white">{followingCount}</strong> following
                </span>
              </div>
              {profile?.id && (
                <Link
                  href={`/student/profile/${profile.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent-blue hover:underline"
                >
                  View public profile <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </>
          )}
          <p className="text-xs text-dark-400 mt-2">Click picture to change</p>
        </div>

        {message && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`text-sm px-4 py-2 rounded-xl mb-4 flex items-center gap-2 ${message.includes("success") ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {message.includes("success") && <CheckCircle className="w-4 h-4" />}
            {message}
          </motion.div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Full Name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="glass-input w-full px-4 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Email</label>
            <input type="email" value={profile?.email || ""} disabled
              className="glass-input w-full px-4 py-2 text-sm opacity-50 cursor-not-allowed" />
          </div>
          <SelectWithOther
            label="Class / Unit"
            value={className}
            onChange={setClassName}
            options={CLASS_UNITS}
            placeholder="Select your class / unit"
            size="sm"
          />
          {profile?.role === "student" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Year</label>
                <select value={year} onChange={e => setYear(e.target.value)} className="glass-input w-full px-4 py-2 text-sm">
                  {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Semester</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} className="glass-input w-full px-4 py-2 text-sm">
                  {[1, 2].map(s => <option key={s} value={s}>Semester {semesterLabel(s)}</option>)}
                </select>
              </div>
            </div>
          )}
          {isStudent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-dark-200">Bio</label>
                <span className="text-[11px] text-dark-400">{bio.length}/280</span>
              </div>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 280))}
                placeholder="Tell other students about your interests..."
                rows={3}
                maxLength={280}
                className="glass-input w-full px-4 py-2 text-sm resize-none"
              />
            </div>
          )}

          {/* SmartBuddy Toggle */}
          {profile?.role === "student" && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">SmartBuddy AI</p>
                  <p className="text-xs text-dark-400">AI study recommendations</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !smartBuddyOn;
                  setSmartBuddyOn(next);
                  localStorage.setItem("mss-smartbuddy-off", next ? "false" : "true");
                  window.dispatchEvent(new Event("smartbuddy-toggle"));
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${smartBuddyOn ? "bg-accent-blue" : "bg-dark-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${smartBuddyOn ? "translate-x-5" : ""}`} />
              </button>
            </div>
          )}

          {/* Notification preferences — social graph events (Phase 4) */}
          {isStudent && <NotificationPrefsSection />}

          <button onClick={handleSave} disabled={saving}
            className="btn-gradient w-full text-white py-2.5 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 relative z-10">
            {saving && <Loader2 className="w-4 h-4 animate-spin relative z-10" />}
            <span className="relative z-10">{saving ? "Updating..." : "Update Profile"}</span>
          </button>
        </div>
        </div>
      </div>
    </motion.div>
  );
}


type PrefKey = "newFollower" | "mapLike" | "mapComment" | "followedUserPosts";

const PREF_CONFIG: { key: PrefKey; label: string; hint: string; icon: typeof Bell; tint: string }[] = [
  { key: "newFollower", label: "New followers", hint: "When someone follows you", icon: UserPlus2, tint: "text-accent-blue bg-accent-blue/10" },
  { key: "mapLike", label: "Likes on your maps", hint: "When someone likes a mind map you posted", icon: Heart, tint: "text-accent-pink bg-accent-pink/10" },
  { key: "mapComment", label: "Comments on your maps", hint: "When someone comments on a mind map you posted", icon: MessageCircle, tint: "text-accent-cyan bg-accent-cyan/10" },
  { key: "followedUserPosts", label: "Posts from people you follow", hint: "When someone you follow publishes a new public map", icon: MapIcon, tint: "text-accent-purple bg-accent-purple/10" },
];

/**
 * Notification preferences toggles. Each flip persists immediately through
 * usersApi.updateMe with a partial notification_prefs payload. Optimistic
 * UI with rollback on API failure — matches the FollowButton pattern. A
 * light "Saved" flash confirms the write.
 */
function NotificationPrefsSection() {
  const { profile, refreshProfile } = useAuth();
  const prefs = profile?.notificationPrefs ?? {
    newFollower: true,
    mapLike: true,
    mapComment: true,
    followedUserPosts: false,
  };
  const [local, setLocal] = useState(prefs);
  const [pending, setPending] = useState<PrefKey | null>(null);
  const [savedKey, setSavedKey] = useState<PrefKey | null>(null);

  // Sync when the server-backed profile changes (e.g. after refreshProfile).
  useEffect(() => {
    if (profile?.notificationPrefs) setLocal(profile.notificationPrefs);
  }, [profile?.notificationPrefs]);

  const toggle = async (key: PrefKey) => {
    if (pending) return;
    const prev = local[key];
    const next = !prev;
    setLocal(p => ({ ...p, [key]: next }));
    setPending(key);
    try {
      const snake: Record<string, boolean> = {
        new_follower: local.newFollower,
        map_like: local.mapLike,
        map_comment: local.mapComment,
        followed_user_posts: local.followedUserPosts,
      };
      // Override just the key that flipped — sending the full object keeps the
      // backend's merge semantics simple (we never partial-flip this object).
      const patched = { ...snake, [toSnake(key)]: next };
      await usersApi.updateMe({ notification_prefs: patched as never });
      setSavedKey(key);
      setTimeout(() => setSavedKey(prev2 => (prev2 === key ? null : prev2)), 1200);
      // Refresh so the auth context picks up the canonical server value.
      refreshProfile().catch(() => {});
    } catch {
      // Rollback
      setLocal(p => ({ ...p, [key]: prev }));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-dark-300" />
        <p className="text-sm font-medium text-dark-100">Notification preferences</p>
      </div>
      <div className="space-y-2">
        {PREF_CONFIG.map(p => {
          const on = !!local[p.key];
          const busy = pending === p.key;
          return (
            <div
              key={p.key}
              className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.tint}`}>
                  <p.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{p.label}</p>
                  <p className="text-[11px] text-dark-400">{p.hint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {savedKey === p.key && (
                  <span className="text-[10px] text-accent-emerald font-medium">Saved</span>
                )}
                <button
                  onClick={() => toggle(p.key)}
                  disabled={busy}
                  className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-accent-blue" : "bg-dark-600"} ${busy ? "opacity-60" : ""}`}
                  aria-label={`Toggle ${p.label}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-dark-400">
        Emails mirror these settings — turning one off silences both in-app and email for that type.
      </p>
    </div>
  );
}

function toSnake(key: PrefKey): string {
  switch (key) {
    case "newFollower": return "new_follower";
    case "mapLike": return "map_like";
    case "mapComment": return "map_comment";
    case "followedUserPosts": return "followed_user_posts";
  }
}
