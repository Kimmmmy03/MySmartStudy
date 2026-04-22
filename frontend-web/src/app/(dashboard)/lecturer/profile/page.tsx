"use client";

import { useState, useRef } from "react";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Camera, Loader2, Flame, Coins, Award, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import SelectWithOther from "@/components/ui/select-with-other";
import { DEPARTMENTS } from "@/lib/constants";

const avatarBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

export default function LecturerProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "L")}&background=7c3aed&color=fff&size=120`;
  const photoUrl = profile?.photoURL
    ? (profile.photoURL.startsWith("http") ? profile.photoURL : `${avatarBase}${profile.photoURL}`)
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await usersApi.updateMe({ display_name: displayName, department });
      await refreshProfile();
      setMessage("Profile updated successfully!");
    } catch {
      setMessage("Failed to update profile.");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
      <div className="glass-card p-8">
        <div className="flex flex-col items-center mb-6">
          <div onClick={() => fileRef.current?.click()} className="relative w-28 h-28 rounded-full overflow-hidden cursor-pointer group ring-2 ring-accent-purple/30">
            <img
              src={photoUrl}
              alt="Profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== fallbackAvatar) img.src = fallbackAvatar;
              }}
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <h2 className="text-xl font-bold text-white mt-3">{profile?.displayName}</h2>
          <span className="text-sm text-dark-300 capitalize">{profile?.role}</span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-card p-3 text-center border border-accent-pink/20">
            <Flame className="w-5 h-5 text-accent-pink mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{profile?.streak ?? 0}</p>
            <p className="text-[11px] text-dark-400">Day Streak</p>
          </div>
          <div className="glass-card p-3 text-center border border-accent-amber/20">
            <Coins className="w-5 h-5 text-accent-amber mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{profile?.points ?? 0}</p>
            <p className="text-[11px] text-dark-400">Points</p>
          </div>
          <div className="glass-card p-3 text-center border border-accent-purple/20">
            <Award className="w-5 h-5 text-accent-purple mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{profile?.badges?.length ?? 0}</p>
            <p className="text-[11px] text-dark-400">Badges</p>
          </div>
        </div>

        {message && (
          <div className={`text-sm px-4 py-2 rounded-lg mb-4 ${message.includes("success") ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {message}
          </div>
        )}

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
            label="Department"
            value={department}
            onChange={setDepartment}
            options={DEPARTMENTS}
            placeholder="Select your department"
            size="sm"
          />
          <button onClick={handleSave} disabled={saving}
            className="btn-gradient relative z-10 w-full py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            <span className="relative z-10 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Updating..." : "Update Profile"}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
