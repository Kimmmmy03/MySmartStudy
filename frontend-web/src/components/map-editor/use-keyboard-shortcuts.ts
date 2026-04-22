import { useEffect, useRef, useCallback } from "react";
import type { Node, Edge, ReactFlowInstance } from "@xyflow/react";

interface UseKeyboardShortcutsOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  reactFlowInstance: ReactFlowInstance | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useKeyboardShortcuts({
  nodes, edges, setNodes, setEdges,
  pushHistory, undo, redo, deleteSelected,
  reactFlowInstance, selectedNodeIds, selectedEdgeIds,
  setSelectedNodeIds,
}: UseKeyboardShortcutsOptions) {
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  const copySelected = useCallback(() => {
    const selNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const nodeIds = new Set(selectedNodeIds);
    const selEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    clipboardRef.current = { nodes: selNodes, edges: selEdges };
  }, [nodes, edges, selectedNodeIds]);

  const pasteClipboard = useCallback(() => {
    const { nodes: cNodes, edges: cEdges } = clipboardRef.current;
    if (cNodes.length === 0) return;
    const idMap = new Map<string, string>();
    const ts = Date.now();
    const newNodes = cNodes.map((n, i) => {
      const newId = `node-${ts}-${i}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 30, y: n.position.y + 30 },
        selected: true,
      };
    });
    const newEdges = cEdges.map((e, i) => ({
      ...e,
      id: `edge-${ts}-${i}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    }));
    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedNodeIds(newNodes.map(n => n.id));
    pushHistory();
  }, [setNodes, setEdges, pushHistory, setSelectedNodeIds]);

  const duplicateSelected = useCallback(() => {
    copySelected();
    pasteClipboard();
  }, [copySelected, pasteClipboard]);

  const selectAll = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
    setSelectedNodeIds(nodes.map(n => n.id));
  }, [setNodes, nodes, setSelectedNodeIds]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (selectedNodeIds.length === 0) return;
    setNodes(nds =>
      nds.map(n =>
        selectedNodeIds.includes(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      )
    );
  }, [selectedNodeIds, setNodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); return; }
      if (ctrl && e.key === "c") { e.preventDefault(); copySelected(); return; }
      if (ctrl && e.key === "v") { e.preventDefault(); pasteClipboard(); return; }
      if (ctrl && e.key === "x") { e.preventDefault(); copySelected(); deleteSelected(); return; }
      if (ctrl && e.key === "a") { e.preventDefault(); selectAll(); return; }
      if (ctrl && e.key === "d") { e.preventDefault(); duplicateSelected(); return; }

      if (ctrl && e.key === "f" && e.shiftKey) {
        e.preventDefault();
        reactFlowInstance?.fitView({ padding: 0.1 });
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step, 0); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(step, 0); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step); return; }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [undo, redo, deleteSelected, copySelected, pasteClipboard, selectAll, duplicateSelected, nudge, reactFlowInstance]);
}
