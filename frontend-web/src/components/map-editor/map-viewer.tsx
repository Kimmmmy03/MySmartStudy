"use client";

import { ReactFlow, Background, Controls, type Node, type Edge, type Viewport } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./custom-nodes";
import { edgeTypes, MarkerDefinitions } from "./custom-edges";

interface MapViewerProps {
  nodes: unknown[];
  edges: unknown[];
  onViewportChange?: (viewport: Viewport) => void;
}

export default function MapViewer({ nodes, edges, onViewportChange }: MapViewerProps) {
  return (
    <ReactFlow
      nodes={nodes as Node[]}
      edges={edges as Edge[]}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      className="bg-dark-800"
      onViewportChange={onViewportChange}
    >
      <MarkerDefinitions />
      <Background gap={20} size={1} color="#2a2a3a" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
