"use client";

import { useState, useEffect, useRef } from "react";
import { messagingApi, usersApi, badgesApi, ConversationOut, PrivateMessageOut, UserSearchResult, type UserOut, type BadgeDefinition } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatTime, resolveBadge } from "@/lib/utils";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Send, Search, MessageSquare, X, ArrowLeft, Plus, Award, Flame, Trophy, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import BadgeIcon from "@/components/badge-icon";

export default function MessagesView() {
  const { user, profile } = useAuth();
  const isStudent = profile?.role === "student";
  const [conversations, setConversations] = useState<ConversationOut[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationOut | null>(null);
  const [messages, setMessages] = useState<PrivateMessageOut[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // New conversation
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit message
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // User profile panel
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState<UserOut | null>(null);
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    messagingApi.conversations().then(setConversations).finally(() => setLoading(false));
  }, []);

  // Poll conversations
  useEffect(() => {
    const interval = setInterval(() => {
      messagingApi.conversations().then(setConversations);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Poll active conversation messages
  useEffect(() => {
    if (!activeConv) return;
    const fetch = () => messagingApi.getMessages(activeConv.id).then(setMessages);
    fetch();
    const interval = setInterval(fetch, 4000);
    return () => clearInterval(interval);
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !activeConv) return;
    await messagingApi.send(activeConv.id, text.trim());
    setText("");
    const data = await messagingApi.getMessages(activeConv.id);
    setMessages(data);
    messagingApi.conversations().then(setConversations);
  };

  const handleEdit = async (msgId: string) => {
    if (!editText.trim() || !activeConv) return;
    await messagingApi.edit(activeConv.id, msgId, editText.trim());
    setEditingId(null);
    setEditText("");
    const data = await messagingApi.getMessages(activeConv.id);
    setMessages(data);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await messagingApi.searchUsers(q);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  // Get the other participant's user ID from a conversation
  const getOtherUserId = (conv: ConversationOut) => {
    return conv.participants.find(p => p !== user?.uid) || conv.participants[0];
  };

  const viewProfile = async (conv: ConversationOut) => {
    const otherId = getOtherUserId(conv);
    if (!otherId) return;
    setLoadingProfile(true);
    setShowProfile(true);
    try {
      const [u, defs] = await Promise.all([
        usersApi.getUser(otherId),
        badgeDefs.length > 0 ? Promise.resolve(badgeDefs) : badgesApi.definitions(),
      ]);
      setProfileUser(u);
      if (badgeDefs.length === 0) setBadgeDefs(defs as BadgeDefinition[]);
    } catch {
      setProfileUser(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const startConversation = async (otherUserId: string) => {
    const conv = await messagingApi.getOrCreate(otherUserId);
    setActiveConv(conv);
    setShowProfile(false);
    setProfileUser(null);
    setShowNew(false);
    setSearchQuery("");
    setSearchResults([]);
    messagingApi.conversations().then(setConversations);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <button onClick={() => setShowNew(true)}
          className="btn-gradient relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <span className="relative z-10 flex items-center gap-2"><Plus className="w-4 h-4" /> New Message</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden" style={{ height: "calc(100vh - 12rem)" }}>
        <div className="flex h-full">
          {/* Conversation List */}
          <div className={clsx("border-r border-white/5 overflow-y-auto",
            activeConv ? "hidden md:block md:w-80" : "w-full md:w-80"
          )}>
            {loading ? (
              <p className="text-dark-400 text-sm text-center py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-dark-500 mx-auto mb-3" />
                <p className="text-dark-400 text-sm">No conversations yet</p>
                <p className="text-dark-500 text-xs mt-1">Start a new message</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button key={conv.id} onClick={() => { setActiveConv(conv); setShowProfile(false); setProfileUser(null); }}
                  className={clsx("w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors",
                    activeConv?.id === conv.id && "bg-white/5"
                  )}>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={conv.participant_names[0] || "User"} photoUrl={conv.participant_photos[0]} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white truncate">{conv.participant_names[0] || "User"}</p>
                        {conv.unread_count > 0 && (
                          <span className="bg-accent-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-dark-400 truncate mt-0.5">{conv.last_message}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Chat Area */}
          {activeConv ? (
            <div className="flex-1 flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <button onClick={() => { setActiveConv(null); setShowProfile(false); }} className="md:hidden text-dark-300 hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => viewProfile(activeConv)}
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar name={activeConv.participant_names[0] || "User"} photoUrl={activeConv.participant_photos[0]} size={32} />
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{activeConv.participant_names[0] || "User"}</p>
                    <p className="text-[10px] text-dark-400">Tap to view profile</p>
                  </div>
                </button>
                <button
                  onClick={() => showProfile ? setShowProfile(false) : viewProfile(activeConv)}
                  className="text-dark-400 hover:text-white transition-colors p-1"
                >
                  {showProfile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* User Profile Panel */}
              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-white/5 overflow-hidden"
                  >
                    {loadingProfile ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 rounded-full border-2 border-accent-blue/20 border-t-accent-blue animate-spin" />
                      </div>
                    ) : profileUser ? (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={profileUser.display_name} photoUrl={profileUser.photo_url} size={48} role={profileUser.role as "student" | "lecturer" | "admin" | undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white truncate">{profileUser.display_name}</p>
                            <p className="text-xs text-dark-400 truncate">{profileUser.email}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-dark-300 capitalize mt-1 inline-block">
                              {profileUser.role}
                              {profileUser.department ? ` · ${profileUser.department}` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-amber/10">
                            <Trophy className="w-3.5 h-3.5 text-accent-amber" />
                            <span className="text-xs font-medium text-accent-amber">{profileUser.points || 0} pts</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-pink/10">
                            <Flame className="w-3.5 h-3.5 text-accent-pink" />
                            <span className="text-xs font-medium text-accent-pink">{profileUser.streak || 0} day streak</span>
                          </div>
                        </div>

                        {/* Badges */}
                        {profileUser.badges && profileUser.badges.length > 0 ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Award className="w-3.5 h-3.5 text-accent-amber" />
                              <span className="text-xs font-medium text-dark-200">Badges ({profileUser.badges.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {profileUser.badges.map((badgeId) => {
                                const badge = resolveBadge(badgeId, badgeDefs);
                                return (
                                  <span
                                    key={badgeId}
                                    title={badge.description}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
                                  >
                                    <BadgeIcon icon={badge.icon} size={14} animated colored lottieUrl={badge.lottie_url} />
                                    {badge.name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-dark-500 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5" /> No badges yet
                          </p>
                        )}

                        {/* Collapse button */}
                        <button
                          onClick={() => setShowProfile(false)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-dark-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Hide profile
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-dark-400 text-center py-4">Could not load profile</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-dark-400 text-sm text-center py-8">No messages yet. Say hello!</p>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_id === user?.uid;
                    const isEditing = editingId === msg.id;
                    return (
                      <div key={msg.id} className={clsx("flex group", isMine ? "justify-end" : "justify-start")}>
                        <div className={clsx("max-w-[70%] rounded-2xl px-4 py-2.5 relative",
                          isMine
                            ? "bg-accent-blue text-white rounded-br-md"
                            : "bg-dark-800/50 border border-white/10 rounded-bl-md"
                        )} style={!isMine ? { borderRadius: "16px 16px 16px 4px" } : { borderRadius: "16px 16px 4px 16px" }}>
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
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className={clsx("text-[10px]", isMine ? "text-blue-200" : "text-dark-400")}>
                              {formatTime(msg.created_at)}
                            </p>
                            {msg.edited && (
                              <span className={clsx("text-[10px] italic", isMine ? "text-blue-200" : "text-dark-400")}>· edited</span>
                            )}
                          </div>
                          {isMine && !isEditing && (
                            <button
                              onClick={() => { setEditingId(msg.id); setEditText(msg.text); }}
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-dark-600 text-dark-100 rounded-full flex items-center justify-center transition-opacity shadow-md"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className={clsx("flex gap-2 p-3 border-t border-white/5", isStudent && "pr-20")}>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder="Type a message..." rows={1}
                  className="glass-input flex-1 px-4 py-2.5 text-sm resize-none"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                <button onClick={handleSend} className="btn-gradient p-2.5 rounded-xl relative z-10">
                  <Send className="w-5 h-5 text-white relative z-10" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-dark-500 mx-auto mb-3" />
                <p className="text-dark-400">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setSearchQuery(""); setSearchResults([]); }} title="New Message">
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search by name or email..."
              value={searchQuery} onChange={e => handleSearch(e.target.value)}
              className="glass-input w-full pl-9 pr-9 py-2.5 text-sm" autoFocus />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-dark-400" />
              </button>
            )}
          </div>

          {searching && <p className="text-sm text-dark-400 text-center py-2">Searching...</p>}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-dark-400 text-center py-4">No users found</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {searchResults.map(u => (
                <button key={u.id} onClick={() => startConversation(u.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left">
                  <UserAvatar name={u.display_name || u.email} photoUrl={u.photo_url} size={32} role={u.role as "student" | "lecturer" | "admin" | undefined} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-100 truncate">{u.display_name || "Unnamed"}</p>
                    <p className="text-xs text-dark-400 truncate">{u.email}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-dark-400 capitalize">{u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </motion.div>
  );
}
