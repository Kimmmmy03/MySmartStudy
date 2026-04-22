"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { type Node, type Edge } from "@xyflow/react";

interface MindmapContextValue {
  /** Whether the mindmap editor is active */
  active: boolean;
  nodes: Node[];
  edges: Edge[];
  title: string;
  selectedNode: Node | null;
  /** Register the mindmap editor (call on mount) */
  register: (data: { nodes: Node[]; edges: Edge[]; title: string; selectedNode: Node | null }) => void;
  /** Unregister (call on unmount) */
  unregister: () => void;
  /** Update live data */
  update: (data: { nodes: Node[]; edges: Edge[]; title: string; selectedNode: Node | null }) => void;
  /** Callback from buddy to add a node with a label and optional parent */
  onAddNode?: (label: string, parentLabel?: string, nodeType?: string) => void;
  setOnAddNode: (fn: ((label: string, parentLabel?: string, nodeType?: string) => void) | undefined) => void;
  /** Highlighted node IDs (for visual feedback from analysis) */
  highlightedNodeIds: string[];
  setHighlightedNodeIds: (ids: string[]) => void;
  /** Map ID for API calls */
  mapId?: string | null;
  setMapId: (id: string | null) => void;
}

const MindmapContext = createContext<MindmapContextValue | null>(null);

export function MindmapProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [title, setTitle] = useState("");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [onAddNode, setOnAddNodeState] = useState<((label: string, parentLabel?: string, nodeType?: string) => void) | undefined>();
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [mapId, setMapId] = useState<string | null>(null);

  const register = useCallback((data: { nodes: Node[]; edges: Edge[]; title: string; selectedNode: Node | null }) => {
    setActive(true);
    setNodes(data.nodes);
    setEdges(data.edges);
    setTitle(data.title);
    setSelectedNode(data.selectedNode);
  }, []);

  const unregister = useCallback(() => {
    setActive(false);
    setNodes([]);
    setEdges([]);
    setTitle("");
    setSelectedNode(null);
    setOnAddNodeState(undefined);
    setMapId(null);
  }, []);

  const update = useCallback((data: { nodes: Node[]; edges: Edge[]; title: string; selectedNode: Node | null }) => {
    setNodes(data.nodes);
    setEdges(data.edges);
    setTitle(data.title);
    setSelectedNode(data.selectedNode);
  }, []);

  const setOnAddNode = useCallback((fn: ((label: string, parentLabel?: string, nodeType?: string) => void) | undefined) => {
    setOnAddNodeState(() => fn);
  }, []);

  const value = useMemo(() => ({
    active, nodes, edges, title, selectedNode,
    register, unregister, update,
    onAddNode, setOnAddNode,
    highlightedNodeIds, setHighlightedNodeIds,
    mapId, setMapId,
  }), [active, nodes, edges, title, selectedNode, register, unregister, update, onAddNode, setOnAddNode, highlightedNodeIds, mapId]);

  return (
    <MindmapContext.Provider value={value}>
      {children}
    </MindmapContext.Provider>
  );
}

export function useMindmapContext() {
  return useContext(MindmapContext);
}
