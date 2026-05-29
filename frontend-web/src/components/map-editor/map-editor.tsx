"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  useReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnReconnect,
  type OnSelectionChangeFunc,
  BackgroundVariant,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, SHAPE_DEFAULTS } from "./custom-nodes";
import { edgeTypes, MarkerDefinitions } from "./custom-edges";
import ShapePalette from "./shape-palette";
import SwapShapePrompt from "./swap-shape-prompt";
import { NON_SWAPPABLE_SHAPES } from "./shape-meta";
import {
  getHierarchicalTemplate, getSpiderTemplate, getBubbleTemplate, getTreeTemplate,
  getFlowchartTemplate, getSwotTemplate, getKwlTemplate, getCauseEffectTemplate,
  getTimelineTemplate, getOrgChartTemplate, getProcessMapTemplate,
  getVennDiagramTemplate, getCornellNotesTemplate,
  getCircleMapTemplate, getDoubleBubbleMapTemplate, getBraceMapTemplate,
  getBridgeMapTemplate, getFlowMapTemplate, getMultiFlowMapTemplate,
} from "./templates";
import PropertiesPanel from "./properties-panel";
import ShareModal from "./share-modal";
import dynamic from "next/dynamic";

const AnnotationLayer = dynamic(() => import("./annotation-layer"), { ssr: false });

import { useMindmapContext } from "@/contexts/mindmap-context";
import PresenceIndicators from "./presence-indicators";
import LecturerViewers from "./lecturer-viewers";
import { useMapPersistence } from "./use-map-persistence";
import { useCollaboration } from "./use-collaboration";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { exportToPng, exportToPdf } from "@/lib/export-map";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/use-auth";
import {
  Save, Download, Share2, Undo2, Redo2, Trash2, ZoomIn, ZoomOut,
  ChevronDown, FileImage, FileText,
  Grid3X3, Maximize2, History, StickyNote,
} from "lucide-react";
import HistoryPanel from "./history-panel";

interface MapEditorProps {
  mapId: string | null;
  ownerId: string;
  ownerEmail: string;
  initialTemplate?: string | null;
}

/** Distinct colours cycled across added nodes so each node stands out. */
const NODE_PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4",
  "#8b5cf6", "#f97316", "#14b8a6", "#ef4444", "#a78bfa",
  "#38bdf8", "#eab308", "#f43f5e", "#a3e635",
];

/** When a node is added by the SmartBuddy wizard it carries a `smartType`
 *  (subtopic / detail / example / image / resource). Colour the stroke by
 *  type so the map reads at a glance: all subtopics indigo, all details
 *  emerald, etc. Generic nodes (no smartType) still cycle through
 *  NODE_PALETTE so they stay visually distinct. */
const SMART_TYPE_COLORS: Record<string, string> = {
  subtopic: "#6366f1", // indigo
  detail:   "#10b981", // emerald
  example:  "#f59e0b", // amber
  image:    "#ec4899", // pink
  resource: "#06b6d4", // cyan
};

/** Backfill an explicit style.width/height on shape nodes saved before resizing
 * worked (older maps stored no size, so NodeResizer had no box to act on).
 * Text auto-sizes; group/image were already saved with a size. */
function normalizeNodeSizes(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type === "text") return n;
    const style = (n.style as Record<string, number> | undefined) || undefined;
    if (style?.width != null && style?.height != null) return n;
    const shape = ((n.data as Record<string, unknown>)?.shape as string) || n.type || "rectangle";
    const defaults = SHAPE_DEFAULTS[shape] || { w: 140, h: 60 };
    const w = n.measured?.width ?? style?.width ?? defaults.w;
    const h = n.measured?.height ?? style?.height ?? defaults.h;
    return { ...n, style: { ...(n.style || {}), width: w, height: h } };
  });
}

/** Get the bounding box (width, height) of a node from its style or shape defaults. */
function getNodeSize(node: Node): { w: number; h: number } {
  const shape = ((node.data as Record<string, unknown>)?.shape as string) || node.type || "rectangle";
  const defaults = SHAPE_DEFAULTS[shape] || { w: 140, h: 60 };
  return {
    w: (node.measured?.width ?? (node.style as Record<string, number>)?.width ?? defaults.w),
    h: (node.measured?.height ?? (node.style as Record<string, number>)?.height ?? defaults.h),
  };
}

