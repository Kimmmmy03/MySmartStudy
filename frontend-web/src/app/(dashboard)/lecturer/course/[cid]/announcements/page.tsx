"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { announcementsApi, AnnouncementOut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import Modal from "@/components/ui/modal";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LecturerAnnouncementsPage() {
  const { cid } = useParams();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", content: "" });

  const fetchAnnouncements = useCallback(async () => {
    if (!cid) return;
    const list = await announcementsApi.list(cid as string);
    setAnnouncements(list.reverse());
  }, [cid]);

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 10000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim() || !user || !profile || !cid) return;
    await announcementsApi.create(cid as string, {
      title: form.title,
      content: form.content,
    });
    setShowCreate(false);
    setForm({ title: "", content: "" });
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    if (!cid) return;
    await announcementsApi.delete(cid as string, id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <button onClick={() => setShowCreate(true)}
          className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Announcement</span>
        </button>
      </div>

      {announcements.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className="glass-card p-5 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <UserAvatar name={a.sender_name} photoUrl={a.sender_photo_url} size={36} role="lecturer" />
                  <div>
                    <h3 className="font-semibold text-white">{a.title}</h3>
                    <span className="text-xs text-dark-400">{a.sender_name} · {formatDate(a.created_at)}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(a.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg text-dark-400 hover:text-red-400 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-dark-200 mt-3 whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Announcement">
        <div className="space-y-3">
          <input type="text" placeholder="Title" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="glass-input w-full" />
          <textarea placeholder="Content" value={form.content} rows={4}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            className="glass-input w-full" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg">Cancel</button>
            <button onClick={handleCreate} className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm">
              <span className="relative z-10">Publish</span>
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
