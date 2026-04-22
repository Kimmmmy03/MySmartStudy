"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { coursesApi, discussionsApi, CourseOut, DiscussionOut } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Send, Trash2, MessageSquare, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export default function LecturerDiscussionsPage() {
  const { cid } = useParams();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<DiscussionOut[]>([]);
  const [text, setText] = useState("");
  const [course, setCourse] = useState<CourseOut | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Edit message
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Threading
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState<Record<string, DiscussionOut[]>>({});
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!cid) return;
    coursesApi.get(cid as string).then(setCourse);
  }, [cid]);

  const fetchMessages = useCallback(async () => {
    if (!cid) return;
    const list = await discussionsApi.list(cid as string);
    setMessages(list);
  }, [cid]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !user || !profile || !cid) return;
    await discussionsApi.create(cid as string, { text: text.trim() });
    setText("");
    fetchMessages();
  };

  const handleDeleteMsg = async (msgId: string) => {
    if (!cid) return;
    await discussionsApi.delete(cid as string, msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleEdit = async (msgId: string) => {
    if (!editText.trim() || !cid) return;
    await discussionsApi.edit(cid as string, msgId, { text: editText.trim() });
    setEditingId(null);
    setEditText("");
    fetchMessages();
  };

  const toggleThread = async (msgId: string) => {
    if (expandedThreads.has(msgId)) {
      setExpandedThreads(prev => { const s = new Set(prev); s.delete(msgId); return s; });
    } else {
      setExpandedThreads(prev => new Set(prev).add(msgId));
      if (!replies[msgId]) {
        try {
          const data = await discussionsApi.getReplies(cid as string, msgId);
          setReplies(prev => ({ ...prev, [msgId]: data }));
        } catch { /* ignore */ }
      }
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() || !cid) return;
    const reply = await discussionsApi.reply(cid as string, parentId, { text: replyText.trim() });
    setReplies(prev => ({ ...prev, [parentId]: [...(prev[parentId] || []), reply] }));
    setReplyText("");
    setReplyingTo(null);
    fetchMessages();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <button onClick={() => router.back()} className="text-dark-300 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h2 className="font-semibold text-white">{course?.course_name || "Discussion"}</h2>
          <p className="text-xs text-dark-400">{course?.course_code} &middot; Moderator view</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-dark-400 text-sm py-8">No messages yet.</p>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === user?.uid;
            const isExpanded = expandedThreads.has(msg.id);
            const isEditing = editingId === msg.id;
            const msgReplies = replies[msg.id] || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const replyCount = (msg as any).reply_count || 0;

            return (
              <div key={msg.id} className="space-y-1">
                <div className={clsx("flex items-end gap-2 group", isMine ? "justify-end" : "justify-start")}>
                  {!isMine && (
                    <UserAvatar name={msg.sender_name} photoUrl={msg.sender_photo_url} size={28} role={msg.sender_role === "lecturer" ? "lecturer" : "student"} />
                  )}
                  <div className={clsx("max-w-[70%] rounded-2xl px-4 py-2.5 relative",
                    isMine ? "bg-accent-purple text-white rounded-br-md" : "glass-card hover:!transform-none rounded-bl-md"
                  )}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={clsx("text-xs font-semibold", isMine ? "text-purple-100" : "text-dark-100")}>{msg.sender_name}</span>
                      {msg.sender_role === "lecturer" && <span className="text-[10px] px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded-full">Lecturer</span>}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className={clsx(
                            "text-sm rounded-lg px-2 py-1 flex-1 outline-none border",
                            isMine
                              ? "bg-black/15 text-white border-white/20 placeholder:text-white/40"
                              : "bg-white/10 text-dark-100 border-white/10"
                          )}
                          onKeyDown={e => { if (e.key === "Enter") handleEdit(msg.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                        />
                        <button onClick={() => handleEdit(msg.id)} className={clsx(isMine ? "text-white" : "text-accent-purple", "hover:opacity-80")}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className={clsx(isMine ? "text-white/60 hover:text-white" : "text-dark-400 hover:text-dark-100")}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className={clsx("text-sm", isMine ? "text-white" : "text-dark-100")}>{msg.text}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5">
                        <p className={clsx("text-[10px]", isMine ? "text-purple-200" : "text-dark-400")}>{formatTime(msg.created_at)}</p>
                        {msg.edited && (
                          <span className={clsx("text-[10px] italic", isMine ? "text-purple-200" : "text-dark-400")}>· edited</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isMine && !isEditing && (
                          <button onClick={() => { setEditingId(msg.id); setEditText(msg.text); }}
                            className={clsx("text-[10px] flex items-center gap-0.5 hover:opacity-80", "text-purple-200")}>
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        <button onClick={() => setReplyingTo(replyingTo === msg.id ? null : msg.id)}
                          className={clsx("text-[10px] flex items-center gap-0.5 hover:opacity-80",
                            isMine ? "text-purple-200" : "text-dark-400"
                          )}>
                          <MessageSquare className="w-3 h-3" /> Reply
                        </button>
                        {replyCount > 0 && (
                          <button onClick={() => toggleThread(msg.id)}
                            className={clsx("text-[10px] flex items-center gap-0.5 hover:opacity-80",
                              isMine ? "text-purple-200" : "text-accent-purple"
                            )}>
                            {replyCount} {replyCount === 1 ? "reply" : "replies"}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteMsg(msg.id)}
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Reply input */}
                <AnimatePresence>
                  {replyingTo === msg.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className={clsx("flex gap-2 ml-8", isMine ? "justify-end" : "justify-start")}>
                      <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                        placeholder="Write a reply..." className="glass-input text-xs py-1.5 px-3 w-64"
                        onKeyDown={e => { if (e.key === "Enter") handleReply(msg.id); }} autoFocus />
                      <button onClick={() => handleReply(msg.id)} className="btn-gradient p-1.5 rounded-lg relative z-10">
                        <Send className="w-3.5 h-3.5 text-white relative z-10" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Thread replies */}
                <AnimatePresence>
                  {isExpanded && msgReplies.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="ml-8 space-y-2 border-l-2 border-white/5 pl-3">
                      {msgReplies.map(reply => {
                        const isReplyMine = reply.sender_id === user?.uid;
                        return (
                          <div key={reply.id} className={clsx("flex items-end gap-2 group", isReplyMine ? "justify-end" : "justify-start")}>
                            {!isReplyMine && (
                              <UserAvatar name={reply.sender_name} photoUrl={reply.sender_photo_url} size={22} role={reply.sender_role === "lecturer" ? "lecturer" : "student"} />
                            )}
                            <div className={clsx("max-w-[60%] rounded-xl px-3 py-2 relative",
                              isReplyMine ? "bg-accent-purple/80 text-white" : "bg-dark-800/50 border border-white/10"
                            )}>
                              <span className={clsx("text-[10px] font-semibold", isReplyMine ? "text-purple-100" : "text-dark-300")}>
                                {reply.sender_name}
                              </span>
                              <p className={clsx("text-xs mt-0.5", isReplyMine ? "text-white" : "text-dark-100")}>{reply.text}</p>
                              <p className={clsx("text-[9px] mt-0.5", isReplyMine ? "text-purple-200" : "text-dark-400")}>{formatTime(reply.created_at)}</p>
                              <button onClick={() => handleDeleteMsg(reply.id)}
                                className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center transition-opacity">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/10">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..."
          rows={1} className="glass-input flex-1 resize-none"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
        <button onClick={handleSend} className="btn-gradient relative z-10 p-2.5 rounded-xl">
          <span className="relative z-10"><Send className="w-5 h-5" /></span>
        </button>
      </div>
    </motion.div>
  );
}