/** Common placeholder labels we DON'T want to use as a map title. */
const PLACEHOLDER_LABELS = new Set([
  "", "main topic", "central topic", "central idea", "main idea",
  "topic", "untitled", "untitled map", "new node", "node",
]);

function isPlaceholderLabel(label: string): boolean {
  return PLACEHOLDER_LABELS.has(label.trim().toLowerCase());
}

/** Pick the "main topic" node: most outgoing edges, ties broken by earliest in
 *  the array (first-created). Returns null for empty maps. Matches the
 *  most-connected heuristic already used by handleAddLabeledNode. */
function pickMainNode(nodes: Node[], edges: Edge[]): Node | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  const outDeg = new Map<string, number>();
  edges.forEach(e => outDeg.set(e.source, (outDeg.get(e.source) || 0) + 1));
  let best = nodes[0];
  let bestDeg = outDeg.get(best.id) || 0;
  for (let i = 1; i < nodes.length; i++) {
    const d = outDeg.get(nodes[i].id) || 0;
    if (d > bestDeg) { best = nodes[i]; bestDeg = d; }
  }
  return best;
}

/** Return the topmost node whose bounding box contains the given flow position. */
function findNodeAt(pos: { x: number; y: number }, nodes: Node[]): Node | null {
  // Iterate in reverse so later-painted (visually on top) nodes win on overlap.
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const { w, h } = getNodeSize(n);
    if (
      pos.x >= n.position.x && pos.x <= n.position.x + w &&
      pos.y >= n.position.y && pos.y <= n.position.y + h
    ) {
      return n;
    }
  }
  return null;
}

/** Check whether two axis-aligned boxes overlap with the given gap between them. */
function boxesOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
  gap: number,
): boolean {
  return (
    ax < bx + bw + gap &&
    ax + aw + gap > bx &&
    ay < by + bh + gap &&
    ay + ah + gap > by
  );
}

/**
 * Find a position near (baseX, baseY) that doesn't overlap any existing node.
 * Uses expanding grid search for reliability.
 */
function findNonOverlappingPosition(
  baseX: number,
  baseY: number,
  shape: string,
  existingNodes: Node[],
  gap: number = 30,
): { x: number; y: number } {
  const defaults = SHAPE_DEFAULTS[shape] || { w: 140, h: 60 };
  const w = defaults.w;
  const h = defaults.h;

  const overlaps = (x: number, y: number) =>
    existingNodes.some((n) => {
      const ns = getNodeSize(n);
      return boxesOverlap(x, y, w, h, n.position.x, n.position.y, ns.w, ns.h, gap);
    });

  if (!overlaps(baseX, baseY)) return { x: baseX, y: baseY };

  // Grid-based spiral: step by half the node width/height for dense but reliable scanning
  const stepX = w + gap;
  const stepY = h + gap;
  for (let ring = 1; ring <= 30; ring++) {
    // Walk the perimeter of a ring at Manhattan distance `ring`
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue; // perimeter only
        const x = baseX + dx * stepX;
        const y = baseY + dy * stepY;
        if (!overlaps(x, y)) return { x, y };
      }
    }
  }

  return { x: baseX + stepX * 2, y: baseY + stepY * 2 };
}

