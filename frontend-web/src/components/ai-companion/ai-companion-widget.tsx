"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, X, Sparkles, BookOpen, Clock, TrendingUp,
  ChevronRight, Lightbulb, RefreshCw, Loader2,
  Star, MessageSquare, Send, Plus, ArrowRight,
  Image as ImageIcon, BookMarked, GitBranch,
} from "lucide-react";
import { aiStudyPlanApi, DailyGuide, aiMindmapBuddyApi, aiImagesApi, type MapAnalysis, type NodeSuggestion } from "@/lib/api";
import LearningStyleSetup from "./learning-style-setup";
import { aiCompanionApi } from "@/lib/api";
import { useMindmapContext } from "@/contexts/mindmap-context";

/* ── Electron orbits around the brain (nucleus) ──
 *  3 orbital planes at 0°, 60°, -60° spin — like an atom model.
 *  Each electron traces a full circle; the tilt projects it as an ellipse
 *  so it appears to go "around" the nucleus in 3D perspective.
 *  Electrons on the same ring are spaced apart so they don't clump.
 */
const ELECTRONS = [
  // Orbital 1 — spin 0°
  { size: 8,  color: "#6366f1", radius: 36, tilt: 65, spin: 0,   speed: 8,   phase: 0 },
  { size: 6,  color: "#06b6d4", radius: 36, tilt: 65, spin: 0,   speed: 8,   phase: 180 },
  // Orbital 2 — spin 60°
  { size: 8,  color: "#ec4899", radius: 34, tilt: 65, spin: 60,  speed: 9,   phase: 60 },
  { size: 6,  color: "#10b981", radius: 34, tilt: 65, spin: 60,  speed: 9,   phase: 240 },
  // Orbital 3 — spin -60°
  { size: 7,  color: "#8b5cf6", radius: 32, tilt: 65, spin: -60, speed: 10,  phase: 120 },
  { size: 7,  color: "#f59e0b", radius: 32, tilt: 65, spin: -60, speed: 10,  phase: 300 },
];

const ORBIT_STEPS = 48; // smooth circle

function electronPath(radius: number, tiltDeg: number, spinDeg: number, phase: number) {
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const spinRad = (spinDeg * Math.PI) / 180;
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = []; // depth for 3D effect
  for (let i = 0; i <= ORBIT_STEPS; i++) {
    const angle = ((i / ORBIT_STEPS) * 360 + phase) * (Math.PI / 180);
    // 3D circle on tilted plane
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;
    const cz = Math.sin(angle) * Math.sin(tiltRad) * radius; // depth
    // Rotate into 2D screen plane
    const px = cx * Math.cos(spinRad) - cy * Math.cos(tiltRad) * Math.sin(spinRad);
    const py = cx * Math.sin(spinRad) + cy * Math.cos(tiltRad) * Math.cos(spinRad);
    xs.push(px);
    ys.push(py);
    zs.push(cz);
  }
  return { xs, ys, zs };
}

function OrbitingBubbles() {
  return (
    <>
      {ELECTRONS.map((e, i) => {
        const { xs, ys, zs } = electronPath(e.radius, e.tilt, e.spin, e.phase);
        return (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: e.size,
              height: e.size,
              background: `radial-gradient(circle, ${e.color}, ${e.color}cc)`,
              boxShadow: `0 0 ${e.size + 2}px ${e.color}99`,
              top: 28 - e.size / 2,
              left: 28 - e.size / 2,
            }}
            animate={{
              x: xs,
              y: ys,
              // In front of brain (z < 0) = bright & big; behind (z > 0) = dim & small
              zIndex: zs.map(z => z < 0 ? 10 : -1),
              opacity: zs.map(z => z < 0 ? 1 : 0.4),
              scale: zs.map(z => z < 0 ? 1.15 : 0.7),
            }}
            transition={{
              duration: e.speed,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        );
      })}
    </>
  );
}

