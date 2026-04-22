"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { topicsApi, TopicOut, TopicPost } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import Modal from "@/components/ui/modal";
import { ArrowLeft, Plus, Pin, MessageSquare, Trash2, Send, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function StudentForumPage() {
  const { cid } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const courseId = cid as string;

  const [topics, setTopics] = useState<TopicOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const [activeTopic, setActiveTopic] = useState<TopicOut | null>(null);
  const [posts, setPosts] = useState<TopicPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [newPost, setNewPost] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadTopics = () => {
    topicsApi.list(courseId).then(setTopics).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!cid) return;
    loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await topicsApi.create(courseId, { title, description: desc });
    setTitle(""); setDesc(""); setShowCreate(false);
    loadTopics();
  };

  const openTopic = async (topic: TopicOut) => {
    setActiveTopic(topic);
    setPostsLoading(true);
    const p = await topicsApi.getPosts(courseId, topic.id);
    setPosts(p);
    setPostsLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSendPost = async () => {
    if (!newPost.trim() || !activeTopic) return;
    const p = await topicsApi.createPost(courseId, activeTopic.id, { text: newPost });
    setPosts(prev => [...prev, p]);
    setNewPost("");
    setTopics(prev => prev.map(t => t.id === activeTopic.id ? { ...t, reply_count: t.reply_count + 1 } : t));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleDeletePost = async (postId: string) => {
    if (!activeTopic) return;
    await topicsApi.deletePost(courseId, activeTopic.id, postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  useEffect(() => {
    if (!activeTopic) return;
    const interval = setInterval(async () => {
      const p = await topicsApi.getPosts(courseId, activeTopic.id);
      setPosts(p);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic?.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => activeTopic ? setActiveTopic(null) : router.back()}
        className="text-sm text-dark-300 hover:text-white flex items-center gap-1 mb-4">
        {activeTopic ? <><ChevronLeft className="w-4 h-4" /> Back to Topics</> : <><ArrowLeft className="w-4 h-4" /> Back</>}
      </button>

      {!activeTopic ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent-blue" /> Discussion Forum
            </h1>
            <button onClick={() => setShowCreate(true)}
              className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
              <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Topic</span>
            </button>
          </div>

          {loading ? (
            <p className="text-dark-400 text-center py-8">Loading topics...</p>
          ) : topics.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-dark-500 mx-auto mb-3" />
              <p className="text-dark-400">No discussion topics yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topics.map(t => (
                <div key={t.id} onClick={() => openTopic(t)}
                  className={clsx("glass-card p-4 hover:bg-white/3 transition-colors cursor-pointer", t.pinned && "border-accent-amber/20")}>
                  <div className="flex items-center gap-2 mb-1">
                    {t.pinned && <Pin className="w-3.5 h-3.5 text-accent-amber" />}
                    <h3 className="font-semibold text-white text-sm">{t.title}</h3>
                  </div>
                  {t.description && <p className="text-xs text-dark-300 line-clamp-1">{t.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-dark-400">
                    <span>by {t.author_name}</span>
                    <span>{t.reply_count} post{t.reply_count !== 1 ? "s" : ""}</span>
                    <span>{t.last_activity ? timeAgo(t.last_activity) : timeAgo(t.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col h-[calc(100vh-12rem)]">
          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-2">
              {activeTopic.pinned && <Pin className="w-4 h-4 text-accent-amber" />}
              <h2 className="text-lg font-bold text-white">{activeTopic.title}</h2>
            </div>
            {activeTopic.description && <p className="text-sm text-dark-300 mt-1">{activeTopic.description}</p>}
            <p className="text-xs text-dark-400 mt-2">Started by {activeTopic.author_name} · {timeAgo(activeTopic.created_at)}</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {postsLoading ? (
              <p className="text-dark-400 text-center py-6">Loading posts...</p>
            ) : posts.length === 0 ? (
              <p className="text-dark-400 text-center py-6 text-sm">No posts yet. Start the discussion!</p>
            ) : posts.map(p => {
              const isMe = p.sender_id === user?.uid || p.sender_id === user?.id;
              return (
                <div key={p.id} className={clsx("glass-card p-3 max-w-[85%] group", isMe ? "ml-auto" : "")}>
                  <div className="flex items-center gap-2 mb-1">
                    <UserAvatar name={p.sender_name} photoUrl={p.sender_photo_url} size={22} role={p.sender_role === "lecturer" ? "lecturer" : "student"} />
                    <span className="text-xs font-medium text-dark-200">{p.sender_name}</span>
                    {p.sender_role === "lecturer" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple">Lecturer</span>
                    )}
                    <span className="text-[10px] text-dark-500 ml-auto">{timeAgo(p.created_at)}</span>
                    {isMe && (
                      <button onClick={() => handleDeletePost(p.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-dark-500 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-dark-100 whitespace-pre-wrap">{p.text}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2">
            <input type="text" value={newPost} onChange={e => setNewPost(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendPost()}
              placeholder="Write a post..." className="glass-input flex-1 py-2.5 text-sm" />
            <button onClick={handleSendPost} disabled={!newPost.trim()}
              className="btn-gradient relative z-10 p-2.5 rounded-lg disabled:opacity-50">
              <Send className="w-4 h-4 relative z-10" />
            </button>
          </div>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Discussion Topic">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-dark-300 mb-1 block">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="glass-input w-full py-2 text-sm" placeholder="Topic title..." />
          </div>
          <div>
            <label className="text-xs text-dark-300 mb-1 block">Description (optional)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              className="glass-input w-full py-2 text-sm min-h-[60px]" placeholder="What is this topic about?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-dark-300 hover:text-white rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={!title.trim()}
              className="btn-gradient relative z-10 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              <span className="relative z-10">Create Topic</span>
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
