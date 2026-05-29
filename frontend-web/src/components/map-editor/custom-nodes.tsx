"use client";

import {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";

// ── Shape SVG path generators (normalized to width x height) ──

const SHAPE_PATHS: Record<string, (w: number, h: number) => string> = {
  diamond: (w, h) =>
    `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
  hexagon: (w, h) => {
    const q = w / 4;
    return `M ${q} 0 L ${w - q} 0 L ${w} ${h / 2} L ${w - q} ${h} L ${q} ${h} L 0 ${h / 2} Z`;
  },
  triangle: (w, h) => `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`,
  parallelogram: (w, h) => {
    const s = w * 0.2;
    return `M ${s} 0 L ${w} 0 L ${w - s} ${h} L 0 ${h} Z`;
  },
  star: (w, h) => {
    const cx = w / 2,
      cy = h / 2;
    const or_ = Math.min(w, h) / 2,
      ir = or_ * 0.38;
    let d = "";
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? or_ : ir;
      const a = (Math.PI / 2) * -1 + (i * Math.PI) / 5;
      d += `${i === 0 ? "M" : "L"} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} `;
    }
    return d + "Z";
  },
  cylinder: (w, h) => {
    const ry = h * 0.12;
    return `M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`;
  },
  cloud: (w, h) => {
    return `M ${w * 0.25} ${h * 0.7}
      C ${w * 0.05} ${h * 0.7}, ${w * 0.0} ${h * 0.45}, ${w * 0.15} ${h * 0.35}
      C ${w * 0.1} ${h * 0.15}, ${w * 0.3} ${h * 0.05}, ${w * 0.45} ${h * 0.2}
      C ${w * 0.55} ${h * 0.05}, ${w * 0.75} ${h * 0.05}, ${w * 0.8} ${h * 0.25}
      C ${w * 1.0} ${h * 0.25}, ${w * 1.0} ${h * 0.55}, ${w * 0.85} ${h * 0.65}
      C ${w * 0.9} ${h * 0.8}, ${w * 0.75} ${h * 0.85}, ${w * 0.6} ${h * 0.75}
      C ${w * 0.5} ${h * 0.9}, ${w * 0.3} ${h * 0.85}, ${w * 0.25} ${h * 0.7} Z`;
  },
  callout: (w, h) => {
    const bh = h * 0.75;
    return `M 0 0 L ${w} 0 L ${w} ${bh} L ${w * 0.35} ${bh} L ${w * 0.15} ${h} L ${w * 0.25} ${bh} L 0 ${bh} Z`;
  },
  arrowShape: (w, h) => {
    const mid = h / 2,
      notch = w * 0.65,
      wing = h * 0.15;
    return `M 0 ${wing} L ${notch} ${wing} L ${notch} 0 L ${w} ${mid} L ${notch} ${h} L ${notch} ${h - wing} L 0 ${h - wing} Z`;
  },
  // ── New shapes ──
  database: (w, h) => {
    const ry = h * 0.15;
    // Body: left side down, bottom ellipse, right side up, top ellipse (visible)
    return [
      `M 0 ${ry}`,
      `A ${w / 2} ${ry} 0 0 0 ${w} ${ry}`,
      `L ${w} ${h - ry}`,
      `A ${w / 2} ${ry} 0 0 1 0 ${h - ry}`,
      `Z`,
      // Top ellipse drawn fully visible
      `M 0 ${ry}`,
      `A ${w / 2} ${ry} 0 0 1 ${w} ${ry}`,
      `A ${w / 2} ${ry} 0 0 1 0 ${ry}`,
    ].join(" ");
  },
  document: (w, h) => {
    const waveH = h * 0.12;
    return [
      `M 0 0`,
      `L ${w} 0`,
      `L ${w} ${h - waveH}`,
      `Q ${w * 0.75} ${h - waveH * 2.5}, ${w * 0.5} ${h - waveH}`,
      `Q ${w * 0.25} ${h + waveH * 0.5}, 0 ${h - waveH}`,
      `Z`,
    ].join(" ");
  },
  pentagon: (w, h) => {
    const cx = w / 2;
    const pts: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / 5;
      pts.push([cx + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)]);
    }
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + " Z";
  },
  octagon: (w, h) => {
    const c = 0.2929; // 1 - cos(45)
    const cx = w * c, cy = h * c;
    return [
      `M ${cx} 0`,
      `L ${w - cx} 0`,
      `L ${w} ${cy}`,
      `L ${w} ${h - cy}`,
      `L ${w - cx} ${h}`,
      `L ${cx} ${h}`,
      `L 0 ${h - cy}`,
      `L 0 ${cy}`,
      `Z`,
    ].join(" ");
  },
  cross: (w, h) => {
    const t = 0.33; // thickness ratio
    const x1 = w * t, x2 = w * (1 - t);
    const y1 = h * t, y2 = h * (1 - t);
    return [
      `M ${x1} 0`, `L ${x2} 0`, `L ${x2} ${y1}`, `L ${w} ${y1}`,
      `L ${w} ${y2}`, `L ${x2} ${y2}`, `L ${x2} ${h}`, `L ${x1} ${h}`,
      `L ${x1} ${y2}`, `L 0 ${y2}`, `L 0 ${y1}`, `L ${x1} ${y1}`, `Z`,
    ].join(" ");
  },
};

// ── Default sizes per shape ──

export const SHAPE_DEFAULTS: Record<
  string,
  { w: number; h: number; stroke: string }
> = {
  rectangle: { w: 140, h: 60, stroke: "#6366f1" },
  roundedRect: { w: 140, h: 60, stroke: "#8b5cf6" },
  circle: { w: 90, h: 90, stroke: "#10b981" },
  ellipse: { w: 130, h: 80, stroke: "#06b6d4" },
  diamond: { w: 110, h: 110, stroke: "#f59e0b" },
  hexagon: { w: 120, h: 100, stroke: "#ec4899" },
  triangle: { w: 110, h: 100, stroke: "#ef4444" },
  parallelogram: { w: 140, h: 60, stroke: "#f97316" },
  star: { w: 100, h: 100, stroke: "#eab308" },
  cylinder: { w: 100, h: 90, stroke: "#14b8a6" },
  cloud: { w: 150, h: 100, stroke: "#a78bfa" },
  callout: { w: 140, h: 90, stroke: "#38bdf8" },
  arrowShape: { w: 130, h: 60, stroke: "#f43f5e" },
  // New shapes
  database: { w: 100, h: 110, stroke: "#0ea5e9" },
  document: { w: 120, h: 80, stroke: "#d946ef" },
  pentagon: { w: 110, h: 110, stroke: "#f472b6" },
  octagon: { w: 110, h: 110, stroke: "#fb923c" },
  cross: { w: 100, h: 100, stroke: "#a3e635" },
  // Existing non-shape nodes
  text: { w: 120, h: 30, stroke: "#6366f1" },
  image: { w: 160, h: 120, stroke: "#6366f1" },
  group: { w: 300, h: 200, stroke: "#6366f1" },
};

// ── Data interface ──

export interface CustomNodeData {
  label: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fontColor: string;
  fontSize: number;
  shape: string;
  opacity?: number;
  rotation?: number;
  shadow?: boolean;
  borderRadius?: number;
  textAlign?: "left" | "center" | "right";
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  fontFamily?: string;
  locked?: boolean;
  imageUrl?: string;
  gradientColor?: string;
  [key: string]: unknown;
}

// ── Handles (show on hover/selected, all handles are both source + target) ──

function AllHandles({ visible }: { visible: boolean }) {
  const base =
    "!w-2.5 !h-2.5 !bg-accent-blue !border-dark-700 !border-2 !transition-opacity !duration-150";
  const cls = visible ? base : `${base} !opacity-0 !pointer-events-none`;
  return (
    <>
      {/* Each position has two overlapping handles: one source, one target */}
      <Handle type="target" position={Position.Top} id="top-target" className={cls} />
      <Handle type="source" position={Position.Top} id="top-source" className={cls} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={cls} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={cls} />
      <Handle type="target" position={Position.Left} id="left-target" className={cls} />
      <Handle type="source" position={Position.Left} id="left-source" className={cls} />
      <Handle type="target" position={Position.Right} id="right-target" className={cls} />
      <Handle type="source" position={Position.Right} id="right-source" className={cls} />
    </>
  );
}

// ── Inline text editor (double-click to edit) ──

function InlineTextEditor({
  nodeId,
  value,
  fontSize,
  fontColor,
  fontWeight,
  fontStyle,
  textDecoration,
  textAlign,
  fontFamily,
  onDone,
}: {
  nodeId: string;
  value: string;
  fontSize: number;
  fontColor: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  fontFamily?: string;
  onDone: () => void;
}) {
  const { updateNodeData } = useReactFlow();
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus and select
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const commit = useCallback(() => {
    updateNodeData(nodeId, { label: text });
    onDone();
  }, [nodeId, text, updateNodeData, onDone]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        onDone();
      }
      // Stop propagation so React Flow doesn't capture keys
      e.stopPropagation();
    },
    [commit, onDone],
  );

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        rows={1}
        className="bg-transparent border-none outline-none resize-none overflow-hidden m-0 w-full"
        style={{
          color: fontColor,
          fontSize: `${fontSize}px`,
          fontWeight: (fontWeight as CSSProperties["fontWeight"]) || "normal",
          fontStyle: (fontStyle as CSSProperties["fontStyle"]) || "normal",
          textDecoration: textDecoration || "none",
          textAlign: (textAlign as CSSProperties["textAlign"]) || "center",
          fontFamily: fontFamily || "inherit",
          lineHeight: 1.3,
          padding: "4px 8px",
          caretColor: fontColor,
        }}
      />
    </div>
  );
}

// ── Gradient defs helper ──

function GradientDef({
  id,
  from,
  to,
}: {
  id: string;
  from: string;
  to: string;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
    </defs>
  );
}

// ── Shape Node (handles all SVG-path shapes + rectangle/circle/ellipse via CSS) ──

export const ShapeNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as unknown as CustomNodeData;
  const shape = d.shape || "rectangle";
  const fill = d.fillColor === "transparent" ? "transparent" : d.fillColor || "#1a1a28";
  const gradientColor = fill === "transparent" ? undefined : d.gradientColor;
  const stroke =
    d.strokeColor || SHAPE_DEFAULTS[shape]?.stroke || "#6366f1";
  const sw = d.strokeWidth ?? 2;
  const opacity = d.opacity ?? 1;
  const rotation = d.rotation ?? 0;
  const shadow = d.shadow ?? false;
  const br =
    d.borderRadius ??
    (shape === "roundedRect" ? 12 : shape === "rectangle" ? 4 : 0);
  const fontSize = d.fontSize || 14;
  const fontColor = d.fontColor || "#e0e0e0";
  const fontFamily = d.fontFamily || "inherit";
  const locked = d.locked ?? false;

  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Observe actual node size (set by NodeResizer via style)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ w: width, h: height });
        }
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const defaults = SHAPE_DEFAULTS[shape] || { w: 120, h: 70 };
  const w = size?.w ?? defaults.w;
  const h = size?.h ?? defaults.h;

  const gradId = `grad-${id}`;
  const fillValue = gradientColor ? `url(#${gradId})` : fill;
  const cssBg = gradientColor
    ? `linear-gradient(135deg, ${fill}, ${gradientColor})`
    : fill;

  const textStyle: CSSProperties = {
    color: fontColor,
    fontSize: `${fontSize}px`,
    fontWeight: d.fontWeight || "normal",
    fontStyle: d.fontStyle || "normal",
    textDecoration: d.textDecoration || "none",
    textAlign: d.textAlign || "center",
    fontFamily,
    lineHeight: 1.3,
  };

  const containerStyle: CSSProperties = {
    opacity,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    filter: shadow
      ? "drop-shadow(0 4px 12px rgba(0,0,0,0.4))"
      : undefined,
    // Fill the React Flow node wrapper (sized via node.style by NodeResizer).
    // The wrapper always has an explicit width/height (set on node creation /
    // backfilled on load), so 100% resolves correctly and the shape resizes.
    width: "100%",
    height: "100%",
  };

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (locked) return;
      e.stopPropagation();
      e.preventDefault();
      setEditing(true);
    },
    [locked],
  );

  const handlesVisible = !!(hovered || selected);

  const pathFn = SHAPE_PATHS[shape];
  const isCSS = ["rectangle", "roundedRect", "circle", "ellipse"].includes(
    shape,
  );

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className="relative flex items-center justify-center"
      data-locked={locked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={60}
        minHeight={40}
        lineClassName="!border-accent-blue"
        handleClassName="!w-2.5 !h-2.5 !bg-accent-blue !border-white"
      />
      <AllHandles visible={handlesVisible} />

      {isCSS ? (
        <div
          className="w-full h-full flex items-center justify-center px-3 py-2 relative"
          style={{
            background: cssBg,
            border: `${sw}px solid ${stroke}`,
            borderRadius:
              shape === "circle"
                ? "50%"
                : shape === "ellipse"
                  ? "50%"
                  : `${br}px`,
            boxShadow: selected ? `0 0 0 2px ${stroke}` : undefined,
          }}
        >
          {editing ? (
            <InlineTextEditor
              nodeId={id}
              value={d.label || ""}
              fontSize={fontSize}
              fontColor={fontColor}
              fontWeight={d.fontWeight}
              fontStyle={d.fontStyle}
              textDecoration={d.textDecoration}
              textAlign={d.textAlign}
              fontFamily={fontFamily}
              onDone={() => setEditing(false)}
            />
          ) : (
            <span className="relative z-10 w-full" style={textStyle}>
              {d.label || ""}
            </span>
          )}
        </div>
      ) : pathFn ? (
        <>
          <svg
            className="absolute inset-0"
            width="100%"
            height="100%"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            {gradientColor && (
              <GradientDef id={gradId} from={fill} to={gradientColor} />
            )}
            <path
              d={pathFn(w, h)}
              fill={fillValue}
              stroke={stroke}
              strokeWidth={sw}
              strokeLinejoin="round"
            />
            {selected && (
              <path
                d={pathFn(w, h)}
                fill="none"
                stroke={stroke}
                strokeWidth={sw + 2}
                opacity={0.4}
                strokeLinejoin="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4 py-2">
            {editing ? (
              <InlineTextEditor
                nodeId={id}
                value={d.label || ""}
                fontSize={fontSize}
                fontColor={fontColor}
                fontWeight={d.fontWeight}
                fontStyle={d.fontStyle}
                textDecoration={d.textDecoration}
                textAlign={d.textAlign}
                fontFamily={fontFamily}
                onDone={() => setEditing(false)}
              />
            ) : (
              <span className="w-full" style={textStyle}>
                {d.label || ""}
              </span>
            )}
          </div>
        </>
      ) : (
        <div
          className="w-full h-full flex items-center justify-center px-3 py-2 relative"
          style={{
            background: cssBg,
            border: `${sw}px solid ${stroke}`,
            borderRadius: `${br}px`,
          }}
        >
          {editing ? (
            <InlineTextEditor
              nodeId={id}
              value={d.label || ""}
              fontSize={fontSize}
              fontColor={fontColor}
              fontWeight={d.fontWeight}
              fontStyle={d.fontStyle}
              textDecoration={d.textDecoration}
              textAlign={d.textAlign}
              fontFamily={fontFamily}
              onDone={() => setEditing(false)}
            />
          ) : (
            <span style={textStyle}>{d.label || ""}</span>
          )}
        </div>
      )}
    </div>
  );
});
ShapeNode.displayName = "ShapeNode";

