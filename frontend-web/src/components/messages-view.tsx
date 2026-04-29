"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { messagingApi, usersApi, badgesApi, ConversationOut, PrivateMessageOut, UserSearchResult, type UserOut, type BadgeDefinition } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatTime, formatChatTimestamp, resolveBadge } from "@/lib/utils";
import Modal from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Send, Search, MessageSquare, X, ArrowLeft, Plus, Award, Flame, Trophy, ChevronDown, ChevronUp, Pencil, Check, Trash2, GraduationCap, Building2, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import BadgeIcon from "@/components/badge-icon";

export default function MessagesView() {
  const { user, profile } = useAuth();
  const isStudent = profile?.role === "student";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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

  // Inbox search + sort/filter (separate from the new-conversation search above).
  // sortMode is a single dropdown that combines ordering ("recent"/"alpha") with
  // role filtering ("lecturers"/"students") since the user only ever picks one.
  type SortMode = "recent" | "alpha" | "lecturers" | "students";
  const [inboxQuery, setInboxQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Edit message
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Delete-confirmation modal — id of the message awaiting confirmation,
  // or null when no dialog is open.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Long-press to reveal the edit/delete pills on touch devices. We track
  // the currently-revealed message id so only one bubble shows actions at
  // a time (matches WhatsApp/Telegram). Tapping anywhere else dismisses it.
  const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = (msgId: string) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setActionsOpenId(msgId);
      // Soft haptic feedback on supported devices.
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(15); } catch { /* ignore */ }
      }
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // User profile panel
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState<UserOut | null>(null);
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Sort conversations newest-first; defensive against backend ordering gaps.
  const sortConversations = (list: ConversationOut[]) =>
    [...list].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

  // Sort messages oldest-first so the latest sits at the bottom (WhatsApp-style).
  const sortMessages = (list: PrivateMessageOut[]) =>
    [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const refreshConversations = () =>
    messagingApi.conversations().then(c => setConversations(sortConversations(c))).catch(() => {});

  useEffect(() => {
    messagingApi.conversations()
      .then(c => setConversations(sortConversations(c)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-open a conversation when arriving via a notification link
  // (?conv={id}). Strip the query after selecting so a refresh doesn't
  // re-open it after the user navigates away inside the inbox.
  useEffect(() => {
    const convId = searchParams?.get("conv");
    if (!convId || conversations.length === 0) return;
    if (activeConv?.id === convId) return;
    const target = conversations.find(c => c.id === convId);
    if (target) {
      setActiveConv(target);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("conv");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  }, [searchParams, conversations, activeConv?.id, pathname, router]);

  // Poll conversations
  useEffect(() => {
    const interval = setInterval(refreshConversations, 8000);
    return () => clearInterval(interval);
  }, []);

  // Poll active conversation messages. Also refresh the conversation list so
  // last_message preview + ordering update without waiting for the slower
  // 8s conversations poll.
  useEffect(() => {
    if (!activeConv) return;
    const fetch = () => {
      messagingApi.getMessages(activeConv.id)
        .then(m => setMessages(sortMessages(m)))
        .catch(() => {});
      refreshConversations();
    };
    fetch();
    const interval = setInterval(fetch, 3000);
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
    setMessages(sortMessages(data));
    refreshConversations();
  };

  const handleEdit = async (msgId: string) => {
    if (!editText.trim() || !activeConv) return;
    await messagingApi.edit(activeConv.id, msgId, editText.trim());
    setEditingId(null);
    setEditText("");
    const data = await messagingApi.getMessages(activeConv.id);
    setMessages(sortMessages(data));
  };

  const confirmDelete = async () => {
    if (!activeConv || !pendingDeleteId) return;
    const msgId = pendingDeleteId;
    setDeleting(true);
    // Optimistic: flip the local copy to deleted so the placeholder shows
    // immediately even if the server round-trip takes a moment.
    setMessages(prev =>
      prev.map(m =>
        m.id === msgId ? { ...m, deleted: true, text: "" } : m
      )
    );
    try {
      await messagingApi.delete(activeConv.id, msgId);
      const data = await messagingApi.getMessages(activeConv.id);
      setMessages(sortMessages(data));
      refreshConversations();
    } catch {
      // Revert on failure by refetching the truth.
      const data = await messagingApi.getMessages(activeConv.id);
      setMessages(sortMessages(data));
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
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
    refreshConversations();
  };

  // Dismiss the long-press action menu when tapping anywhere outside a
  // message bubble (touchstart catches the first finger-down on mobile).
  useEffect(() => {
    if (!actionsOpenId) return;
    const dismiss = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-msg-bubble]")) return;
      setActionsOpenId(null);
    };
    document.addEventListener("touchstart", dismiss, { passive: true });
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("touchstart", dismiss);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [actionsOpenId]);

  // Cancel any pending long-press timer when the component unmounts.
  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  // Close the sort dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    if (showSortMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSortMenu]);

  // Apply inbox search + sort/filter on top of the already-sorted state.
  // The search matches participant name (case-insensitive); empty = no filter.
  const visibleConversations = (() => {
    const q = inboxQuery.trim().toLowerCase();
    let list = conversations;
    if (q) {
      list = list.filter(c => (c.participant_names[0] || "").toLowerCase().includes(q));
    }
    if (sortMode === "lecturers") {
      list = list.filter(c => (c.participant_roles?.[0] || "") === "lecturer");
    } else if (sortMode === "students") {
      list = list.filter(c => (c.participant_roles?.[0] || "") === "student");
    }
    if (sortMode === "alpha") {
      list = [...list].sort((a, b) =>
        (a.participant_names[0] || "").localeCompare(b.participant_names[0] || "")
      );
    } else if (sortMode === "lecturers" || sortMode === "students") {
      // Within a role filter, fall back to recent ordering.
      list = sortConversations(list);
    }
    // "recent" already comes pre-sorted from sortConversations on fetch.
    return list;
  })();

  const sortLabels: Record<typeof sortMode, string> = {
    recent: "Recent",
    alpha: "A → Z",
    lecturers: "Lecturers",
    students: "Students",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Page header — collapse to a tight bar on mobile so the chat
          gets back vertical space; hide it entirely once a conversation
          is open on phones since the chat header already shows context. */}
      <div className={clsx(
        "flex items-center justify-between mb-3 md:mb-6",
        activeConv && "hidden md:flex"
      )}>
        <h1 className="text-xl md:text-2xl font-bold text-white">Messages</h1>
        <button onClick={() => setShowNew(true)}
          className="btn-gradient relative z-10 flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm">
          <span className="relative z-10 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Message</span>
            <span className="sm:hidden">New</span>
          </span>
        </button>
      </div>

      {/* Mobile reserves: sticky navbar (3.5rem) + main p-4 top (1rem) +
          MobileBottomNav cushion from main pb-24 (6rem) + safe-area inset
          on iOS (~1-2rem) ≈ 12rem. When the page header is visible (no
          chat selected) reserve another ~3rem for the h1 + mb-3. Desktop
          has no bottom nav so the original 12rem reserve still applies.
          dvh keeps the input above the on-screen keyboard. */}
      <div className={clsx(
        "glass-card overflow-hidden md:h-[calc(100vh-12rem)]",
        activeConv ? "h-[calc(100dvh-13rem)]" : "h-[calc(100dvh-16rem)]"
      )}>
        <div className="flex h-full">
          {/* Conversation List */}
          <div className={clsx("border-r border-white/5 flex flex-col",
            activeConv ? "hidden md:flex md:w-80" : "w-full md:w-80"
          )}>
            {/* Inbox toolbar — search + sort/filter. Hidden while loading
                so the empty-state message gets the full panel. */}
            {!loading && conversations.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-dark-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={inboxQuery}
                    onChange={e => setInboxQuery(e.target.value)}
                    placeholder="Search chats..."
                    className="glass-input w-full pl-8 pr-7 py-1.5 text-xs"
                  />
                  {inboxQuery && (
                    <button
                      onClick={() => setInboxQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="relative" ref={sortMenuRef}>
                  <button
                    onClick={() => setShowSortMenu(s => !s)}
                    className={clsx(
                      "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] border transition-colors",
                      sortMode === "recent"
                        ? "border-white/10 text-dark-300 hover:bg-white/5"
                        : "border-accent-blue/40 text-accent-blue bg-accent-blue/10"
                    )}
                    title="Sort & filter"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    {sortLabels[sortMode]}
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1.5 w-40 glass-card z-30 py-1 dropdown-menu"
                      >
                        {(["recent", "alpha", "lecturers", "students"] as SortMode[]).map(mode => (
                          <button
                            key={mode}
                            onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                            className={clsx(
                              "w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors flex items-center justify-between",
                              sortMode === mode ? "text-accent-blue font-medium" : "text-dark-200"
                            )}
                          >
                            {sortLabels[mode]}
                            {sortMode === mode && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* List body */}
            <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-dark-400 text-sm text-center py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-dark-500 mx-auto mb-3" />
                <p className="text-dark-400 text-sm">No conversations yet</p>
                <p className="text-dark-500 text-xs mt-1">Start a new message</p>
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Search className="w-8 h-8 text-dark-500 mx-auto mb-2" />
                <p className="text-dark-400 text-sm">No matches</p>
                <p className="text-dark-500 text-xs mt-1">
                  {inboxQuery ? "Try a different search term" : "Try a different filter"}
                </p>
              </div>
            ) : (
              visibleConversations.map(conv => (
                <button key={conv.id} onClick={() => { setActiveConv(conv); setShowProfile(false); setProfileUser(null); }}
                  className={clsx("w-full text-left px-3 md:px-4 py-2.5 md:py-3 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors",
                    activeConv?.id === conv.id && "bg-white/5"
                  )}>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={conv.participant_names[0] || "User"} photoUrl={conv.participant_photos[0]} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate">{conv.participant_names[0] || "User"}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.last_message_at && (
                            <span className={clsx(
                              "text-[10px]",
                              conv.unread_count > 0 ? "text-accent-blue font-medium" : "text-dark-400"
                            )}>
                              {formatChatTimestamp(conv.last_message_at)}
                            </span>
                          )}
                          {conv.unread_count > 0 && (
                            <span className="bg-accent-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
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
          </div>

          {/* Chat Area */}
          {activeConv ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Chat Header — tighter on mobile so the chat takes priority. */}
              <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-b border-white/5">
                <button
                  onClick={() => { setActiveConv(null); setShowProfile(false); }}
                  className="md:hidden -ml-1 p-1.5 rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Back to inbox"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => viewProfile(activeConv)}
                  className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar name={activeConv.participant_names[0] || "User"} photoUrl={activeConv.participant_photos[0]} size={32} />
                  <div className="min-w-0 text-left">
                    <p className="font-medium text-white truncate text-sm md:text-base">{activeConv.participant_names[0] || "User"}</p>
                    <p className="text-[10px] text-dark-400 hidden sm:block">Tap to view profile</p>
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
                            </span>
                          </div>
                        </div>

                        {/* Academic info — only render the chips that have data,
                            so a lecturer (no class) doesn't show empty boxes. */}
                        {(profileUser.class_name || profileUser.year || profileUser.semester || profileUser.department) && (
                          <div className="flex flex-wrap gap-1.5">
                            {profileUser.class_name && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                                <GraduationCap className="w-3 h-3" />
                                {profileUser.class_name}
                              </span>
                            )}
                            {profileUser.department && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                                <Building2 className="w-3 h-3" />
                                {profileUser.department}
                              </span>
                            )}
                            {(profileUser.year || profileUser.semester) && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
                                {profileUser.year ? `Year ${profileUser.year}` : ""}
                                {profileUser.year && profileUser.semester ? " · " : ""}
                                {profileUser.semester ? `Sem ${profileUser.semester}` : ""}
                              </span>
                            )}
                          </div>
                        )}

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
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 chat-bg">
                {messages.length === 0 ? (
                  <p className="text-dark-400 text-sm text-center py-8">No messages yet. Say hello!</p>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_id === user?.uid;
                    const isEditing = editingId === msg.id;
                    const isDeleted = !!msg.deleted;
                    const otherName = activeConv.participant_names[0] || "User";
                    const otherPhoto = activeConv.participant_photos[0];
                    return (
                      <div key={msg.id} className={clsx("flex group items-end gap-2", isMine ? "justify-end" : "justify-start")}>
                        {!isMine && (
                          <div className="flex-shrink-0 mb-1">
                            <UserAvatar name={otherName} photoUrl={otherPhoto} size={28} />
                          </div>
                        )}
                        <div
                          data-msg-bubble
                          onTouchStart={() => { if (isMine && !isEditing && !isDeleted) startLongPress(msg.id); }}
                          onTouchEnd={cancelLongPress}
                          onTouchCancel={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onContextMenu={e => {
                            // Long-press on iOS triggers contextmenu; suppress
                            // the OS menu so our action pills win.
                            if (isMine && !isEditing && !isDeleted) {
                              e.preventDefault();
                              setActionsOpenId(msg.id);
                            }
                          }}
                          className={clsx("max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 md:px-4 py-2 md:py-2.5 relative select-none md:select-auto",
                          isDeleted
                            ? "bg-dark-700/40 border border-white/5 text-dark-400 italic"
                            : isMine
                              ? "bg-accent-blue text-white rounded-br-md"
                              : "bg-dark-800/50 border border-white/10 rounded-bl-md"
                        )} style={isDeleted ? { borderRadius: "16px" } : !isMine ? { borderRadius: "16px 16px 16px 4px" } : { borderRadius: "16px 16px 4px 16px" }}>
                          {isDeleted ? (
                            <p className="text-sm flex items-center gap-1.5">
                              <Trash2 className="w-3.5 h-3.5" />
                              Message deleted
                            </p>
                          ) : isEditing ? (
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
                            <p className={clsx("text-[10px]", isDeleted ? "text-dark-500" : isMine ? "text-blue-200" : "text-dark-400")}>
                              {formatTime(msg.created_at)}
                            </p>
                            {msg.edited && !isDeleted && (
                              <span className={clsx("text-[10px] italic", isMine ? "text-blue-200" : "text-dark-400")}>· edited</span>
                            )}
                          </div>
                          {isMine && !isEditing && !isDeleted && (
                            // Desktop: hover-reveal. Mobile: hidden until the
                            // user long-presses the bubble (matches WhatsApp).
                            <div className={clsx(
                              "absolute -top-2 -right-2 transition-opacity flex gap-1",
                              actionsOpenId === msg.id
                                ? "opacity-100"
                                : "opacity-0 md:group-hover:opacity-100 pointer-events-none md:pointer-events-auto"
                            )}>
                              <button
                                onClick={() => { setActionsOpenId(null); setEditingId(msg.id); setEditText(msg.text); }}
                                className="w-7 h-7 md:w-6 md:h-6 bg-dark-600 text-dark-100 rounded-full flex items-center justify-center shadow-md hover:bg-dark-500 active:scale-90"
                                title="Edit"
                                aria-label="Edit message"
                              >
                                <Pencil className="w-3.5 h-3.5 md:w-3 md:h-3" />
                              </button>
                              <button
                                onClick={() => { setActionsOpenId(null); setPendingDeleteId(msg.id); }}
                                className="w-7 h-7 md:w-6 md:h-6 bg-red-500/90 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-500 active:scale-90"
                                title="Delete"
                                aria-label="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5 md:w-3 md:h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input — pr-20 only on desktop where the floating AI button
                  overlaps; mobile reclaims that space for the textarea. */}
              <div className={clsx(
                "flex gap-2 p-2.5 md:p-3 border-t border-white/5",
                isStudent && "md:pr-20"
              )}>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder="Type a message..." rows={1}
                  className="glass-input flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm resize-none min-w-0"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="btn-gradient p-2.5 rounded-xl relative z-10 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send message"
                >
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

      {/* Delete confirmation — uses the project's Modal so the dialog
          matches the rest of the UI instead of the OS browser prompt. */}
      <Modal
        open={pendingDeleteId !== null}
        onClose={() => { if (!deleting) setPendingDeleteId(null); }}
        title="Delete message?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm text-dark-200">
              This message will be replaced with a &ldquo;Message deleted&rdquo; placeholder for everyone in the chat. This can&rsquo;t be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setPendingDeleteId(null)}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm text-dark-200 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {deleting && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>

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
