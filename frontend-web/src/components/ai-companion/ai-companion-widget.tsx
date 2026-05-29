"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, X, Sparkles, BookOpen, Clock, TrendingUp,
  ChevronRight, Lightbulb, RefreshCw, Loader2,
  Star, MessageSquare, Send, Plus, ArrowRight,
  Image as ImageIcon, BookMarked, GitBranch,
  GraduationCap, FileText, Bot, ExternalLink, ShieldAlert,
} from "lucide-react";
import { type Node } from "@xyflow/react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  aiStudyPlanApi, DailyGuide, aiMindmapBuddyApi, aiImagesApi, aiStudyMaterialsApi,
  type MapAnalysis, type NodeSuggestion,
  type ChatSource, type ChatSuggestedAction, type EvidenceTier,
} from "@/lib/api";
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
type NonMapTab = "guide" | "chat";

// The legacy whole-map "Add to your map" suggestion list is hidden in favour of
// the per-node build-out wizard. Flip to true to bring it back.
const SHOW_LEGACY_SUGGESTIONS = false;

// ── "Build out this node" wizard ──
// After a node is selected, SmartBuddy walks this sequence one type at a time,
// auto-advancing after each Add/Skip so the student fleshes out a node fully.
const WIZARD_SEQUENCE = ["subtopic", "detail", "example", "image", "resource"] as const;
type WizardType = (typeof WIZARD_SEQUENCE)[number];
const WIZARD_TYPE_META: Record<WizardType, { label: string; icon: typeof GitBranch; color: string; bg: string; btn: string }> = {
  subtopic: { label: "Subtopic", icon: GitBranch,  color: "text-indigo-600",  bg: "bg-indigo-50 border-indigo-200",   btn: "from-indigo-500 to-purple-500" },
  detail:   { label: "Detail",   icon: Lightbulb,  color: "text-cyan-600",    bg: "bg-cyan-50 border-cyan-200",       btn: "from-cyan-500 to-blue-500" },
  example:  { label: "Example",  icon: BookMarked, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", btn: "from-emerald-500 to-teal-500" },
  image:    { label: "Image",    icon: ImageIcon,  color: "text-pink-600",    bg: "bg-pink-50 border-pink-200",       btn: "from-purple-500 to-pink-500" },
  resource: { label: "Resource", icon: BookOpen,   color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",     btn: "from-amber-500 to-orange-500" },
};
/** Strip a leading "[Tag] " marker (e.g. "[Example] ") from a suggestion label. */
function stripTag(label: string): string {
  return label.replace(/^\[[^\]]+\]\s*/, "").trim();
}
/** Map a recommended mind-map type to the node shape that visually fits it,
 * so wizard-added nodes match the Insight's recommended map type. */
function shapeForMapType(mapType?: string): string {
  const t = (mapType || "").toLowerCase();
  if (t.includes("spider")) return "ellipse";   // oval
  if (t.includes("bubble")) return "circle";
  if (t.includes("concept")) return "rectangle";
  if (t.includes("flow")) return "rectangle";
  if (t.includes("fishbone") || t.includes("ishikawa")) return "parallelogram";
  if (t.includes("tree") || t.includes("hierarch")) return "roundedRect";
  return "roundedRect"; // mind map / unknown
}
/** Where to start the wizard for a clicked node, based on its own type:
 * recommend the NEXT type in the chain. Untyped nodes start at subtopic. */
function nodeStartStep(node: Node): number {
  const t = (node.data as Record<string, unknown>)?.smartType as WizardType | undefined;
  const idx = t ? WIZARD_SEQUENCE.indexOf(t) : -1;
  return idx + 1; // untyped→0 (subtopic) … detail→2 (example) … resource→5 (done)
}

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

  // Listen for mobile bottom nav trigger.
  // 'open-ai-companion' (legacy) only opens; 'toggle-ai-companion' flips the
  // current state so a second tap on the FAB closes the panel.
  useEffect(() => {
    const open = () => setOpen(true);
    const toggle = () => setOpen(prev => !prev);
    window.addEventListener("open-ai-companion", open);
    window.addEventListener("toggle-ai-companion", toggle);
    return () => {
      window.removeEventListener("open-ai-companion", open);
      window.removeEventListener("toggle-ai-companion", toggle);
    };
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
  const [nonMapTab, setNonMapTab] = useState<NonMapTab>("guide");
  const [analysis, setAnalysis] = useState<MapAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<NodeSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [pillsHidden, setPillsHidden] = useState(false);
  const [generatingImageIdx, setGeneratingImageIdx] = useState<number | null>(null);
  type ChatMessage = {
    role: "user" | "buddy";
    text: string;
    evidence_level?: EvidenceTier | "mixed";
    sources?: ChatSource[];
    suggested_actions?: ChatSuggestedAction[];
  };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // Tracks which CTA is currently generating so its button can show a spinner.
  const [genActionKey, setGenActionKey] = useState<string | null>(null);
  const router = useRouter();

  // ── Node "build-out" wizard state ──
  const [wizStep, setWizStep] = useState(0);
  const [wizSugs, setWizSugs] = useState<NodeSuggestion[]>([]);
  const [wizLoading, setWizLoading] = useState(false);
  const [wizNodeId, setWizNodeId] = useState<string | null>(null);
  const [wizGenIdx, setWizGenIdx] = useState<number | null>(null);
  // Labels the user has already added at the CURRENT step. Used to mark the
  // matching suggestion card with an "Added ✓" pill so multi-pick is obvious.
  // Reset whenever the step changes or a new node is selected.
  const [wizAddedLabels, setWizAddedLabels] = useState<Set<string>>(new Set());
  // The "hub" is the node new wizard children attach to. It starts as the
  // clicked node and becomes the subtopic once one is added, so detail/example/
  // image/resource form a hierarchy under the subtopic instead of all hanging
  // off the main topic.
  const hubCtxRef = useRef<{ nodeId: string; label: string; parentLabels: string[]; siblingLabels: string[]; childLabels: string[] } | null>(null);
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

  // Auto-suggest all nodes — only when the legacy list is shown. The list is
  // hidden in favour of the per-node wizard, so this no longer fires (it was
  // burning AI tokens on every map open for a hidden result).
  const autoSuggestedRef = useRef(false);
  useEffect(() => {
    if (SHOW_LEGACY_SUGGESTIONS && isMapMode && mindmapCtx && mindmapCtx.nodes.length > 0 && suggestions.length === 0 && !suggesting && !autoSuggestedRef.current) {
      autoSuggestedRef.current = true;
      handleSuggestAll();
    }
  }, [isMapMode, mindmapCtx?.nodes.length, suggestions.length, suggesting, handleSuggestAll]);

  // ── Node "build-out" wizard logic ──────────────────────────────────────────
  /** Derive parent/sibling/existing-child labels for a node from the live map. */
  const buildNodeContext = useCallback((node: Node) => {
    const allNodes = mindmapCtx?.nodes ?? [];
    const allEdges = mindmapCtx?.edges ?? [];
    const labelOf = (id: string) =>
      ((allNodes.find(n => n.id === id)?.data as Record<string, unknown>)?.label as string) || "";
    const parentIds = allEdges.filter(e => e.target === node.id).map(e => e.source);
    const childIds = allEdges.filter(e => e.source === node.id).map(e => e.target);
    const siblingIds = allEdges
      .filter(e => parentIds.includes(e.source) && e.target !== node.id)
      .map(e => e.target);
    return {
      parentLabels: [...new Set(parentIds.map(labelOf).filter(Boolean))],
      siblingLabels: [...new Set(siblingIds.map(labelOf).filter(Boolean))],
      childLabels: childIds.map(labelOf).filter(Boolean),
    };
  }, [mindmapCtx]);

  /** Snapshot a node into the wizard "hub" context used for recommend + attach. */
  const nodeToCtx = useCallback((node: Node) => {
    const label = ((node.data as Record<string, unknown>)?.label as string) || "";
    return { nodeId: node.id, label, ...buildNodeContext(node) };
  }, [buildNodeContext]);
  type HubCtx = ReturnType<typeof nodeToCtx>;

  /** Fetch recommendations of the step's type, contextualised on the hub node. */
  const fetchWizard = useCallback(async (ctx: HubCtx, step: number) => {
    if (!mindmapCtx || step >= WIZARD_SEQUENCE.length) return;
    const recType = WIZARD_SEQUENCE[step];
    setWizLoading(true);
    try {
      const res = await aiMindmapBuddyApi.recommendNodes({
        node_id: ctx.nodeId,
        node_label: ctx.label,
        parent_labels: ctx.parentLabels,
        sibling_labels: ctx.siblingLabels,
        map_topic: mindmapCtx.title,
        rec_type: recType,
        existing_children: ctx.childLabels,
      });
      setWizSugs(res.suggestions || []);
    } catch {
      setWizSugs([]);
    }
    setWizLoading(false);
  }, [mindmapCtx]);

  // Restart the wizard whenever the selected node changes.
  const selectedNodeId = mindmapCtx?.selectedNode?.id ?? null;
  useEffect(() => {
    if (!isMapMode) return;
    if (selectedNodeId && selectedNodeId !== wizNodeId) {
      const node = mindmapCtx?.selectedNode;
      const start = node ? nodeStartStep(node) : 0;
      setWizNodeId(selectedNodeId);
      setWizStep(start);
      setWizSugs([]);
      setWizAddedLabels(new Set());
      // The clicked node is the initial hub; a subtopic added later takes over.
      hubCtxRef.current = node ? nodeToCtx(node) : null;
      if (hubCtxRef.current && start < WIZARD_SEQUENCE.length) fetchWizard(hubCtxRef.current, start);
    } else if (!selectedNodeId && wizNodeId) {
      setWizNodeId(null);
      setWizStep(0);
      setWizSugs([]);
      setWizAddedLabels(new Set());
      hubCtxRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapMode, selectedNodeId]);

  const advanceWizard = useCallback(() => {
    // The hub only changes between steps — never during a step. This is where
    // it happens. If the step just finished was "subtopic" and the user picked
    // at least one, the LAST-added subtopic becomes the hub for the upcoming
    // step (so detail/example/image/resource hang beneath it). For non-
    // subtopic steps the hub stays the same; we just append the picks to
    // childLabels so the next fetch's "avoid duplicates" set is accurate.
    const currentStepType = WIZARD_SEQUENCE[wizStep];
    const picks = Array.from(wizAddedLabels);
    if (hubCtxRef.current && picks.length > 0) {
      if (currentStepType === "subtopic") {
        const lastSubtopic = picks[picks.length - 1];
        const prevHub = hubCtxRef.current;
        hubCtxRef.current = {
          nodeId: `wiz-${lastSubtopic}-${Date.now()}`,
          label: lastSubtopic,
          parentLabels: [prevHub.label],
          siblingLabels: picks.slice(0, -1),
          childLabels: [],
        };
      } else {
        hubCtxRef.current = {
          ...hubCtxRef.current,
          childLabels: [...hubCtxRef.current.childLabels, ...picks],
        };
      }
    }
    setWizSugs([]);
    setWizAddedLabels(new Set());
    setWizStep(prev => {
      const next = prev + 1;
      if (next < WIZARD_SEQUENCE.length && hubCtxRef.current) fetchWizard(hubCtxRef.current, next);
      return next;
    });
  }, [fetchWizard, wizStep, wizAddedLabels]);

  /** Add a suggestion under the current hub. Does NOT auto-advance and does
   *  NOT mutate the hub — every Add inside the same step attaches to the
   *  exact same parent. The hub only moves when the user clicks "Next →"
   *  (handled in advanceWizard). */
  const addWizardNode = useCallback((s: NodeSuggestion, generatedImageUrl?: string) => {
    const hub = hubCtxRef.current;
    if (!hub) return;
    const recType = (s.rec_type as WizardType) || WIZARD_SEQUENCE[wizStep];
    const isImage = recType === "image";
    const labelToAdd = stripTag(s.label);
    // Defensive: the UI already swaps the Add button for an "Added ✓" pill.
    if (wizAddedLabels.has(labelToAdd)) return;
    const shape = isImage ? "image" : shapeForMapType(analysis?.recommended_map_type);
    // Always attach to the CURRENT hub. Two subtopics added back-to-back both
    // attach to the clicked node; two details added back-to-back both attach
    // to the same subtopic. (Bug fixed Jun 2026.)
    mindmapCtx?.onAddNode?.(labelToAdd, hub.label, shape, recType);
    if (isImage && generatedImageUrl) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("smartbuddy-image-generated", {
          detail: { imageUrl: generatedImageUrl, label: labelToAdd },
        }));
      }, 500);
    }
    setWizAddedLabels(prev => {
      const next = new Set(prev);
      next.add(labelToAdd);
      return next;
    });
  }, [mindmapCtx, wizStep, wizAddedLabels, analysis?.recommended_map_type]);

  const generateWizardImage = useCallback(async (s: NodeSuggestion, idx: number) => {
    setWizGenIdx(idx);
    const cleanLabel = stripTag(s.label);
    try {
      const result = await aiImagesApi.generate(cleanLabel, undefined, mindmapCtx?.mapId || undefined);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
      const imageUrl = result.image_url.startsWith("http") ? result.image_url : `${apiUrl}${result.image_url}`;
      addWizardNode(s, imageUrl);
    } catch {
      addWizardNode(s); // fall back to an empty image node
    } finally {
      setWizGenIdx(null);
    }
  }, [mindmapCtx, addWizardNode]);

  const handleStyleComplete = (style: string) => {
    setLearningStyle(style);
    loadGuide();
  };

  const dismissBubbles = () => {
    setBubblesDismissed(true);
    localStorage.setItem("mss-smartbuddy-bubbles-dismissed", "true");
  };

  const handleChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    try {
      // Map context is only attached when the user is actually in the map
      // editor. On other pages we send the message bare — the backend's
      // course-RAG / OpenAlex / Gemini pipeline doesn't need a map.
      const mapContext = mindmapCtx?.active ? {
        title: mindmapCtx.title,
        nodeCount: mindmapCtx.nodes.length,
        edgeCount: mindmapCtx.edges.length,
        nodeLabels: mindmapCtx.nodes.slice(0, 20).map(n => ((n.data as Record<string, unknown>)?.label as string) || ""),
      } : undefined;
      const result = await aiMindmapBuddyApi.chat(msg, mapContext);
      setChatMessages(prev => [...prev, {
        role: "buddy",
        text: result.response,
        evidence_level: result.evidence_level,
        sources: result.sources || [],
        suggested_actions: result.suggested_actions || [],
      }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "buddy", text: "Sorry, I couldn't process that. Try again!" }]);
    }
    setChatLoading(false);
  }, [chatInput, mindmapCtx]);

  /** Generate a study material from a chat CTA, then jump to the Study
   *  Materials page where the new entry is now saved. */
  const handleSuggestedAction = useCallback(async (a: ChatSuggestedAction, msgIdx: number, actionIdx: number) => {
    const key = `${msgIdx}:${actionIdx}`;
    setGenActionKey(key);
    try {
      await aiStudyMaterialsApi.generateByTopic({
        topic: a.topic,
        course_id: a.course_id || "",
        type: a.type,
        evidence_tier: a.evidence_tier,
      });
      // Persistent saved in `generatedStudyMaterials` — open the page so the
      // student sees it alongside their other materials with the provenance
      // banner at the top.
      router.push("/student/study-materials");
    } catch (err) {
      // Surface a single follow-up message rather than a toast — keeps the
      // chat self-contained. Include the backend reason when present so the
      // user (and we) see e.g. "No peer-reviewed academic sources found...".
      const reason = err instanceof Error ? err.message : "please try again in a moment";
      setChatMessages(prev => [...prev, {
        role: "buddy",
        text: `Couldn't generate that: ${reason}`,
      }]);
    } finally {
      setGenActionKey(null);
    }
  }, [router]);

  if (!enabled) return null;

  const styleBadgeLabel = learningStyle
    ? learningStyle.charAt(0).toUpperCase() + learningStyle.slice(1)
    : null;

  // Shared chat panel — used both in mind-map mode (Chat tab beside Insights)
  // and on every other dashboard page (Chat tab beside Guide). Adapts copy
  // based on whether the user is currently in the map editor.
  const renderChatPanel = () => (
    <div className="flex flex-col h-[340px]">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {chatMessages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">Ask me anything</p>
            <p className="text-xs text-gray-400 mt-1">
              {isMapMode
                ? "I can help you improve your mind map"
                : "I'll cite where the info comes from — your course notes, peer-reviewed papers, or general knowledge."}
            </p>
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${m.role === "buddy" ? "space-y-2" : ""}`}>
              <div
                className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-md shadow-sm"
                    : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm chat-markdown"
                }`}
              >
                {m.role === "buddy" ? (
                  // Buddy answers may contain markdown (bold, bullets, headings,
                  // [Source N] citations). User messages are single-line input —
                  // render as plain text to avoid surprises.
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      h1: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mt-2 first:mt-0 mb-1">{children}</h3>,
                      h2: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mt-2 first:mt-0 mb-1">{children}</h3>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mt-2 first:mt-0 mb-1">{children}</h3>,
                      code: ({ children }) => <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-800 text-[12px] font-mono">{children}</code>,
                      a: ({ children, href }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-indigo-600 hover:text-indigo-800">{children}</a>
                      ),
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
              {m.role === "buddy" && (m.sources?.length || m.suggested_actions?.length) ? (
                <div className="space-y-1.5">
                  {m.evidence_level === "online" && (
                    <p className="text-[10.5px] text-gray-500 italic px-1">
                      No course materials matched — using peer-reviewed academic literature.
                    </p>
                  )}
                  {m.evidence_level === "general_knowledge" && (
                    <p className="text-[10.5px] text-amber-600 italic px-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      No course materials or open-access papers found — please verify citations.
                    </p>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((s, idx) => {
                        const isCourse = s.tier === "course";
                        const isOnline = s.tier === "online";
                        const isUnverified = s.tier === "general_knowledge" && s.verified === false;
                        const Icon = isCourse ? GraduationCap : isOnline ? FileText : Bot;
                        const colour = isCourse
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : isOnline
                            ? "bg-sky-50 border-sky-200 text-sky-700"
                            : isUnverified
                              ? "bg-amber-50 border-amber-300 text-amber-800"
                              : "bg-gray-50 border-gray-200 text-gray-700";
                        const label = isCourse
                          ? `Course — ${s.title}${s.doc_type ? ` (${s.doc_type})` : ""}`
                          : isOnline
                            ? `${s.authors || ""} (${s.year ?? "n.d."}). ${s.title}${s.venue ? ` — ${s.venue}` : ""}`
                            : `${s.authors || ""} (${s.year ?? "n.d."}). ${s.title}${isUnverified ? " — unverified" : ""}`;
                        const content = (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] border ${colour}`}>
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[260px]">{label}</span>
                            {s.url ? <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" /> : null}
                          </span>
                        );
                        return s.url ? (
                          <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}>{content}</a>
                        ) : (
                          <span key={idx} title={s.title}>{content}</span>
                        );
                      })}
                    </div>
                  )}
                  {m.suggested_actions && m.suggested_actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {m.suggested_actions.map((a, idx) => {
                        const key = `${i}:${idx}`;
                        const isBusy = genActionKey === key;
                        const label = a.type === "flashcards"
                          ? "Generate flashcards"
                          : a.type === "summary"
                            ? "Make a summary"
                            : "Build a quiz";
                        return (
                          <button
                            key={key}
                            disabled={!!genActionKey}
                            onClick={() => handleSuggestedAction(a, i, idx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                            title={a.evidence_tier === "course"
                              ? "From your course notes"
                              : a.evidence_tier === "online"
                                ? "From academic literature (NOT your course notes)"
                                : "From AI general knowledge (NOT your course notes)"}
                          >
                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {label}
                            {a.evidence_tier !== "course" && (
                              <span className="text-[9px] uppercase opacity-70">⚠ not course</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
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
            placeholder={isMapMode ? "Ask about your mind map..." : "Ask me anything..."}
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
  );

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

      {/* Panel — mobile expands from the bottom-nav FAB with a circular
          reveal (clip-path), desktop keeps the floating-card scale-in. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={
              isMobile
                ? { clipPath: "circle(28px at 50% calc(100% - 6rem))" }
                : { opacity: 0, y: 20, scale: 0.95 }
            }
            animate={
              isMobile
                ? { clipPath: "circle(150% at 50% calc(100% - 6rem))" }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isMobile
                ? { clipPath: "circle(28px at 50% calc(100% - 6rem))" }
                : { opacity: 0, y: 20, scale: 0.95 }
            }
            transition={
              isMobile
                ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                : { type: "spring", damping: 25, stiffness: 300 }
            }
            className={
              isMobile
                ? "fixed inset-0 z-50 flex flex-col overflow-hidden"
                : "fixed bottom-6 right-6 z-50 w-[400px] max-h-[560px] rounded-2xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden"
            }
            style={{
              background: "#ffffff",
              border: isMobile ? "none" : "1px solid #e5e7eb",
              color: "#1a1a2e",
              paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : 0,
              paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : 0,
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
                      {/* ── Per-node build-out wizard (auto-advances by type) ── */}
                      {(() => {
                        const selNode = mindmapCtx?.selectedNode;
                        if (!selNode) {
                          return mindmapCtx && mindmapCtx.nodes.length > 0 ? (
                            <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-600">
                              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                              Click a node on your map to build it out step by step.
                            </div>
                          ) : null;
                        }
                        const nodeLabel = ((selNode.data as Record<string, unknown>)?.label as string) || "(empty node)";
                        const nodeType = ((selNode.data as Record<string, unknown>)?.smartType as WizardType) || undefined;
                        const nodeTypeMeta = nodeType ? WIZARD_TYPE_META[nodeType] : null;
                        const done = wizStep >= WIZARD_SEQUENCE.length;
                        const curMeta = !done ? WIZARD_TYPE_META[WIZARD_SEQUENCE[wizStep]] : null;
                        return (
                          <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-sm">
                            {/* Header */}
                            <div className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">Build out this node</p>
                                  {nodeTypeMeta && (
                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-semibold border ${nodeTypeMeta.bg} ${nodeTypeMeta.color}`}>
                                      <nodeTypeMeta.icon className="w-2 h-2" />{nodeTypeMeta.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-gray-800 truncate">{nodeLabel}</p>
                              </div>
                              {!done && <span className="text-[10px] text-gray-400 shrink-0">Step {wizStep + 1}/{WIZARD_SEQUENCE.length}</span>}
                            </div>
                            {/* Step pills */}
                            <div className="flex flex-wrap items-center gap-1 px-3 py-2">
                              {WIZARD_SEQUENCE.map((t, i) => {
                                const meta = WIZARD_TYPE_META[t];
                                const isDone = i < wizStep, isCur = i === wizStep;
                                return (
                                  <div key={t} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${isCur ? `${meta.bg} ${meta.color}` : isDone ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-300 border-gray-100"}`}>
                                    <meta.icon className="w-2.5 h-2.5" />{meta.label}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Body */}
                            <div className="px-3 pb-3 pt-0.5">
                              {done ? (
                                <div className="text-center py-3 space-y-2">
                                  <p className="text-sm text-gray-600">🎉 Nice — you&apos;ve built out this node.</p>
                                  <p className="text-[11px] text-gray-400">Click another node to keep going.</p>
                                </div>
                              ) : wizLoading ? (
                                <div className="flex items-center gap-2 py-3 text-gray-500 text-xs">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Finding a {curMeta!.label.toLowerCase()}…
                                </div>
                              ) : wizSugs.length === 0 ? (
                                <div className="flex items-center justify-between py-2">
                                  <p className="text-xs text-gray-400">No {curMeta!.label.toLowerCase()} suggestion right now.</p>
                                  <button onClick={advanceWizard} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm">
                                    Next <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {wizSugs.map((s, i) => {
                                    const recType = ((s.rec_type as WizardType) || WIZARD_SEQUENCE[wizStep]);
                                    const meta = WIZARD_TYPE_META[recType] || curMeta!;
                                    const isImage = recType === "image";
                                    const SIcon = meta.icon;
                                    const cleanLabel = stripTag(s.label);
                                    const alreadyAdded = wizAddedLabels.has(cleanLabel);
                                    return (
                                      <div key={i} className={`rounded-lg border p-2.5 ${meta.bg} ${alreadyAdded ? "opacity-70" : ""}`}>
                                        <div className="flex items-start gap-2">
                                          <SIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800">{cleanLabel}</p>
                                            {s.description && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{s.description}</p>}
                                          </div>
                                        </div>
                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                          {alreadyAdded ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                                              ✓ Added to map
                                            </span>
                                          ) : isImage ? (
                                            <>
                                              <button onClick={() => addWizardNode(s)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-all active:scale-95 shadow-sm">
                                                <ImageIcon className="w-3 h-3" /> Add image node
                                              </button>
                                              <button disabled={wizGenIdx === i} onClick={() => generateWizardImage(s, i)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r ${meta.btn} text-white text-xs font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm disabled:opacity-50`}>
                                                {wizGenIdx === i ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</> : <><Sparkles className="w-3 h-3" /> Generate</>}
                                              </button>
                                            </>
                                          ) : (
                                            <button onClick={() => addWizardNode(s)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r ${meta.btn} text-white text-xs font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm`}>
                                              <Plus className="w-3 h-3" /> Add to map
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Footer: Next-step button is the primary action now (replaces per-card Skip).
                                      Pick count tells the user how many they've added at this step. */}
                                  <div className="flex items-center justify-between pt-1">
                                    <button onClick={() => hubCtxRef.current && fetchWizard(hubCtxRef.current, wizStep)} className="text-[11px] text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
                                      <RefreshCw className="w-3 h-3" /> More ideas
                                    </button>
                                    <button onClick={advanceWizard} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm">
                                      {wizAddedLabels.size > 0 && (
                                        <span className="text-[10px] opacity-90">{wizAddedLabels.size} added ·</span>
                                      )}
                                      Next <ArrowRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

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
                            <div className={`rounded-2xl border bg-gradient-to-br ${ratingBg(analysis.rating)} p-4`}>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3" /> Map health
                                </span>
                                <button onClick={() => handleAnalyze()} disabled={analyzing} className="p-1.5 hover:bg-white/70 rounded-lg transition-colors text-gray-400" title="Re-analyze">
                                  {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-4xl font-bold leading-none ${ratingColor(analysis.rating)}`}>{analysis.rating}</span>
                                  <span className="text-gray-400 text-sm font-medium">/10</span>
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  analysis.rating >= 8 ? "bg-emerald-100 text-emerald-700" :
                                  analysis.rating >= 6 ? "bg-blue-100 text-blue-700" :
                                  analysis.rating >= 4 ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                                }`}>{analysis.rating_label}</span>
                              </div>
                              <div className="flex gap-1 mb-3">
                                {Array.from({ length: 10 }).map((_, i) => (
                                  <div key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i < analysis.rating ? ratingBarColor(analysis.rating) : "#e5e7eb" }} />
                                ))}
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{analysis.structure_feedback}</p>
                            </div>
                          )}

                          {/* ── Strengths & Improvements (stacked, clearer) ── */}
                          {analysis && (analysis.strengths.length > 0 || analysis.improvements.length > 0) && (
                            <div className="space-y-2">
                              {analysis.strengths.length > 0 && (
                                <div className="rounded-2xl p-3 bg-white border border-emerald-100 shadow-sm">
                                  <h4 className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center"><Star className="w-3 h-3" /></span>
                                    Strengths
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {analysis.strengths.slice(0, 3).map((s, i) => (
                                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-snug">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {analysis.improvements.length > 0 && (
                                <div className="rounded-2xl p-3 bg-white border border-amber-100 shadow-sm">
                                  <h4 className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center"><Lightbulb className="w-3 h-3" /></span>
                                    To improve
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {analysis.improvements.slice(0, 3).map((s, i) => (
                                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-snug">
                                        <ArrowRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Map Type Recommendation ── */}
                          {analysis && analysis.type_change_reason && (
                            <div className="rounded-2xl p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="w-5 h-5 rounded-lg bg-purple-100 flex items-center justify-center"><GitBranch className="w-3 h-3 text-purple-600" /></span>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">Suggested map type</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-800">{analysis.recommended_map_type}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{analysis.type_change_reason}</p>
                            </div>
                          )}

                          {/* ── Suggestions Section (hidden: the per-node wizard above replaces "Add to your map") ── */}
                          {SHOW_LEGACY_SUGGESTIONS && (suggestions.length > 0 || (analysis && analysis.suggested_nodes.length > 0) || suggesting) && (
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

                  {/* ── Chat Tab ── (shared with non-map mode) */}
                  {mapTab === "chat" && renderChatPanel()}
                </div>
              </>
            ) : (
              /* ═══ NORMAL STUDY MODE — Guide / Chat tabs ═══ */
              <>
                {/* Tab strip — same shape as the map-mode strip so the widget
                    feels consistent. The Chat tab is reachable on every
                    dashboard page (not just the map editor). */}
                <div className="flex" style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {([
                    { key: "guide" as NonMapTab, icon: Lightbulb, label: "Guide" },
                    { key: "chat" as NonMapTab, icon: MessageSquare, label: "Chat" },
                  ]).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setNonMapTab(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                        nonMapTab === t.key
                          ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>

                {nonMapTab === "chat" ? renderChatPanel() : (
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