export default function MapEditor(props: MapEditorProps) {
  return (
    <ReactFlowProvider>
      <MapEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function MapEditorInner({ mapId, ownerId, ownerEmail, initialTemplate }: MapEditorProps) {
  const reactFlowInstance = useReactFlow();
  const { zoomIn, zoomOut, screenToFlowPosition, fitView } = reactFlowInstance;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const mindmapCtx = useMindmapContext();
  const { user: authUser } = useAuth();
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [title, setTitle] = useState("Untitled Map");
  // Tracks the title we auto-set from the main node's label. While the live
  // title still matches this (or the default), auto-sync keeps following the
  // main node. The moment the user types into the title input we set this to
  // null and stop. Clearing the title resets to "" → auto-sync re-engages.
  const lastAutoTitleRef = useRef<string | null>("Untitled Map");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);

  const [bgVariant, setBgVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Drag-from-palette → swap-existing-shape flow.
  const [swapPrompt, setSwapPrompt] = useState<
    { nodeId: string; currentShape: string; newShape: string; x: number; y: number } | null
  >(null);
  const [dragHoverNodeId, setDragHoverNodeId] = useState<string | null>(null);

  // Refs for stable access in callbacks (avoids stale closures)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const selectedNodeRef = useRef(selectedNode);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  selectedNodeRef.current = selectedNode;

  const lastSaveCallbackRef = useRef<((data: string) => void) | null>(null);

  const {
    saveStatus, shareCode, collaborators, setCollaborators,
    visibility, updateVisibility,
    loadMap, saveMap,
  } = useMapPersistence({ mapId, ownerId, ownerEmail, nodes, edges, title, canvasRef, reactFlowInstance, isDark, onSaved: (data) => lastSaveCallbackRef.current?.(data) });

  useEffect(() => {
    if (mapId) {
      loadMap(mapId).then(result => {
        if (result) {
          setNodes(normalizeNodeSizes(result.nodes));
          setEdges(result.edges);
          setTitle(result.title);
        }
      });
    }
  }, [mapId, loadMap]);

  // Auto-load template from query param (e.g., from recommendation wizard)
  useEffect(() => {
    if (initialTemplate && !mapId) {
      const templateGetters: Record<string, (isDark: boolean) => { nodes: Node[]; edges: Edge[] }> = {
        hierarchical: getHierarchicalTemplate,
        spider: getSpiderTemplate,
        bubble: getBubbleTemplate,
        tree: getTreeTemplate,
        flowchart: getFlowchartTemplate,
        swot: getSwotTemplate,
        kwl: getKwlTemplate,
        causeEffect: getCauseEffectTemplate,
        timeline: getTimelineTemplate,
        orgChart: getOrgChartTemplate,
        processMap: getProcessMapTemplate,
        vennDiagram: getVennDiagramTemplate,
        cornellNotes: getCornellNotesTemplate,
        circleMap: getCircleMapTemplate,
        doubleBubble: getDoubleBubbleMapTemplate,
        braceMap: getBraceMapTemplate,
        bridgeMap: getBridgeMapTemplate,
        flowMap: getFlowMapTemplate,
        multiFlowMap: getMultiFlowMapTemplate,
      };
      const getter = templateGetters[initialTemplate];
      if (getter) {
        const { nodes: tNodes, edges: tEdges } = getter(isDark);
        setNodes(tNodes);
        setEdges(tEdges);
        setTimeout(() => fitView({ padding: 0.2 }), 100);
      }
    }
  }, [initialTemplate, mapId, isDark, fitView]);

  const isRemoteUpdateRef = useRef(false);
  const handleRemoteUpdate = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    isRemoteUpdateRef.current = true;
    setNodes(newNodes);
    setEdges(newEdges);
  }, []);

  const { setLastLocalSave, markDirty } = useCollaboration({ mapId, currentUserId: ownerId, onRemoteUpdate: handleRemoteUpdate });
  lastSaveCallbackRef.current = setLastLocalSave;

  // Mark collaboration as dirty whenever LOCAL state changes, so polling
  // doesn't overwrite unsaved local edits with stale server data.
  // Skip: initial load, template load, and remote updates from collaboration.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    // Skip remote updates — they came from the server, not the user
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (!initialLoadDone.current) {
      // Skip the first render (initial load / template load)
      if (nodes.length > 0 || edges.length > 0) initialLoadDone.current = true;
      return;
    }
    markDirty();
  }, [nodes, edges, markDirty]);

  // ── Register with Smart Buddy context ──
  // Use a ref for the context to avoid infinite update loops.
  // (useContext returns a new object every time the provider re-renders,
  //  which would re-trigger effects that call context setters, creating a cycle.)
  const mindmapCtxRef = useRef(mindmapCtx);
  mindmapCtxRef.current = mindmapCtx;

  useEffect(() => {
    mindmapCtxRef.current?.register({ nodes, edges, title, selectedNode });
    mindmapCtxRef.current?.setMapId(mapId);
    return () => { mindmapCtxRef.current?.unregister(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mindmapCtxRef.current?.update({ nodes, edges, title, selectedNode });
  }, [nodes, edges, title, selectedNode]);

  // ── Auto-rename "Untitled Map" to the main topic's label ───────────────
  // Keeps the title in sync with the most-connected node's label as long as
  // the user hasn't manually overridden the title (see lastAutoTitleRef).
  useEffect(() => {
    const main = pickMainNode(nodes, edges);
    if (!main) return;
    const label = (((main.data as Record<string, unknown>)?.label as string) || "").trim();
    if (!label || isPlaceholderLabel(label)) return;
    // Auto-sync only when the title is still "ours" (last auto-set value) or
    // a known default. A user-typed title sets lastAutoTitleRef to null, so
    // the equality check below fails and we leave the title alone.
    const isOurs = lastAutoTitleRef.current !== null && title === lastAutoTitleRef.current;
    const isDefault = title === "Untitled Map" || title === "";
    if (!isOurs && !isDefault) return;
    if (title === label) return;
    setTitle(label);
    lastAutoTitleRef.current = label;
  }, [nodes, edges, title]);

  // ── Apply SmartBuddy highlighting + drag-to-swap hover ring ──
  const highlightedIds = mindmapCtx?.highlightedNodeIds ?? [];
  const displayNodes = (highlightedIds.length > 0 || dragHoverNodeId)
    ? nodes.map(n => {
        const classes: string[] = [];
        if (n.className) classes.push(n.className);
        if (highlightedIds.includes(n.id)) classes.push("smartbuddy-highlight");
        if (dragHoverNodeId === n.id) classes.push("swap-target-ring");
        return classes.length ? { ...n, className: classes.join(" ") } : n;
      })
    : nodes;

  // ── History ──

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { nodes: [...nodes], edges: [...edges] }]);
    setHistoryIndex(prev => prev + 1);
  }, [nodes, edges, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistoryIndex(i => i - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistoryIndex(i => i + 1);
  }, [history, historyIndex]);

  // ── React Flow callbacks ──

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes(nds => {
      // Filter out position/dimension changes for locked nodes
      const filtered = changes.filter(change => {
        if (change.type === "position" || change.type === "dimensions") {
          const node = nds.find(n => n.id === change.id);
          if (node && (node.data as Record<string, unknown>)?.locked) return false;
        }
        return true;
      });
      return applyNodeChanges(filtered, nds);
    });
  }, []);

  // Save history after drag ends (user can freely position nodes, use layers for stacking)
  const onNodeDragStop = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect: OnConnect = useCallback((connection) => {
    setEdges(eds => addEdge({
      ...connection,
      type: "bezier",
      zIndex: 1,
      style: { stroke: "#6366f1", strokeWidth: 2 },
      data: { label: "", strokeDasharray: "", targetArrow: "block", sourceArrow: "none" },
    }, eds));
    pushHistory();
  }, [pushHistory]);

  // Allow dragging edge endpoints to reconnect to different nodes
  const onReconnect: OnReconnect = useCallback((oldEdge, newConnection) => {
    setEdges(eds => reconnectEdge(oldEdge, newConnection, eds));
    pushHistory();
  }, [pushHistory]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    setSelectedNodeIds(selNodes.map(n => n.id));
    setSelectedEdgeIds(selEdges.map(e => e.id));
    if (selNodes.length === 1) {
      setSelectedNode(selNodes[0]);
      setSelectedEdge(null);
    } else if (selEdges.length === 1 && selNodes.length === 0) {
      setSelectedEdge(selEdges[0]);
      setSelectedNode(null);
    } else if (selNodes.length > 1) {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  }, []);

  // ── Node creation ──

  const createNode = useCallback((shape: string, position: { x: number; y: number }): Node => {
    const defaults = SHAPE_DEFAULTS[shape] || { w: 120, h: 70, stroke: "#6366f1" };
    const fillColor = isDark ? "#1a1a28" : "#ffffff";
    const fontColor = isDark ? "#e0e0e0" : "#1e1e2e";
    return {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: shape,
      position,
      data: {
        label: shape === "text" ? "Text" : shape === "group" ? "Group" : shape === "image" ? "" : "",
        fillColor,
        strokeColor: defaults.stroke,
        strokeWidth: 2,
        fontColor,
        fontSize: 14,
        shape,
        opacity: 1,
        rotation: 0,
        shadow: false,
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        fontFamily: "inherit",
        gradientColor: "",
      },
      // Every node gets an explicit size so NodeResizer has a defined box to
      // grow/shrink. Text is the exception — it auto-sizes to its content.
      ...(shape === "group"
        ? { style: { width: 300, height: 200 } }
        : shape === "image"
          ? { style: { width: 160, height: 140 } }
          : shape === "text"
            ? {}
            : { style: { width: defaults.w, height: defaults.h } }),
    };
  }, [isDark]);

  const handleAddNode = useCallback((shape: string) => {
    const pos = findNonOverlappingPosition(
      200 + Math.random() * 200,
      200 + Math.random() * 200,
      shape,
      nodesRef.current,
    );
    const node = createNode(shape, pos);
    setNodes(nds => [...nds, node]);
    pushHistory();
  }, [createNode, pushHistory]);

  const handleAddLabeledNode = useCallback((label: string, parentLabel?: string, nodeType?: string, smartType?: string, parentNodeId?: string): string => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    // Find the correct parent node to connect to, most reliable first:
    // 0. If parentNodeId provided, attach to that EXACT node (no ambiguity).
    // 1. Else if parentLabel provided (from AI), match EXACTLY to an existing node.
    // 2. Else fall back to the root node (first node / node with most children).
    // NOTE: We intentionally do NOT use selectedNodeRef — the last-clicked node is not
    //       the correct parent. The AI tells us which node to connect to.
    let anchor: Node | null = null;

    if (parentNodeId) {
      anchor = currentNodes.find(n => n.id === parentNodeId) || null;
    }

    if (!anchor && parentLabel) {
      const normalizedParent = parentLabel.toLowerCase().trim();
      // Try exact match first
      anchor = currentNodes.find(n => {
        const nodeLabel = ((n.data as Record<string, unknown>)?.label as string) || "";
        return nodeLabel.toLowerCase().trim() === normalizedParent;
      }) || null;
      // Try partial match if exact fails
      if (!anchor) {
        anchor = currentNodes.find(n => {
          const nodeLabel = ((n.data as Record<string, unknown>)?.label as string) || "";
          return nodeLabel.toLowerCase().includes(normalizedParent) || normalizedParent.includes(nodeLabel.toLowerCase().trim());
        }) || null;
      }
    }

    // Fallback: find the most connected node (main/root node)
    if (!anchor && currentNodes.length > 0) {
      const childCount = new Map<string, number>();
      currentEdges.forEach(e => {
        childCount.set(e.source, (childCount.get(e.source) || 0) + 1);
      });
      // Sort by most children = most likely the main node
      const sorted = [...currentNodes].sort((a, b) => (childCount.get(b.id) || 0) - (childCount.get(a.id) || 0));
      anchor = sorted[0];
    }

    // Count existing children of anchor to stagger position
    const existingChildCount = anchor ? currentEdges.filter(e => e.source === anchor!.id).length : 0;
    const angleStep = 45; // degrees between children
    const startAngle = -90; // start from top
    const radius = 200;
    const angle = startAngle + existingChildCount * angleStep;
    const rad = (angle * Math.PI) / 180;

    const baseX = anchor ? anchor.position.x + Math.cos(rad) * radius : 200 + Math.random() * 300;
    const baseY = anchor ? anchor.position.y + Math.sin(rad) * radius : 200 + Math.random() * 300;

    // nodeType may carry any shape key (e.g. "ellipse" for a spider map) or
    // "image"; fall back to roundedRect for anything unrecognised/undefined.
    const shape = nodeType && SHAPE_DEFAULTS[nodeType] ? nodeType : "roundedRect";
    const pos = findNonOverlappingPosition(baseX, baseY, shape, currentNodes);
    const node = createNode(shape, pos);
    // Colour rule: wizard nodes share a stroke colour by their smartType
    // (all subtopics indigo, all details emerald, …) so the map reads at a
    // glance. Generic nodes (no smartType) keep the rotating palette so a
    // hand-built map still gets distinct colours per node.
    const nodeColor = (smartType && SMART_TYPE_COLORS[smartType])
      ? SMART_TYPE_COLORS[smartType]
      : NODE_PALETTE[currentNodes.length % NODE_PALETTE.length];
    node.data = { ...node.data as Record<string, unknown>, label, strokeColor: nodeColor, ...(smartType ? { smartType } : {}) };

    // Build new edge connecting anchor → new node — coloured to match the node.
    const inheritedColor = nodeColor;
    const newEdge: Edge | null = anchor ? {
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: anchor.id,
      target: node.id,
      type: "bezier",
      zIndex: 1,
      style: { stroke: inheritedColor, strokeWidth: 2 },
      data: { label: "", strokeDasharray: "", targetArrow: "block", sourceArrow: "none", arrowColor: inheritedColor },
    } : null;

    // Apply state updates using functional setters
    setNodes(nds => [...nds, node]);
    if (newEdge) {
      setEdges(eds => [...eds, newEdge]);
    }

    // Push history
    setHistory(prev => [...prev.slice(0, historyIndex + 1), {
      nodes: [...currentNodes, node],
      edges: newEdge ? [...currentEdges, newEdge] : [...currentEdges],
    }]);
    setHistoryIndex(prev => prev + 1);

    // Return the new node's id so callers (e.g. the SmartBuddy wizard) can
    // chain further children directly onto it by id instead of by label.
    return node.id;
  }, [createNode, historyIndex]);

  useEffect(() => {
    mindmapCtxRef.current?.setOnAddNode(handleAddLabeledNode);
  }, [handleAddLabeledNode]);

  // Listen for AI-generated images from Smart Buddy and apply to the latest image node
  useEffect(() => {
    const handler = (e: Event) => {
      const { imageUrl, label } = (e as CustomEvent).detail;
      setNodes(nds => {
        // Find the most recent image node matching the label
        for (let i = nds.length - 1; i >= 0; i--) {
          const d = nds[i].data as Record<string, unknown>;
          if (nds[i].type === "image" && d.label === label && !d.imageUrl) {
            const updated = [...nds];
            updated[i] = { ...nds[i], data: { ...d, imageUrl } };
            return updated;
          }
        }
        return nds;
      });
    };
    window.addEventListener("smartbuddy-image-generated", handler);
    return () => window.removeEventListener("smartbuddy-image-generated", handler);
  }, []);

  const handleLoadTemplate = (templateNodes: Node[], templateEdges: Edge[]) => {
    setNodes(templateNodes);
    setEdges(templateEdges);
    pushHistory();
  };

  // ── Drag and drop from palette ──

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Highlight the node under the cursor so the user sees they can drop-to-swap.
    // dataTransfer.getData is restricted during dragover, so we just light up
    // whatever node is under the cursor — drop will validate compatibility.
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const hit = findNodeAt(flowPos, nodesRef.current);
    const hitId = hit && !NON_SWAPPABLE_SHAPES.has(
      ((hit.data as Record<string, unknown>)?.shape as string) || hit.type || ""
    ) ? hit.id : null;
    setDragHoverNodeId(prev => (prev === hitId ? prev : hitId));
  }, [screenToFlowPosition]);

  const onDragLeave = useCallback(() => {
    setDragHoverNodeId(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragHoverNodeId(null);
    const shape = e.dataTransfer.getData("application/reactflow-shape");
    if (!shape) return;
    const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    // If the drop landed on an existing swappable node, offer to swap its
    // shape instead of creating a new one. Text/image/group nodes are
    // structurally different — fall through to "create" for those.
    const hit = findNodeAt(dropPos, nodesRef.current);
    if (hit) {
      const currentShape = ((hit.data as Record<string, unknown>)?.shape as string) || hit.type || "rectangle";
      const incompatible =
        NON_SWAPPABLE_SHAPES.has(currentShape) ||
        NON_SWAPPABLE_SHAPES.has(shape) ||
        currentShape === shape;
      if (!incompatible) {
        setSwapPrompt({
          nodeId: hit.id,
          currentShape,
          newShape: shape,
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }
    }

    const position = findNonOverlappingPosition(dropPos.x, dropPos.y, shape, nodesRef.current);
    const node = createNode(shape, position);
    setNodes(nds => [...nds, node]);
    pushHistory();
  }, [screenToFlowPosition, createNode, pushHistory]);

  /** Convert an existing node's shape in place. Keeps label, position,
   *  size, colours, edges; only `data.shape` and `type` change. */
  const handleSwapShape = useCallback((id: string, newShape: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const data = (n.data as Record<string, unknown>) || {};
      const defaults = SHAPE_DEFAULTS[newShape] || {};
      const nextData: Record<string, unknown> = { ...data, shape: newShape };
      // Only fall back to the new shape's default stroke when the user hasn't
      // explicitly picked one — keeps custom colours intact.
      if (!data.strokeColor && defaults.stroke) {
        nextData.strokeColor = defaults.stroke;
      }
      return { ...n, type: newShape, data: nextData };
    }));
    pushHistory();
  }, [pushHistory]);

  // ── Property changes ──

  const handleNodeChange = useCallback((id: string, data: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n));
    setSelectedNode(prev => prev?.id === id ? { ...prev, data } : prev);
  }, []);

  const handleEdgeChange = useCallback((id: string, updates: Partial<Edge>) => {
    const applyUpdates = (e: Edge): Edge => {
      const merged = { ...e };
      if (updates.style) merged.style = { ...e.style, ...updates.style };
      if (updates.data) merged.data = { ...((e.data || {}) as Record<string, unknown>), ...(updates.data as Record<string, unknown>) };
      if (updates.type) merged.type = updates.type;
      if ("sourceHandle" in updates) merged.sourceHandle = updates.sourceHandle ?? undefined;
      if ("targetHandle" in updates) merged.targetHandle = updates.targetHandle ?? undefined;
      return merged;
    };
    setEdges(eds => eds.map(e => e.id !== id ? e : applyUpdates(e)));
    setSelectedEdge(prev => prev?.id !== id ? prev : applyUpdates(prev));
  }, []);

  // ── Delete ──

  const handleDelete = useCallback(() => {
    const nodeIdsToDelete = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNode ? [selectedNode.id] : [];
    const edgeIdsToDelete = selectedEdgeIds.length > 0 ? selectedEdgeIds : selectedEdge ? [selectedEdge.id] : [];
    if (nodeIdsToDelete.length > 0) {
      const nodeSet = new Set(nodeIdsToDelete);
      setNodes(nds => nds.filter(n => !nodeSet.has(n.id)));
      setEdges(eds => eds.filter(e => !nodeSet.has(e.source) && !nodeSet.has(e.target)));
    }
    if (edgeIdsToDelete.length > 0) {
      const edgeSet = new Set(edgeIdsToDelete);
      setEdges(eds => eds.filter(e => !edgeSet.has(e.id)));
    }
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    if (nodeIdsToDelete.length > 0 || edgeIdsToDelete.length > 0) pushHistory();
  }, [selectedNode, selectedEdge, selectedNodeIds, selectedEdgeIds, pushHistory]);

  // ── Background cycle ──

  const cycleBg = useCallback(() => {
    const variants = [BackgroundVariant.Dots, BackgroundVariant.Lines, BackgroundVariant.Cross];
    const idx = variants.indexOf(bgVariant);
    setBgVariant(variants[(idx + 1) % variants.length]);
  }, [bgVariant]);

  // ── Keyboard shortcuts ──

  useKeyboardShortcuts({
    nodes, edges, setNodes, setEdges,
    pushHistory, undo, redo, deleteSelected: handleDelete,
    reactFlowInstance, selectedNodeIds, selectedEdgeIds, setSelectedNodeIds,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={e => {
              const v = e.target.value;
              setTitle(v);
              // Typing into the title disables auto-sync (set to null).
              // Clearing the title re-enables it (set to "" so the next
              // sync gate's "isDefault" branch triggers).
              lastAutoTitleRef.current = v === "" ? "" : null;
            }}
            className="text-lg font-semibold text-white bg-transparent border-none outline-none focus:bg-white/5 px-2 py-1 rounded-lg"
          />
          <span className="text-xs text-dark-400 italic">
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Unsaved"}
          </span>
          <PresenceIndicators mapId={mapId} currentUserId={ownerId} />
          <LecturerViewers mapId={mapId} currentUserId={ownerId} />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-dark-200 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 glass-card py-1 z-50 w-40 dropdown-menu">
                <button
                  onClick={() => { canvasRef.current && exportToPng(canvasRef.current, `${title}.png`); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-white/5"
                >
                  <FileImage className="w-4 h-4" /> PNG Image
                </button>
                <button
                  onClick={() => { canvasRef.current && exportToPdf(canvasRef.current, `${title}.pdf`); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-white/5"
                >
                  <FileText className="w-4 h-4" /> PDF Document
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => saveMap()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-dark-200 hover:bg-white/5 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" /> Save
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="btn-gradient flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg relative z-10"
          >
            <Share2 className="w-4 h-4 relative z-10" /> <span className="relative z-10">Share</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 glass border-b border-white/5 flex-wrap">
        <button onClick={undo} className="p-1.5 hover:bg-white/5 rounded text-dark-300 transition-colors" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
        <button onClick={redo} className="p-1.5 hover:bg-white/5 rounded text-dark-300 transition-colors" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button onClick={handleDelete} className="p-1.5 hover:bg-red-500/10 rounded text-dark-300 hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button onClick={() => zoomIn()} className="p-1.5 hover:bg-white/5 rounded text-dark-300 transition-colors" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => zoomOut()} className="p-1.5 hover:bg-white/5 rounded text-dark-300 transition-colors" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => fitView({ padding: 0.1 })} className="p-1.5 hover:bg-white/5 rounded text-dark-300 transition-colors" title="Zoom to Fit (Ctrl+Shift+F)"><Maximize2 className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() => setSnapToGrid(s => !s)}
          className={`p-1.5 rounded transition-colors ${snapToGrid ? "text-accent-blue bg-accent-blue/10" : "text-dark-300 hover:bg-white/5"}`}
          title="Toggle Grid Snap"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button onClick={cycleBg} className="p-1.5 hover:bg-white/5 rounded text-dark-300 transition-colors" title="Cycle Background">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="4" cy="4" r="1" fill="currentColor" /><circle cx="8" cy="4" r="1" fill="currentColor" /><circle cx="12" cy="4" r="1" fill="currentColor" />
            <circle cx="4" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="12" cy="8" r="1" fill="currentColor" />
            <circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={() => setShowHistory(h => !h)}
          className={`p-1.5 rounded transition-colors ${showHistory ? "text-accent-blue bg-accent-blue/10" : "text-dark-300 hover:bg-white/5"}`}
          title="View History"
        >
          <History className="w-4 h-4" />
        </button>
        {mapId && (
          <>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              onClick={() => setShowAnnotations(s => !s)}
              className={`p-1.5 rounded transition-colors ${showAnnotations ? "text-amber-400 bg-amber-400/10" : "text-dark-300 hover:bg-white/5"}`}
              title={showAnnotations ? "Hide Lecturer Annotations" : "Show Lecturer Annotations"}
            >
              <StickyNote className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        <ShapePalette onAddNode={handleAddNode} onLoadTemplate={handleLoadTemplate} />

        <div className="flex-1 relative" ref={canvasRef}>
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onSelectionChange={onSelectionChange}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            edgesReconnectable
            snapToGrid={snapToGrid}
            snapGrid={[15, 15]}
            selectionMode={SelectionMode.Partial}
            selectionOnDrag
            panOnDrag={[1, 2]}
            fitView
            className="bg-dark-800"
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
            onViewportChange={setViewport}
          >
            <MarkerDefinitions edges={edges} />
            <Background gap={20} size={1} color="#2a2a3a" variant={bgVariant} />
            <Controls showInteractive={false} />

          </ReactFlow>
          {/* Drag-to-swap confirmation popup (anchored at the drop cursor) */}
          {swapPrompt && (
            <SwapShapePrompt
              x={swapPrompt.x}
              y={swapPrompt.y}
              currentShape={swapPrompt.currentShape}
              newShape={swapPrompt.newShape}
              onConfirm={() => {
                handleSwapShape(swapPrompt.nodeId, swapPrompt.newShape);
                setSwapPrompt(null);
              }}
              onCancel={() => setSwapPrompt(null)}
            />
          )}
          {/* Read-only annotation layer — shows lecturer sticky notes & drawings */}
          {mapId && authUser && showAnnotations && (
            <AnnotationLayer
              mapId={mapId}
              currentUserId={authUser.id || authUser.uid}
              currentUserName={authUser.email || ""}
              readOnly={true}
              viewport={viewport}
            />
          )}
        </div>

        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onNodeChange={handleNodeChange}
          onEdgeChange={handleEdgeChange}
          nodes={nodes}
          selectedNodeIds={selectedNodeIds}
          setNodes={setNodes}
          mapId={mapId}
          onSaveMap={saveMap}
        />

        <HistoryPanel
          mapId={mapId}
          open={showHistory}
          onClose={() => setShowHistory(false)}
        />

      </div>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        mapId={mapId}
        shareCode={shareCode}
        collaborators={collaborators}
        setCollaborators={setCollaborators}
        visibility={visibility}
        onVisibilityChange={updateVisibility}
      />
    </div>
  );
}