// ── Text Node ──

export const TextNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as unknown as CustomNodeData;
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const fontFamily = d.fontFamily || "inherit";

  const textStyle: CSSProperties = {
    color: d.fontColor || "#e0e0e0",
    fontSize: `${d.fontSize || 14}px`,
    fontWeight: d.fontWeight || "normal",
    fontStyle: d.fontStyle || "normal",
    textDecoration: d.textDecoration || "none",
    textAlign: d.textAlign || "left",
    fontFamily,
    opacity: d.opacity ?? 1,
  };

  return (
    <div
      className="px-3 py-1 min-w-[60px] relative"
      style={{
        ...textStyle,
        borderBottom: selected
          ? "2px solid #6366f1"
          : "1px solid transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <AllHandles visible={!!(hovered || selected)} />
      {editing ? (
        <InlineTextEditor
          nodeId={id}
          value={d.label || "Text"}
          fontSize={d.fontSize || 14}
          fontColor={d.fontColor || "#e0e0e0"}
          fontWeight={d.fontWeight}
          fontStyle={d.fontStyle}
          textDecoration={d.textDecoration}
          textAlign={d.textAlign}
          fontFamily={fontFamily}
          onDone={() => setEditing(false)}
        />
      ) : (
        d.label || "Text"
      )}
    </div>
  );
});
TextNode.displayName = "TextNode";

