"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { mapsApi, type MapVisibility } from "@/lib/api";
import { toPng } from "html-to-image";
import { cacheMap, markSynced, getUnsyncedMaps } from "@/lib/offline-cache";
import { getNodesBounds, getViewportForBounds, type Node, type Edge, type ReactFlowInstance } from "@xyflow/react";

const THUMB_W = 400;
const THUMB_H = 300;

interface UseMapPersistenceOptions {
  mapId: string | null;
  ownerId: string;
  ownerEmail: string;
  nodes: Node[];
  edges: Edge[];
  title: string;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  reactFlowInstance: ReactFlowInstance;
  isDark: boolean;
  onSaved?: (graphData: string) => void;
}

export function useMapPersistence({ mapId, ownerId, ownerEmail, nodes, edges, title, canvasRef, reactFlowInstance, isDark, onSaved }: UseMapPersistenceOptions) {
  const [currentMapId, setCurrentMapId] = useState<string | null>(mapId);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [shareCode, setShareCode] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<MapVisibility>("private");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveRef = useRef<string>("");
  // The map id, mirrored into a ref so saveMap reads the freshest value the
  // instant create() returns — React state updates are async and a second
  // save firing before the state commits would otherwise create a duplicate.
  const currentMapIdRef = useRef<string | null>(mapId);
  useEffect(() => { currentMapIdRef.current = currentMapId; }, [currentMapId]);
  // Serialize saves: only one may run at a time. A second call while one is in
  // flight sets `pending` and bails; the in-flight save flushes it on finish.
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const saveMapRef = useRef<((forceNew?: boolean) => Promise<void>) | null>(null);

  // Load existing map
  const loadMap = useCallback(async (id: string) => {
    const data = await mapsApi.get(id);
    setShareCode(data.share_code || "");
    setCollaborators(data.collaborators || []);
    setVisibility((data.visibility as MapVisibility) || "private");

    let parsedNodes: Node[] = [];
    let parsedEdges: Edge[] = [];

    if (data.graph_data) {
      try {
        const parsed = JSON.parse(data.graph_data);
        if (data.graph_format === "reactflow" || parsed.nodes) {
          parsedNodes = parsed.nodes || [];
          parsedEdges = parsed.edges || [];
        }
      } catch {
        // Invalid JSON, start fresh
      }
    }

    return { nodes: parsedNodes, edges: parsedEdges, title: data.title || "Untitled Map" };
  }, []);

  // Generate a centered thumbnail using React Flow's viewport math
  const generateThumbnail = useCallback(async (): Promise<string> => {
    if (!canvasRef.current) return "";
    const viewportEl = canvasRef.current.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewportEl) return "";

    const currentNodes = reactFlowInstance.getNodes();
    if (currentNodes.length === 0) return "";

    try {
      // Decide which nodes to frame: all nodes, or just the main/root node if spread is too large
      let targetNodes = currentNodes;
      const allBounds = getNodesBounds(currentNodes);
      const MAX_SPREAD = 3000; // If the map spans more than this, focus on the main node
      if (allBounds.width > MAX_SPREAD || allBounds.height > MAX_SPREAD) {
        // Find the root/main node: the one with the most outgoing edges (connections)
        const currentEdges = reactFlowInstance.getEdges();
        const outCount = new Map<string, number>();
        currentEdges.forEach(e => outCount.set(e.source, (outCount.get(e.source) || 0) + 1));
        const sorted = [...currentNodes].sort((a, b) => (outCount.get(b.id) || 0) - (outCount.get(a.id) || 0));
        const mainNode = sorted[0];
        // Include the main node and its direct children
        const childIds = new Set(currentEdges.filter(e => e.source === mainNode.id).map(e => e.target));
        targetNodes = currentNodes.filter(n => n.id === mainNode.id || childIds.has(n.id));
      }

      const bounds = getNodesBounds(targetNodes);
      // Add padding around the bounds
      const padding = 40;
      const paddedBounds = {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      };
      const vp = getViewportForBounds(paddedBounds, THUMB_W, THUMB_H, 0.1, 2, 0);

      const bgColor = isDark ? "#12121e" : "#f8f9fb";

      const dataUrl = await toPng(viewportEl, {
        quality: 0.6,
        width: THUMB_W,
        height: THUMB_H,
        backgroundColor: bgColor,
        style: {
          width: `${THUMB_W}px`,
          height: `${THUMB_H}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
        filter: (node) => {
          const cls = (node as HTMLElement)?.className || "";
          if (typeof cls === "string") {
            if (cls.includes("react-flow__controls")) return false;
            if (cls.includes("react-flow__minimap")) return false;
            if (cls.includes("react-flow__attribution")) return false;
            if (cls.includes("react-flow__panel")) return false;
            if (cls.includes("react-flow__background")) return false;
          }
          return true;
        },
      });
      return dataUrl;
    } catch {
      return "";
    }
  }, [canvasRef, reactFlowInstance, isDark]);

  // Save map
  const saveMap = useCallback(async (forceNew = false) => {
    const graphData = JSON.stringify({ nodes, edges });
    if (graphData === lastSaveRef.current && !forceNew) return;

    // Never let two saves overlap — otherwise edits arriving before the first
    // create() resolves would each POST a brand-new map (duplicate copies).
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;

    setSaveStatus("saving");
    try {
      const thumbnail = await generateThumbnail();
      const nodeTexts = nodes.map(n => (n.data as Record<string, unknown>).label || "").join(" ");

      // Cache locally first (offline-first)
      const cacheId = currentMapIdRef.current || "new";
      cacheMap(cacheId, { title, graphData, nodesText: nodeTexts, thumbnail }).catch(() => {});

      const existingId = currentMapIdRef.current;
      if (existingId && !forceNew) {
        await mapsApi.update(existingId, {
          title,
          graph_data: graphData,
          nodes_text: nodeTexts,
          thumbnail,
        });
      } else {
        const created = await mapsApi.create({
          title,
          graph_data: graphData,
          graph_format: "reactflow",
          nodes_text: nodeTexts,
          thumbnail,
        });
        // Sync the ref BEFORE releasing the lock so the next save updates this
        // map instead of creating another one.
        currentMapIdRef.current = created.id;
        setCurrentMapId(created.id);
        if (!shareCode) setShareCode(created.share_code || "");
      }

      lastSaveRef.current = graphData;
      if (onSaved) onSaved(graphData);
      setSaveStatus("saved");

      // Mark as synced in offline cache
      if (currentMapIdRef.current) {
        markSynced(currentMapIdRef.current).catch(() => {});
      }
    } catch {
      setSaveStatus("unsaved");
    } finally {
      savingRef.current = false;
      // Edits landed while we were saving — flush them with the freshest data.
      if (pendingRef.current) {
        pendingRef.current = false;
        saveMapRef.current?.();
      }
    }
  }, [nodes, edges, title, shareCode, generateThumbnail, onSaved]);

  // Keep a ref to the latest saveMap so the in-flight flush above runs the
  // freshest closure (current nodes/edges), not a stale one.
  useEffect(() => { saveMapRef.current = saveMap; }, [saveMap]);

  // Auto-save with 1s debounce
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;

    setSaveStatus("unsaved");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveMap(), 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, title, saveMap]);

  // Persist a visibility change immediately (these are explicit user choices
  // — no need to bundle them into the auto-save debounce).
  const updateVisibility = useCallback(async (next: MapVisibility): Promise<void> => {
    if (!currentMapId) return;
    setVisibility(next);
    try {
      const updated = await mapsApi.update(currentMapId, { visibility: next });
      setVisibility((updated.visibility as MapVisibility) || next);
    } catch {
      // Best-effort UI revert is left to the caller via re-reading the hook.
    }
  }, [currentMapId]);

  return {
    currentMapId,
    saveStatus,
    shareCode,
    collaborators,
    setCollaborators,
    visibility,
    updateVisibility,
    loadMap,
    saveMap,
  };
}
