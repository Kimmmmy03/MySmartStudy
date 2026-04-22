"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { announcementsApi, AnnouncementOut } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export default function AnnouncementsPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([]);

  useEffect(() => {
    if (!cid) return;
    const load = async () => {
      const data = await announcementsApi.list(cid as string);
      setAnnouncements(data);
    };
    load();
  }, [cid]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Announcements</h1>

      {announcements.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className="glass-card p-5">
              <div className="flex items-start gap-3">
                <UserAvatar name={a.sender_name} photoUrl={a.sender_photo_url} size={36} role="lecturer" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">{a.title}</h3>
                  <span className="text-xs text-dark-400">{a.sender_name} · {formatDate(a.created_at)}</span>
                </div>
              </div>
              <p className="text-sm text-dark-200 mt-3 whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