// ── Image Node ──

export const ImageNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as unknown as CustomNodeData;
  const stroke = d.strokeColor || "#6366f1";
  const rotation = d.rotation ?? 0;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: "100%", height: "100%", minWidth: 80, minHeight: 60, transform: rotation ? `rotate(${rotation}deg)` : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={80}
        minHeight={60}
        lineClassName="!border-accent-blue"
        handleClassName="!w-2.5 !h-2.5 !bg-accent-blue !border-white"
      />
      <AllHandles visible={!!(hovered || selected)} />
      {/* Image container — fills the node size set by NodeResizer */}
      <div
        className="relative overflow-hidden flex-1 w-full"
        style={{
          border: `${d.strokeWidth ?? 2}px solid ${stroke}`,
          borderRadius: 8,
          opacity: d.opacity ?? 1,
          boxShadow: selected ? `0 0 0 2px ${stroke}` : d.shadow ? `0 4px 12px rgba(0,0,0,0.3)` : undefined,
        }}
      >
        {d.imageUrl ? (
          <img
            src={d.imageUrl}
            alt={d.label || ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-dark-700 flex flex-col items-center justify-center text-dark-400 text-xs relative">
            <svg className="w-8 h-8 mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" /><path d="M21 15l-5-5L5 21" /></svg>
            <span>No Image</span>
            {selected && (
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent-purple to-accent-blue text-white text-[11px] px-4 py-2 rounded-xl shadow-lg shadow-accent-purple/30 whitespace-nowrap animate-bounce z-50">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                  Generate an image via the panel →
                </span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-accent-purple" />
              </div>
            )}
          </div>
        )}
      </div>
      {/* Caption below the image */}
      {d.label && (
        <div
          className="mt-1 px-2 py-0.5 text-xs text-center truncate rounded"
          style={{
            color: d.fontColor || "#e0e0e0",
            fontSize: d.fontSize || 12,
            fontWeight: d.fontWeight || "normal",
            fontStyle: d.fontStyle || "normal",
            fontFamily: d.fontFamily || "inherit",
            maxWidth: "100%",
          }}
        >
          {d.label}
        </div>
      )}
    </div>
  );
});
ImageNode.displayName = "ImageNode";

