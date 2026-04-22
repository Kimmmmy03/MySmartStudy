"use client";

import { useState, useRef, useEffect } from "react";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Camera, Loader2, CheckCircle, Brain } from "lucide-react";
import SelectWithOther from "@/components/ui/select-with-other";
import { CLASS_UNITS } from "@/lib/constants";

const avatarBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [className, setClassName] = useState(profile?.className || "");
  const [year, setYear] = useState(String(profile?.year || 1));
  const [semester, setSemester] = useState(String(profile?.semester || 1));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [smartBuddyOn, setSmartBuddyOn] = useState(true);

  useEffect(() => {
    setSmartBuddyOn(localStorage.getItem("mss-smartbuddy-off") !== "true");
  }, []);

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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: { display_name?: string; class_name?: string; year?: number; semester?: number } = {
        display_name: displayName,
        class_name: className,
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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
      <div className="glass-card p-8">
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
          <p className="text-xs text-dark-400 mt-1">Click picture to change</p>
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
                  {[1, 2].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
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

          <button onClick={handleSave} disabled={saving}
            className="btn-gradient w-full text-white py-2.5 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 relative z-10">
            {saving && <Loader2 className="w-4 h-4 animate-spin relative z-10" />}
            <span className="relative z-10">{saving ? "Updating..." : "Update Profile"}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
