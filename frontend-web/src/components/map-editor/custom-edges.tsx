"use client";

import { useMemo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  useNodes,
  type EdgeProps,
} from "@xyflow/react";
import { getObstacles, computeAvoidancePath } from "./edge-routing";

export interface CustomEdgeData {
  label?: string;
  labelBgColor?: string;
  labelColor?: string;
  strokeDasharray?: string;
  sourceArrow?: "none" | "arrow" | "openArrow" | "diamond" | "circle" | "block" | "thinArrow";
  targetArrow?: "none" | "arrow" | "openArrow" | "diamond" | "circle" | "block" | "thinArrow";
  animated?: boolean;
  arrowColor?: string;
  arrowSize?: number;
}

function edgeLabel(
  x: number,
  y: number,
  data: CustomEdgeData | undefined,
) {
  if (!data?.label) return null;
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-auto"
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          background: data.labelBgColor || "#1a1a28",
          color: data.labelColor || "#e0e0e0",
          fontSize: 11,
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.1)",
          whiteSpace: "nowrap",
        }}
      >
        {data.label}
      </div>
    </EdgeLabelRenderer>
  );
}

// ── Dynamic marker ID generation (works for any hex color) ──

function markerId(type: string, color: string, size?: number) {
  const s = size && size !== 8 ? `-s${size}` : "";
  return `marker-${type}-${color.replace("#", "")}${s}`;
}

function getArrowColor(data: CustomEdgeData | undefined, lineColor: string) {
  return (data?.arrowColor && data.arrowColor !== "") ? data.arrowColor : lineColor;
}

function getMarkerEnd(data: CustomEdgeData | undefined, color: string) {
  const arrow = data?.targetArrow ?? "block";
  if (arrow === "none") return undefined;
  const aColor = getArrowColor(data, color);
  const size = data?.arrowSize;
  return `url(#${markerId(arrow, aColor, size)})`;
}

function getMarkerStart(data: CustomEdgeData | undefined, color: string) {
  const arrow = data?.sourceArrow ?? "none";
  if (arrow === "none") return undefined;
  const aColor = getArrowColor(data, color);
  const size = data?.arrowSize;
  return `url(#${markerId(arrow, aColor, size)})`;
}

function edgeStyle(props: EdgeProps): React.CSSProperties {
  const data = props.data as CustomEdgeData | undefined;
  const base = props.style || {};
  const dash = data?.strokeDasharray || undefined;
  return {
    ...base,
    ...(dash ? { strokeDasharray: dash } : {}),
  };
}

/** Shared hook: compute obstacle-avoiding path for an edge */
function useAvoidancePath(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, source, target } = props;
  const allNodes = useNodes();
  return useMemo(() => {
    const obstacles = getObstacles(allNodes, source, target);
    return computeAvoidancePath(sourceX, sourceY, targetX, targetY, obstacles, true);
  }, [allNodes, source, target, sourceX, sourceY, targetX, targetY]);
}

/** Render helper shared by all edge types */
function AvoidanceEdge({ props, avoidPath }: { props: EdgeProps; avoidPath: { path: string; labelX: number; labelY: number } }) {
  const d = props.data as CustomEdgeData | undefined;
  const color = (props.style?.stroke as string) || "#6366f1";
  return (
    <>
      <path d={avoidPath.path} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
      <BaseEdge
        id={props.id}
        path={avoidPath.path}
        style={edgeStyle(props)}
        markerEnd={getMarkerEnd(d, color)}
        markerStart={getMarkerStart(d, color)}
      />
      {edgeLabel(avoidPath.labelX, avoidPath.labelY, d)}
    </>
  );
}

// ── Straight Edge ──

export function StraightCustomEdge(props: EdgeProps) {
  const avoidPath = useAvoidancePath(props);
  // If no obstacles were hit, use React Flow's native straight path for cleanliness
  const { sourceX, sourceY, targetX, targetY, data, style } = props;
  const d = data as CustomEdgeData | undefined;
  const color = (style?.stroke as string) || "#6366f1";
  const [nativePath, nativeLX, nativeLY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  // Use avoidance path if it deviates from the straight line (has waypoints)
  const isRerouted = avoidPath.path !== `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const path = isRerouted ? avoidPath.path : nativePath;
  const labelX = isRerouted ? avoidPath.labelX : nativeLX;
  const labelY = isRerouted ? avoidPath.labelY : nativeLY;

  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
      <BaseEdge
        id={props.id}
        path={path}
        style={edgeStyle(props)}
        markerEnd={getMarkerEnd(d, color)}
        markerStart={getMarkerStart(d, color)}
      />
      {edgeLabel(labelX, labelY, d)}
    </>
  );
}

// ── Bezier Edge ──

export function BezierCustomEdge(props: EdgeProps) {
  const avoidPath = useAvoidancePath(props);
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style } = props;
  const d = data as CustomEdgeData | undefined;
  const color = (style?.stroke as string) || "#6366f1";
  const [nativePath, nativeLX, nativeLY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const isRerouted = avoidPath.path !== `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const path = isRerouted ? avoidPath.path : nativePath;
  const labelX = isRerouted ? avoidPath.labelX : nativeLX;
  const labelY = isRerouted ? avoidPath.labelY : nativeLY;

  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
      <BaseEdge
        id={props.id}
        path={path}
        style={edgeStyle(props)}
        markerEnd={getMarkerEnd(d, color)}
        markerStart={getMarkerStart(d, color)}
      />
      {edgeLabel(labelX, labelY, d)}
    </>
  );
}

// ── Step Edge (orthogonal with rounded corners) ──