// ── Group/Container Node ──

export const GroupNode = memo(({ data, selected, id }: NodeProps) => {
  const d = data as unknown as CustomNodeData;
  const stroke = d.strokeColor || "#6366f1";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 150,
        border: `2px dashed ${stroke}`,
        borderRadius: 12,
        backgroundColor: d.fillColor || "rgba(99,102,241,0.05)",
        opacity: d.opacity ?? 1,
        boxShadow: selected ? `0 0 0 2px ${stroke}` : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={200}
        minHeight={150}
        lineClassName="!border-accent-blue"
        handleClassName="!w-2.5 !h-2.5 !bg-accent-blue !border-white"
      />
      <AllHandles visible={!!(hovered || selected)} />
      <div
        className="px-3 py-1.5 text-xs font-semibold"
        style={{ color: stroke }}
      >
        {d.label || "Group"}
      </div>
    </div>
  );
});
GroupNode.displayName = "GroupNode";

// ── Node types registry ──

const shapeKeys = [
  "rectangle",
  "roundedRect",
  "circle",
  "ellipse",
  "diamond",
  "hexagon",
  "triangle",
  "parallelogram",
  "star",
  "cylinder",
  "cloud",
  "callout",
  "arrowShape",
  // New shapes
  "database",
  "document",
  "pentagon",
  "octagon",
  "cross",
];

export const nodeTypes: Record<string, React.ComponentType<NodeProps>> = {
  ...Object.fromEntries(shapeKeys.map((k) => [k, ShapeNode])),
  text: TextNode,
  image: ImageNode,
  group: GroupNode,
};