/* ── Priority badge colors ── */
function priorityColor(p: string) {
  if (p === "high") return { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500" };
  if (p === "medium") return { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500" };
  return { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" };
}

/* ── Rating helpers ── */
function ratingColor(r: number) {
  if (r >= 8) return "text-emerald-600";
  if (r >= 6) return "text-blue-600";
  if (r >= 4) return "text-amber-600";
  return "text-red-600";
}
function ratingBg(r: number) {
  if (r >= 8) return "from-emerald-50 to-emerald-100/50 border-emerald-200";
  if (r >= 6) return "from-blue-50 to-blue-100/50 border-blue-200";
  if (r >= 4) return "from-amber-50 to-amber-100/50 border-amber-200";
  return "from-red-50 to-red-100/50 border-red-200";
}
function ratingBarColor(r: number) {
  if (r >= 8) return "#34d399";
  if (r >= 6) return "#60a5fa";
  if (r >= 4) return "#fbbf24";
  return "#f87171";
}

/* ── Node depth & suggestion type helpers ── */
function getNodeDepths(nodes: { id: string }[], edges: { source: string; target: string }[]): Map<string, number> {
  const childToParent = new Map<string, string>();
  edges.forEach(e => childToParent.set(e.target, e.source));
  const targetIds = new Set(edges.map(e => e.target));
  const roots = nodes.filter(n => !targetIds.has(n.id));
  const depths = new Map<string, number>();
  roots.forEach(r => depths.set(r.id, 0));
  // BFS to assign depths
  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach(e => {
      if (depths.has(e.source) && !depths.has(e.target)) {
        depths.set(e.target, (depths.get(e.source) || 0) + 1);
        changed = true;
      }
    });
  }
  return depths;
}

function depthLabel(depth: number): { text: string; color: string; bg: string } {
  switch (depth) {
    case 0: return { text: "Main Topic", color: "text-indigo-700", bg: "bg-indigo-100 border-indigo-200" };
    case 1: return { text: "Subtopic", color: "text-purple-700", bg: "bg-purple-100 border-purple-200" };
    case 2: return { text: "Detail", color: "text-cyan-700", bg: "bg-cyan-100 border-cyan-200" };
    default: return { text: `Level ${depth + 1}`, color: "text-gray-600", bg: "bg-gray-100 border-gray-200" };
  }
}

type SuggestionType = "text" | "image" | "example";
function parseSuggestionType(label: string): { type: SuggestionType; cleanLabel: string } {
  if (label.startsWith("[Image]")) return { type: "image", cleanLabel: label.replace("[Image]", "").trim() };
  if (label.startsWith("[Example]")) return { type: "example", cleanLabel: label.replace("[Example]", "").trim() };
  return { type: "text", cleanLabel: label };
}

function suggestionTypeStyle(type: SuggestionType) {
  switch (type) {
    case "image": return { icon: ImageIcon, badge: "Image", color: "text-pink-600", bg: "bg-pink-50 border-pink-200", badgeBg: "bg-pink-100 text-pink-700" };
    case "example": return { icon: BookMarked, badge: "Example", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", badgeBg: "bg-emerald-100 text-emerald-700" };
    default: return { icon: GitBranch, badge: "Node", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", badgeBg: "bg-indigo-100 text-indigo-700" };
  }
}

type MindmapTab = "insights" | "chat";

export default function AiCompanionWidget() {
  const [open, setOpen] = useState(false);

  // Detect mobile viewport (below lg breakpoint = 1024px)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Listen for mobile bottom nav trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-ai-companion", handler);
    return () => window.removeEventListener("open-ai-companion", handler);
  }, []);
  const [guide, setGuide] = useState<DailyGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [learningStyle, setLearningStyle] = useState<string | null | undefined>(undefined);
  const [bubblesDismissed, setBubblesDismissed] = useState(true);
  const [enabled, setEnabled] = useState(true);

  // Mindmap mode state
  const mindmapCtx = useMindmapContext();
  const isMapMode = mindmapCtx?.active ?? false;
  const [mapTab, setMapTab] = useState<MindmapTab>("insights");
  const [analysis, setAnalysis] = useState<MapAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<NodeSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [pillsHidden, setPillsHidden] = useState(false);
  const [generatingImageIdx, setGeneratingImageIdx] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "buddy"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadedRef = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Check if enabled + bubbles state, listen for toggle events
  useEffect(() => {
    const sync = () => {
      const off = localStorage.getItem("mss-smartbuddy-off") === "true";
      setEnabled(!off);
    };
    sync();
    const dismissed = localStorage.getItem("mss-smartbuddy-bubbles-dismissed") === "true";
    setBubblesDismissed(dismissed);
    window.addEventListener("smartbuddy-toggle", sync);
    return () => window.removeEventListener("smartbuddy-toggle", sync);
  }, []);

const loadData = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const profile = await aiCompanionApi.getLearningProfile();
      setLearningStyle(profile?.learning_style ?? null);
    } catch {
      setLearningStyle(null);
    }
  }, []);

  const loadGuide = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiStudyPlanApi.dailyGuide();
      setGuide(data);
    } catch {
      setGuide({ recommendations: [], motivational_message: "Keep up the great work! Check your courses for updates." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !isMapMode) {
      loadData();
      if (!guide) loadGuide();
    }
  }, [open, isMapMode, loadData, loadGuide, guide]);

  // ── Mindmap handlers (declared before effects that use them) ──
  const handleAnalyze = useCallback(async () => {
    if (!mindmapCtx || mindmapCtx.nodes.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await aiMindmapBuddyApi.analyze({
        title: mindmapCtx.title,
        nodes: mindmapCtx.nodes.map(n => ({ id: n.id, label: (n.data as Record<string, unknown>)?.label || "", type: n.type, position: n.position })),
        edges: mindmapCtx.edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
      });
      setAnalysis(result);
      // Highlight leaf nodes (no outgoing edges) as candidates for expansion
      const sourceIds = new Set(mindmapCtx.edges.map(e => e.source));
      const leafIds = mindmapCtx.nodes
        .filter(n => !sourceIds.has(n.id))
        .map(n => n.id);
      mindmapCtx.setHighlightedNodeIds(leafIds);
    } catch {
      setAnalysis(null);
    }
    setAnalyzing(false);
  }, [mindmapCtx]);

  const handleSuggestAll = useCallback(async () => {
    if (!mindmapCtx || mindmapCtx.nodes.length === 0) return;
    setSuggesting(true);
    try {
      const result = await aiMindmapBuddyApi.suggestAll({
        title: mindmapCtx.title,
        nodes: mindmapCtx.nodes.map(n => ({ id: n.id, label: (n.data as Record<string, unknown>)?.label || "", type: n.type, position: n.position })),
        edges: mindmapCtx.edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
      });
      setSuggestions(result.suggestions || []);
    } catch {
      setSuggestions([]);
    }
    setSuggesting(false);
  }, [mindmapCtx]);

  // Auto-analyze when map mode panel opens (and there are nodes)
  const autoAnalyzedRef = useRef(false);
  useEffect(() => {
    if (open && isMapMode && mindmapCtx && mindmapCtx.nodes.length > 0 && !analysis && !analyzing && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true;
      handleAnalyze();
    }
  }, [open, isMapMode, mindmapCtx?.nodes.length, analysis, analyzing, handleAnalyze]);

  // Reset auto-analyze flag and clear highlights when panel closes
  const mindmapCtxRef = useRef(mindmapCtx);
  mindmapCtxRef.current = mindmapCtx;
  useEffect(() => {
    if (!open) {
      autoAnalyzedRef.current = false;
      autoSuggestedRef.current = false;
      mindmapCtxRef.current?.setHighlightedNodeIds([]);
    }
  }, [open]);

  // Auto-suggest all nodes when map mode is active (even before panel opens)
  const autoSuggestedRef = useRef(false);
  useEffect(() => {
    if (isMapMode && mindmapCtx && mindmapCtx.nodes.length > 0 && suggestions.length === 0 && !suggesting && !autoSuggestedRef.current) {
      autoSuggestedRef.current = true;
      handleSuggestAll();
    }
  }, [isMapMode, mindmapCtx?.nodes.length, suggestions.length, suggesting, handleSuggestAll]);

  const handleStyleComplete = (style: string) => {
    setLearningStyle(style);
    loadGuide();
  };

  const dismissBubbles = () => {
    setBubblesDismissed(true);
    localStorage.setItem("mss-smartbuddy-bubbles-dismissed", "true");
  };

  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !mindmapCtx) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    try {
      const result = await aiMindmapBuddyApi.chat(msg, {
        title: mindmapCtx.title,
        nodeCount: mindmapCtx.nodes.length,
        edgeCount: mindmapCtx.edges.length,
        nodeLabels: mindmapCtx.nodes.slice(0, 20).map(n => ((n.data as Record<string, unknown>)?.label as string) || ""),
      });
      setChatMessages(prev => [...prev, { role: "buddy", text: result.response }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "buddy", text: "Sorry, I couldn't process that. Try again!" }]);
    }
    setChatLoading(false);
  }, [chatInput, mindmapCtx]);

  if (!enabled) return null;

  const styleBadgeLabel = learningStyle
    ? learningStyle.charAt(0).toUpperCase() + learningStyle.slice(1)
    : null;

  return (
    <>
      {/* Floating trigger button with orbiting bubbles / suggestion pills — desktop only */}
      <AnimatePresence>
        {!open && !isMobile && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            {!bubblesDismissed && !isMapMode && <OrbitingBubbles />}

            {/* Orbiting suggestion pills — left & top-left arc around brain */}
            {isMapMode && suggestions.length > 0 && (
              <AnimatePresence>
                {!pillsHidden ? (
                  <motion.div
                    key="pills"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    style={{ zIndex: 20 }}
                  >
                    {(() => {
                      // Arc from 9 o'clock to 12 o'clock (180° to 270°)
                      // 0°=right, 90°=bottom, 180°=left, 270°=top
                      // Brain button is 56x56 (radius 28). Pills must clear it entirely.
                      const items = suggestions.slice(0, 4);
                      const hasMore = suggestions.length > 4;
                      const totalSlots = items.length + (hasMore ? 1 : 0); // hide btn is separate
                      const startAngle = 180;
                      const endAngle = 270;
                      const arcSpan = endAngle - startAngle;
                      const baseRadius = 72;
                      const center = 28;

                      return (
                        <>
                          {items.map((s, i) => {
                            const angle = startAngle + (arcSpan * i) / Math.max(totalSlots - 1, 1);
                            const rad = (angle * Math.PI) / 180;
                            const r = baseRadius + i * 5;
                            const bx = center + Math.cos(rad) * r -80;
                            const by = center + Math.sin(rad) * r -9;
                            const ws = 4.5 + i * 0.6;

                            return (
                              <motion.button
                                key={`${s.label}-${i}`}
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                  x: [bx - 4, bx + 4, bx - 4],
                                  y: [by - 3, by + 3, by - 3],
                                }}
                                transition={{
                                  opacity: { delay: 0.3 + i * 0.08, duration: 0.25 },
                                  scale: { delay: 0.3 + i * 0.08, type: "spring", damping: 20 },
                                  x: { duration: ws, repeat: Infinity, ease: "easeInOut" },
                                  y: { duration: ws, repeat: Infinity, ease: "easeInOut" },
                                }}
                                whileHover={{ scale: 1.15 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSuggestion(i);
                                  setMapTab("insights");
                                  setOpen(true);
                                }}
                                className="absolute pointer-events-auto px-2 py-1 rounded-full text-[8px] font-medium shadow-md cursor-pointer whitespace-nowrap max-w-[100px] truncate"
                                style={{
                                  top: 0,
                                  left: 0,
                                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                  color: "#fff",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  boxShadow: "0 1px 8px rgba(99,102,241,0.35)",
                                  transform: "translate(-50%, -50%)",
                                }}
                                title={s.label}
                              >
                                {s.label}
                              </motion.button>
                            );
                          })}
                          {/* "+N more" pill */}
                          {hasMore && (() => {
                            const mIdx = items.length;
                            const angle = startAngle + (arcSpan * mIdx) / Math.max(totalSlots - 1, 1);
                            const rad = (angle * Math.PI) / 180;
                            const r = baseRadius + mIdx * 5;
                            const mx = center + Math.cos(rad) * r;
                            const my = center + Math.sin(rad) * r;
                            return (
                              <motion.button
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                  x: [mx - 3, mx + 3, mx - 3],
                                  y: [my - 2, my + 2, my - 2],
                                }}
                                transition={{
                                  opacity: { delay: 0.7, duration: 0.25 },
                                  scale: { delay: 0.7, type: "spring", damping: 20 },
                                  x: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                                  y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                                }}
                                whileHover={{ scale: 1.15 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMapTab("insights");
                                  setOpen(true);
                                }}
                                className="absolute pointer-events-auto px-2 py-1 rounded-full text-[8px] font-medium shadow-md cursor-pointer"
                                style={{
                                  top: 0,
                                  left: 0,
                                  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                                  color: "#fff",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  boxShadow: "0 1px 8px rgba(139,92,246,0.35)",
                                  transform: "translate(-50%, -50%)",
                                }}
                              >
                                +{suggestions.length - 4} more
                              </motion.button>
                            );
                          })()}
                          {/* Hide button — fixed at bottom of brain */}
                          {(() => {
                            return (
                              <motion.button
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                  x: [center - 70, center - 68, center - 65],
                                  y: [center + 25, center + 20, center + 23],
                                }}
                                transition={{
                                  opacity: { delay: 0.9, duration: 0.25 },
                                  scale: { delay: 0.9, type: "spring", damping: 20 },
                                  x: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
                                  y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
                                }}
                                whileHover={{ scale: 1.15 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPillsHidden(true);
                                }}
                                className="absolute pointer-events-auto px-2 py-1 rounded-full text-[8px] font-medium cursor-pointer whitespace-nowrap"
                                style={{
                                  top: 0,
                                  left: 0,
                                  background: "linear-gradient(135deg, #6366f1, #ec4899)",
                                  color: "#fff",
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  boxShadow: "0 1px 8px rgba(99,102,241,0.35)",
                                  transform: "translate(-50%, -50%)",
                                }}
                              >
                                Hide
                              </motion.button>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </motion.div>
                ) : (
                  /* Small "Show" button when pills are hidden — to the left of brain */
                  <motion.button
                    key="show"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPillsHidden(false);
                    }}
                    className="absolute rounded-full text-[8px] font-medium cursor-pointer whitespace-nowrap px-2 py-1"
                    style={{
                      zIndex: 20,
                      top: 10,
                      left: -50,
                      transform: "translateY(-50%)",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      boxShadow: "0 1px 6px rgba(99,102,241,0.3)",
                    }}
                    title="Show suggestions"
                  >
                    {suggestions.length} tips
                  </motion.button>
                )}
              </AnimatePresence>
            )}

            {/* Suggesting spinner around brain */}
            {isMapMode && suggesting && suggestions.length === 0 && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <motion.div
                  className="absolute w-12 h-12 rounded-full border-2 border-transparent"
                  style={{ borderTopColor: "#8b5cf6", borderRightColor: "#6366f1" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                />
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOpen(true)}
              onContextMenu={(e) => {
                e.preventDefault();
                dismissBubbles();
              }}
              className="relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-shadow bg-gradient-to-br from-blue-800 to-blue-950 shadow-blue-900/40 hover:shadow-blue-900/60"
              title={isMapMode ? "SmartBuddy — Mind Map Mode" : "SmartBuddy — Right-click to dismiss bubbles"}
            >
                <img src="/ai-brain-logo.svg" alt="SmartBuddy" className="w-7 h-7 object-cover" />
              {/* Map mode indicator dot */}
              {isMapMode && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
              {/* Suggestion count badge */}
              {isMapMode && suggestions.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-900">
                  {suggestions.length}
                </span>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-h-[560px] rounded-2xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#1a1a2e",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: "1px solid #e5e7eb",
                background: isMapMode
                  ? "linear-gradient(135deg, #f0f4ff, #ede9fe)"
                  : "linear-gradient(135deg, #f0f4ff, #faf5ff)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-800 to-blue-950 flex items-center justify-center flex-shrink-0">
                  <img src="/ai-brain-logo.svg" alt="SmartBuddy" className="w-6 h-6 object-cover" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-none">SmartBuddy</h3>
                  <span className="text-[10px] text-indigo-600 font-medium">
                    {isMapMode ? "Mind Map Mode" : styleBadgeLabel ? `${styleBadgeLabel} learner` : "Study Assistant"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!isMapMode && guide && (
                  <button
                    onClick={() => { loadedRef.current = false; setGuide(null); loadGuide(); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Refresh recommendations"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ═══ MINDMAP MODE ═══ */}
            {isMapMode ? (
              <>
                {/* Tabs */}
                <div className="flex" style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {([
                    { key: "insights" as MindmapTab, icon: Sparkles, label: "Insights" },
                    { key: "chat" as MindmapTab, icon: MessageSquare, label: "Chat" },
                  ]).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setMapTab(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                        mapTab === t.key
                          ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto" style={{ background: "#fafbfc" }}>
                  {/* ── Insights Tab ── */}
                  {mapTab === "insights" && (
                    <div className="p-4 space-y-3">
                      {mindmapCtx && mindmapCtx.nodes.length === 0 ? (
                        <div className="text-center py-10">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-7 h-7 text-indigo-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-700">Start building your map</p>
                          <p className="text-xs text-gray-400 mt-1">Add some nodes and I&apos;ll analyze your work</p>
                        </div>
                      ) : (analyzing || suggesting) && !analysis && suggestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                              <Brain className="w-6 h-6 text-indigo-400" />
                            </div>
                            <motion.div
                              className="absolute inset-0 rounded-full border-2 border-indigo-300 border-t-transparent"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                          <p className="text-sm text-gray-500">Analyzing your mind map...</p>
                        </div>
                      ) : (
                        <>
                          {/* ── Rating Card ── */}
                          {analysis && (
                            <div className={`rounded-xl overflow-hidden border ${ratingBg(analysis.rating)}`}>
                              <div className="p-3 bg-gradient-to-br">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-bold ${ratingColor(analysis.rating)}`}>{analysis.rating}</span>
                                    <span className="text-gray-400 text-xs">/10</span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      analysis.rating >= 8 ? "bg-emerald-100 text-emerald-700" :
                                      analysis.rating >= 6 ? "bg-blue-100 text-blue-700" :
                                      analysis.rating >= 4 ? "bg-amber-100 text-amber-700" :
                                      "bg-red-100 text-red-700"
                                    }`}>{analysis.rating_label}</span>
                                  </div>
                                  <button onClick={() => { handleAnalyze(); autoSuggestedRef.current = false; setSuggestions([]); handleSuggestAll(); }} disabled={analyzing} className="p-1.5 hover:bg-white/60 rounded-lg transition-colors text-gray-400" title="Re-analyze">
                                    {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <div className="flex gap-0.5 mb-2">
                                  {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i < analysis.rating ? ratingBarColor(analysis.rating) : "#e5e7eb" }} />
                                  ))}
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">{analysis.structure_feedback}</p>
                              </div>
                            </div>
                          )}

                          {/* ── Strengths & Improvements (compact) ── */}
                          {analysis && (analysis.strengths.length > 0 || analysis.improvements.length > 0) && (
                            <div className="grid grid-cols-2 gap-2">
                              {analysis.strengths.length > 0 && (
                                <div className="rounded-xl p-2.5 bg-emerald-50/80 border border-emerald-100">
                                  <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Star className="w-3 h-3" /> Strengths
                                  </h4>
                                  <ul className="space-y-1">
                                    {analysis.strengths.slice(0, 3).map((s, i) => (
                                      <li key={i} className="text-[11px] text-gray-600 leading-tight">{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {analysis.improvements.length > 0 && (
                                <div className="rounded-xl p-2.5 bg-amber-50/80 border border-amber-100">
                                  <h4 className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" /> Improve
                                  </h4>
                                  <ul className="space-y-1">
                                    {analysis.improvements.slice(0, 3).map((s, i) => (
                                      <li key={i} className="text-[11px] text-gray-600 leading-tight">{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Map Type Recommendation ── */}
                          {analysis && analysis.type_change_reason && (
                            <div className="flex items-start gap-2 rounded-lg p-2.5 bg-purple-50 border border-purple-100">
                              <ArrowRight className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-xs font-medium text-purple-700">Try: {analysis.recommended_map_type}</span>
                                <p className="text-[10px] text-gray-500 mt-0.5">{analysis.type_change_reason}</p>
                              </div>
                            </div>
                          )}

                          {/* ── Suggestions Section ── */}
                          {(suggestions.length > 0 || (analysis && analysis.suggested_nodes.length > 0) || suggesting) && (
                            <>
                              <div className="flex items-center gap-2 pt-1">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1">
                                  <Plus className="w-3 h-3" /> Add to your map
                                </span>
                                <div className="flex-1 h-px bg-gray-200" />
                              </div>

                              {/* Quick-add chips from analysis */}
                              {analysis && analysis.suggested_nodes.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {analysis.suggested_nodes.map((label, i) => (
                                    <button
                                      key={i}
                                      onClick={() => mindmapCtx?.onAddNode?.(label)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-all hover:shadow-sm border border-indigo-100 active:scale-95"
                                    >
                                      <Plus className="w-3 h-3" />{label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Loading suggestions */}
                              {suggesting && suggestions.length === 0 && (
                                <div className="flex items-center justify-center py-3 gap-2">
                                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                                  <p className="text-xs text-gray-400">Finding suggestions...</p>
                                </div>
                              )}

                              {/* Suggestion cards */}
                              {suggestions.length > 0 && (() => {
                                // Compute depths of existing nodes to show hierarchy badges
                                const nodeDepths = mindmapCtx ? getNodeDepths(
                                  mindmapCtx.nodes.map(n => ({ id: n.id })),
                                  mindmapCtx.edges.map(e => ({ source: e.source, target: e.target }))
                                ) : new Map<string, number>();
                                // Map parent labels to their depths
                                const labelToDepth = new Map<string, number>();
                                mindmapCtx?.nodes.forEach(n => {
                                  const label = ((n.data as Record<string, unknown>)?.label as string) || "";
                                  if (label && nodeDepths.has(n.id)) labelToDepth.set(label.toLowerCase().trim(), nodeDepths.get(n.id)!);
                                });

                                return (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-gray-400">{suggestions.length} AI suggestions</p>
                                    <button
                                      onClick={() => { autoSuggestedRef.current = false; setSuggestions([]); handleSuggestAll(); }}
                                      disabled={suggesting}
                                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                                      title="Refresh"
                                    >
                                      {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                    </button>
                                  </div>
                                  {suggestions.map((s, i) => {
                                    const isExpanded = expandedSuggestion === i;
                                    const { type: sType, cleanLabel } = parseSuggestionType(s.label);
                                    const sStyle = suggestionTypeStyle(sType);
                                    const SIcon = sStyle.icon;

                                    // Determine what level this node will be at (parent depth + 1)
                                    const parentDepthVal = s.parent_label ? labelToDepth.get(s.parent_label.toLowerCase().trim()) : undefined;
                                    const childDepth = parentDepthVal !== undefined ? parentDepthVal + 1 : undefined;
                                    const dLabel = childDepth !== undefined ? depthLabel(childDepth) : null;

                                    return (
                                      <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        className={`rounded-xl bg-white border transition-all cursor-pointer ${
                                          isExpanded ? `${sStyle.bg} shadow-sm ring-1 ring-opacity-30` : "border-gray-100 hover:border-gray-200"
                                        }`}
                                        onClick={() => setExpandedSuggestion(isExpanded ? null : i)}
                                      >
                                        <div className="flex items-center gap-2.5 p-2.5 group">
                                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${sType === "image" ? "bg-pink-50" : sType === "example" ? "bg-emerald-50" : "bg-indigo-50"}`}>
                                            <SIcon className={`w-3.5 h-3.5 ${sStyle.color}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <p className="text-xs font-medium text-gray-800 truncate">{cleanLabel}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                              {/* Type badge */}
                                              <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${sStyle.badgeBg}`}>
                                                {sStyle.badge}
                                              </span>
                                              {/* Hierarchy level badge */}
                                              {dLabel && (
                                                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${dLabel.bg} ${dLabel.color}`}>
                                                  {dLabel.text}
                                                </span>
                                              )}
                                              {/* Parent connection indicator */}
                                              {s.parent_label && (
                                                <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                                  <ArrowRight className="w-2 h-2" /> {s.parent_label}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); mindmapCtx?.onAddNode?.(s.label, s.parent_label, sType === "image" ? "image" : undefined); }}
                                            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90 ${sType === "image" ? "bg-pink-50 text-pink-500 hover:bg-pink-100" : "bg-indigo-50 text-indigo-500 hover:bg-indigo-100"}`}
                                            title="Add to map"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <AnimatePresence>
                                          {isExpanded && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: "auto", opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="px-2.5 pb-2.5 pt-0 ml-8 space-y-2">
                                                <p className="text-[11px] text-gray-500 leading-relaxed">{s.description}</p>
                                                <div className="flex gap-1.5 flex-wrap">
                                                  {sType === "image" ? (
                                                    <>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); mindmapCtx?.onAddNode?.(cleanLabel, s.parent_label, "image"); }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
                                                      >
                                                        <ImageIcon className="w-3 h-3" /> Add my own Image
                                                      </button>
                                                      <button
                                                        disabled={generatingImageIdx === i}
                                                        onClick={async (e) => {
                                                          e.stopPropagation();
                                                          setGeneratingImageIdx(i);
                                                          try {
                                                            // Generate image with AI using the suggestion label as prompt
                                                            const result = await aiImagesApi.generate(cleanLabel, undefined, mindmapCtx?.mapId || undefined);
                                                            const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
                                                            const imageUrl = result.image_url.startsWith("http") ? result.image_url : `${apiUrl}${result.image_url}`;
                                                            // Create image node with the generated image
                                                            mindmapCtx?.onAddNode?.(cleanLabel, s.parent_label, "image");
                                                            // After node is created, update its imageUrl via the node change handler
                                                            // We need a slight delay for the node to be created first
                                                            setTimeout(() => {
                                                              // Find the most recently added node (it's the image node we just created)
                                                              const latestNodes = mindmapCtx?.nodes || [];
                                                              // The node was just added, so it won't be in the current ctx nodes yet
                                                              // Instead, we store the imageUrl and the map editor will pick it up
                                                              // via a different mechanism — let's use a simpler approach:
                                                              // dispatch a custom event with the image URL
                                                              window.dispatchEvent(new CustomEvent("smartbuddy-image-generated", {
                                                                detail: { imageUrl, label: cleanLabel }
                                                              }));
                                                            }, 500);
                                                          } catch {
                                                            // Fallback: just add as empty image node
                                                            mindmapCtx?.onAddNode?.(cleanLabel, s.parent_label, "image");
                                                          } finally {
                                                            setGeneratingImageIdx(null);
                                                          }
                                                        }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                                                      >
                                                        {generatingImageIdx === i ? (
                                                          <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                                                        ) : (
                                                          <><Sparkles className="w-3 h-3" /> Generate Image</>
                                                        )}
                                                      </button>
                                                    </>
                                                  ) : (
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); mindmapCtx?.onAddNode?.(s.label, s.parent_label); }}
                                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm"
                                                    >
                                                      <Plus className="w-3 h-3" /> Add to Map
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                                );
                              })()}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Chat Tab ── */}
                  {mapTab === "chat" && (
                    <div className="flex flex-col h-[340px]">
                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {chatMessages.length === 0 && (
                          <div className="text-center py-10">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
                              <MessageSquare className="w-6 h-6 text-indigo-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">Ask me anything</p>
                            <p className="text-xs text-gray-400 mt-1">I can help you improve your mind map</p>
                          </div>
                        )}
                        {chatMessages.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                m.role === "user"
                                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-md shadow-sm"
                                  : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm"
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-gray-100 px-3 py-2.5 rounded-2xl rounded-bl-md shadow-sm">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="p-3" style={{ borderTop: "1px solid #f0f0f0" }}>
                        <form onSubmit={e => { e.preventDefault(); handleChat(); }} className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            placeholder="Ask about your mind map..."
                            className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={chatLoading || !chatInput.trim()}
                            className="p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-all disabled:opacity-40 active:scale-95 shadow-sm"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ═══ NORMAL STUDY MODE ═══ */
              <>
                {learningStyle === undefined ? (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : learningStyle === null ? (
                  <div style={{ background: "#ffffff", color: "#1a1a2e" }}>
                    <LearningStyleSetup onComplete={handleStyleComplete} lightMode />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: "#fafbfc" }}>
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="text-sm text-gray-500">Loading your recommendations...</p>
                      </div>
                    ) : guide ? (
                      <>
                        {guide.motivational_message && (
                          <div
                            className="rounded-xl p-3 flex items-start gap-2.5"
                            style={{ background: "linear-gradient(135deg, #eef2ff, #faf5ff)", border: "1px solid #e0e7ff" }}
                          >
                            <Lightbulb className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 leading-relaxed">{guide.motivational_message}</p>
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Today&apos;s Recommendations
                          </h4>

                          {guide.recommendations.length === 0 ? (
                            <div className="text-center py-8">
                              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-400">No recommendations right now. Keep studying!</p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {guide.recommendations.map((rec, i) => {
                                const pc = priorityColor(rec.priority);
                                return (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    className={`rounded-xl p-3.5 border ${pc.bg}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`w-2 h-2 rounded-full ${pc.dot}`} />
                                          <span className="text-xs font-semibold text-gray-900 truncate">{rec.course}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${pc.text} bg-white/60`}>
                                            {rec.priority}
                                          </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-800 mb-1">{rec.topic}</p>
                                        <p className="text-xs text-gray-500 leading-relaxed">{rec.reason}</p>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 mt-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{rec.estimated_time}</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div
                          className="rounded-xl p-3 mt-2"
                          style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
                        >
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Actions</h4>
                          <div className="space-y-1">
                            {[
                              { label: "Study Materials", href: "/student/study-materials", icon: BookOpen },
                              { label: "Exam Planner", href: "/student/exam-planner", icon: TrendingUp },
                            ].map((link) => (
                              <a
                                key={link.href}
                                href={link.href}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <link.icon className="w-4 h-4 text-indigo-500" />
                                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{link.label}</span>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