export function StepCustomEdge(props: EdgeProps) {
  const avoidPath = useAvoidancePath(props);
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style } = props;
  const d = data as CustomEdgeData | undefined;
  const color = (style?.stroke as string) || "#6366f1";
  const [nativePath, nativeLX, nativeLY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 });

  const isRerouted = avoidPath.path !== `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const path = isRerouted ? avoidPath.path : nativePath;
  const labelX = isRerouted ? avoidPath.labelX : nativeLX;
  const labelY = isRerouted ? avoidPath.labelY : nativeLY;

  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
      <BaseEdge
        id={props.id}
        path={path}
        style={edgeStyle(props)}
        markerEnd={getMarkerEnd(d, color)}
        markerStart={getMarkerStart(d, color)}
      />
      {edgeLabel(labelX, labelY, d)}
    </>
  );
}

// ── Elbowed Edge (sharp right-angle corners like draw.io) ──

export function ElbowedCustomEdge(props: EdgeProps) {
  const avoidPath = useAvoidancePath(props);
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style } = props;
  const d = data as CustomEdgeData | undefined;
  const color = (style?.stroke as string) || "#6366f1";
  const [nativePath, nativeLX, nativeLY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0 });

  const isRerouted = avoidPath.path !== `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const path = isRerouted ? avoidPath.path : nativePath;
  const labelX = isRerouted ? avoidPath.labelX : nativeLX;
  const labelY = isRerouted ? avoidPath.labelY : nativeLY;

  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
      <BaseEdge
        id={props.id}
        path={path}
        style={edgeStyle(props)}
        markerEnd={getMarkerEnd(d, color)}
        markerStart={getMarkerStart(d, color)}
      />
      {edgeLabel(labelX, labelY, d)}
    </>
  );
}

// ── Marker Definitions (dynamic: generates for any color used by edges) ──

function MarkerSet({ color, size = 8 }: { color: string; size?: number }) {
  const s = size;
  return (
    <g>
      {/* Filled arrow (default) — sleek curved shape */}
      <marker id={markerId("arrow", color, size)} viewBox="0 0 12 12" refX="10" refY="6" markerWidth={s} markerHeight={s} orient="auto-start-reverse">
        <path d="M 1 1 Q 4 6 10 6 Q 4 6 1 11 L 4 6 Z" fill={color} />
      </marker>
      {/* Open arrow (unfilled, curved) */}
      <marker id={markerId("openArrow", color, size)} viewBox="0 0 12 12" refX="10" refY="6" markerWidth={s} markerHeight={s} orient="auto-start-reverse">
        <path d="M 1 1 Q 5 6 11 6 Q 5 6 1 11" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      {/* Thin arrow (narrow, curved) */}
      <marker id={markerId("thinArrow", color, size)} viewBox="0 0 14 14" refX="12" refY="7" markerWidth={s} markerHeight={s} orient="auto-start-reverse">
        <path d="M 1 3 Q 6 7 13 7 Q 6 7 1 11" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
      </marker>
      {/* Block arrow (wide filled, curved) */}
      <marker id={markerId("block", color, size)} viewBox="0 0 12 12" refX="10" refY="6" markerWidth={s + 2} markerHeight={s + 2} orient="auto-start-reverse">
        <path d="M 0 0 Q 5 6 11 6 Q 5 6 0 12 L 3 6 Z" fill={color} />
      </marker>
      {/* Diamond */}
      <marker id={markerId("diamond", color, size)} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={s} markerHeight={s} orient="auto-start-reverse">
        <path d="M 5 0 L 10 5 L 5 10 L 0 5 Z" fill={color} />
      </marker>
      {/* Circle */}
      <marker id={markerId("circle", color, size)} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={s - 2} markerHeight={s - 2} orient="auto-start-reverse">
        <circle cx="5" cy="5" r="4" fill={color} />
      </marker>
    </g>
  );
}

export function MarkerDefinitions({ edges }: { edges?: { style?: { stroke?: string }; data?: unknown }[] }) {
  // Collect all unique color+size combinations from edges + defaults
  const combos = useMemo(() => {
    const defaultColors = [
      "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#ef4444",
      "#06b6d4", "#8b5cf6", "#f97316", "#ffffff", "#000000",
      "#14b8a6", "#a78bfa", "#38bdf8", "#f43f5e", "#d946ef",
      "#0ea5e9", "#f472b6", "#fb923c", "#a3e635", "#eab308",
    ];
    // Default size markers for all default colors
    const result: { color: string; size: number }[] = defaultColors.map(c => ({ color: c, size: 8 }));
    // Add edge-specific colors and custom arrow colors/sizes
    (edges || []).forEach(e => {
      const strokeColor = (e.style?.stroke as string) || "";
      const d = e.data as CustomEdgeData | undefined;
      const arrowColor = d?.arrowColor || "";
      const arrowSize = d?.arrowSize || 8;
      if (strokeColor) result.push({ color: strokeColor, size: 8 });
      if (arrowColor) result.push({ color: arrowColor, size: arrowSize });
      // Also generate for stroke color at custom size
      if (arrowSize !== 8 && strokeColor && !arrowColor) result.push({ color: strokeColor, size: arrowSize });
    });
    // Deduplicate
    const seen = new Set<string>();
    return result.filter(({ color, size }) => {
      const key = `${color}-${size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [edges]);

  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        {combos.map(({ color, size }) => <MarkerSet key={`${color}-${size}`} color={color} size={size} />)}
      </defs>
    </svg>
  );
}

// ── Edge types registry ──

export const edgeTypes = {
  straight: StraightCustomEdge,
  bezier: BezierCustomEdge,
  step: StepCustomEdge,
  elbowed: ElbowedCustomEdge,
  default: BezierCustomEdge,
};
