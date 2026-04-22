"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { coursesApi, discussionsApi, CourseOut, DiscussionOut } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, MessageSquare, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import clsx from "clsx";

export default function DiscussionsPage() {
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

  // Poll for messages every 5 seconds (only top-level)
  useEffect(() => {
    if (!cid) return;
    const fetchMessages = async () => {
      try {
        const data = await discussionsApi.list(cid as string);
        // Filter to only top-level (no parentId in the raw data)
        setMessages(data);
      } catch { /* ignore */ }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [cid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !user || !profile || !cid) return;
    await discussionsApi.create(cid as string, { text: text.trim() });
    setText("");
    const data = await discussionsApi.list(cid as string);
    setMessages(data);
  };

  const handleEdit = async (msgId: string) => {
    if (!editText.trim() || !cid) return;
    await discussionsApi.edit(cid as string, msgId, { text: editText.trim() });
    setEditingId(null);
    setEditText("");
    const data = await discussionsApi.list(cid as string);
    setMessages(data);
  };

  const toggleThread = async (msgId: string) => {
    if (expandedThreads.has(msgId)) {
      setExpandedThreads(prev => { const s = new Set(prev); s.delete(msgId); return s; });
    } else {
      setExpandedThreads(prev => new Set(prev).add(msgId));
      // Load replies
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
    setReplies(prev => ({
      ...prev,
      [parentId]: [...(prev[parentId] || []), reply],
    }));
    setReplyText("");
    setReplyingTo(null);
    // Refresh messages to update reply count
    const data = await discussionsApi.list(cid as string);
    setMessages(data);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/5">
        <button onClick={() => router.back()} className="text-dark-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-semibold text-white">{course?.course_name || "Discussion"}</h2>
          <p className="text-xs text-dark-400">{course?.course_code}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-dark-400 text-sm py-8">No messages yet. Start the conversation!</p>
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
                  <div className={clsx(
                    "max-w-[70%] rounded-2xl px-4 py-2.5 relative",
                    isMine ? "bg-accent-blue text-white rounded-br-md" : "glass-card hover:!transform-none rounded-bl-md"
                  )} style={!isMine ? { borderRadius: "16px 16px 16px 4px" } : { borderRadius: "16px 16px 4px 16px" }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={clsx("text-xs font-semibold", isMine ? "text-blue-100" : "text-dark-100")}>{msg.sender_name}</span>
                      {msg.sender_role === "lecturer" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded-full">Lecturer</span>
                      )}
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
                        <button onClick={() => handleEdit(msg.id)} className={clsx(isMine ? "text-white" : "text-accent-blue", "hover:opacity-80")}>
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
                        <p className={clsx("text-[10px]", isMine ? "text-blue-200" : "text-dark-400")}>{formatTime(msg.created_at)}</p>
                        {msg.edited && (
                          <span className={clsx("text-[10px] italic", isMine ? "text-blue-200" : "text-dark-400")}>· edited</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isMine && !isEditing && (
                          <button onClick={() => { setEditingId(msg.id); setEditText(msg.text); }}
                            className={clsx("text-[10px] flex items-center gap-0.5 hover:opacity-80", "text-blue-200")}>
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        <button onClick={() => setReplyingTo(replyingTo === msg.id ? null : msg.id)}
                          className={clsx("text-[10px] flex items-center gap-0.5 hover:opacity-80",
                            isMine ? "text-blue-200" : "text-dark-400"
                          )}>
                          <MessageSquare className="w-3 h-3" /> Reply
                        </button>
                        {replyCount > 0 && (
                          <button onClick={() => toggleThread(msg.id)}
                            className={clsx("text-[10px] flex items-center gap-0.5 hover:opacity-80",
                              isMine ? "text-blue-200" : "text-accent-blue"
                            )}>
                            {replyCount} {replyCount === 1 ? "reply" : "replies"}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reply input */}
                <AnimatePresence>
                  {replyingTo === msg.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className={clsx("flex gap-2", isMine ? "justify-end" : "justify-start", "ml-8")}>
                      <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                        placeholder="Write a reply..." className="glass-input text-xs py-1.5 px-3 w-64"
                        onKeyDown={e => { if (e.key === "Enter") handleReply(msg.id); }} autoFocus />
                      <button onClick={() => handleReply(msg.id)}
                        className="btn-gradient p-1.5 rounded-lg relative z-10">
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
                          <div key={reply.id} className={clsx("flex items-end gap-2", isReplyMine ? "justify-end" : "justify-start")}>
                            {!isReplyMine && (
                              <UserAvatar name={reply.sender_name} photoUrl={reply.sender_photo_url} size={22} role={reply.sender_role === "lecturer" ? "lecturer" : "student"} />
                            )}
                            <div className={clsx("max-w-[60%] rounded-xl px-3 py-2",
                              isReplyMine ? "bg-accent-blue/80 text-white" : "bg-dark-800/50 border border-white/10"
                            )}>
                              <span className={clsx("text-[10px] font-semibold", isReplyMine ? "text-blue-100" : "text-dark-300")}>
                                {reply.sender_name}
                              </span>
                              <p className={clsx("text-xs mt-0.5", isReplyMine ? "text-white" : "text-dark-100")}>{reply.text}</p>
                              <p className={clsx("text-[9px] mt-0.5", isReplyMine ? "text-blue-200" : "text-dark-400")}>{formatTime(reply.created_at)}</p>
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

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-white/5">
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Type a message..." rows={1}
          className="glass-input flex-1 px-4 py-2.5 text-sm resize-none"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
        <button onClick={handleSend} className="btn-gradient p-2.5 rounded-xl relative z-10">
          <Send className="w-5 h-5 text-white relative z-10" />
        </button>
      </div>
    </motion.div>
  );
}
