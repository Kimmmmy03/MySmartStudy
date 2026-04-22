import type { Node, Edge } from "@xyflow/react";

// ── Theme-aware colors ──

interface ThemeColors {
  fill: string;       // node background
  fillAlt: string;    // secondary/lighter background
  fontColor: string;  // text color
}

function colors(isDark: boolean): ThemeColors {
  return isDark
    ? { fill: "#1a1a28", fillAlt: "#16161f", fontColor: "#e0e0e0" }
    : { fill: "#ffffff", fillAlt: "#f3f4f6", fontColor: "#1e1e2e" };
}

// ── Node + Edge builders ──

function makeNode(
  id: string, label: string, x: number, y: number,
  shape: string, fillColor: string, strokeColor: string,
  fontColor: string, extra?: Partial<Node["data"]>,
): Node {
  return {
    id,
    type: shape,
    position: { x, y },
    data: {
      label, fillColor, strokeColor, strokeWidth: 2,
      fontColor, fontSize: 14, shape,
      opacity: 1, rotation: 0, shadow: false,
      fontWeight: "normal", fontStyle: "normal",
      textDecoration: "none", textAlign: "center",
      ...extra,
    },
  };
}

function makeEdge(
  source: string, target: string,
  opts?: { id?: string; sourceHandle?: string; targetHandle?: string; stroke?: string; label?: string },
): Edge {
  return {
    id: opts?.id || `e-${source}-${target}`,
    source,
    target,
    sourceHandle: opts?.sourceHandle || "bottom-source",
    targetHandle: opts?.targetHandle || "top-target",
    type: "bezier",
    style: { stroke: opts?.stroke || "#6366f1", strokeWidth: 2 },
    data: { label: opts?.label || "", strokeDasharray: "", targetArrow: "arrow", sourceArrow: "none" },
  };
}

function makeGroup(
  id: string, label: string, x: number, y: number, w: number, h: number,
  strokeColor: string, fontColor: string, fillAlpha: string,
): Node {
  return {
    id,
    type: "group",
    position: { x, y },
    style: { width: w, height: h },
    data: {
      label, fillColor: fillAlpha, strokeColor,
      strokeWidth: 2, fontColor, fontSize: 14, shape: "group",
      opacity: 1, rotation: 0, shadow: false, fontWeight: "bold", fontStyle: "normal",
      textDecoration: "none", textAlign: "center",
    },
  };
}

// ═══════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════

export function getHierarchicalTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("h1", "Main Topic", 300, 50, "roundedRect", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("h2", "Subtopic 1", 100, 200, "rectangle", c.fill, "#8b5cf6", c.fontColor),
      makeNode("h3", "Subtopic 2", 500, 200, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("h4", "Detail A", 0, 370, "rectangle", c.fillAlt, "#8b5cf6", c.fontColor),
      makeNode("h5", "Detail B", 200, 370, "rectangle", c.fillAlt, "#8b5cf6", c.fontColor),
      makeNode("h6", "Detail C", 400, 370, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("h7", "Detail D", 600, 370, "rectangle", c.fillAlt, "#10b981", c.fontColor),
    ],
    edges: [
      makeEdge("h1", "h2", { stroke: "#8b5cf6" }),
      makeEdge("h1", "h3", { stroke: "#10b981" }),
      makeEdge("h2", "h4", { stroke: "#8b5cf6" }),
      makeEdge("h2", "h5", { stroke: "#8b5cf6" }),
      makeEdge("h3", "h6", { stroke: "#10b981" }),
      makeEdge("h3", "h7", { stroke: "#10b981" }),
    ],
  };
}

export function getSpiderTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("s1", "Central Idea", 280, 230, "circle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("s2", "Branch 1", 280, 20, "ellipse", c.fill, "#10b981", c.fontColor),
      makeNode("s3", "Branch 2", 530, 100, "ellipse", c.fill, "#f59e0b", c.fontColor),
      makeNode("s4", "Branch 3", 530, 350, "ellipse", c.fill, "#ec4899", c.fontColor),
      makeNode("s5", "Branch 4", 280, 430, "ellipse", c.fill, "#8b5cf6", c.fontColor),
      makeNode("s6", "Branch 5", 50, 350, "ellipse", c.fill, "#06b6d4", c.fontColor),
      makeNode("s7", "Branch 6", 50, 100, "ellipse", c.fill, "#ef4444", c.fontColor),
    ],
    edges: [
      makeEdge("s1", "s2", { sourceHandle: "top-source", targetHandle: "bottom-target", stroke: "#10b981" }),
      makeEdge("s1", "s3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("s1", "s4", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("s1", "s5", { sourceHandle: "bottom-source", targetHandle: "top-target", stroke: "#8b5cf6" }),
      makeEdge("s1", "s6", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#06b6d4" }),
      makeEdge("s1", "s7", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#ef4444" }),
    ],
  };
}

export function getBubbleTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("b1", "Main Idea", 270, 200, "circle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("b2", "Idea A", 100, 40, "circle", c.fill, "#10b981", c.fontColor),
      makeNode("b3", "Idea B", 460, 40, "circle", c.fill, "#f59e0b", c.fontColor),
      makeNode("b4", "Idea C", 520, 320, "circle", c.fill, "#ec4899", c.fontColor),
      makeNode("b5", "Idea D", 50, 320, "circle", c.fill, "#8b5cf6", c.fontColor),
      makeNode("b6", "Idea E", 270, 420, "circle", c.fill, "#06b6d4", c.fontColor),
    ],
    edges: [
      makeEdge("b1", "b2", { sourceHandle: "top-source", targetHandle: "bottom-target", stroke: "#10b981" }),
      makeEdge("b1", "b3", { sourceHandle: "top-source", targetHandle: "bottom-target", stroke: "#f59e0b" }),
      makeEdge("b1", "b4", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("b1", "b5", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#8b5cf6" }),
      makeEdge("b1", "b6", { sourceHandle: "bottom-source", targetHandle: "top-target", stroke: "#06b6d4" }),
    ],
  };
}

export function getTreeTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("t1", "Root", 330, 0, "roundedRect", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("t2", "Child 1", 80, 140, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("t3", "Child 2", 330, 140, "rectangle", c.fill, "#f59e0b", c.fontColor),
      makeNode("t4", "Child 3", 580, 140, "rectangle", c.fill, "#ec4899", c.fontColor),
      makeNode("t5", "Leaf 1", 0, 300, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("t6", "Leaf 2", 180, 300, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("t7", "Leaf 3", 350, 300, "rectangle", c.fillAlt, "#f59e0b", c.fontColor),
      makeNode("t8", "Leaf 4", 520, 300, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("t9", "Leaf 5", 700, 300, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
    ],
    edges: [
      makeEdge("t1", "t2", { stroke: "#10b981" }),
      makeEdge("t1", "t3", { stroke: "#f59e0b" }),
      makeEdge("t1", "t4", { stroke: "#ec4899" }),
      makeEdge("t2", "t5", { stroke: "#10b981" }),
      makeEdge("t2", "t6", { stroke: "#10b981" }),
      makeEdge("t3", "t7", { stroke: "#f59e0b" }),
      makeEdge("t4", "t8", { stroke: "#ec4899" }),
      makeEdge("t4", "t9", { stroke: "#ec4899" }),
    ],
  };
}

export function getFlowchartTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("f1", "Start", 280, 0, "roundedRect", c.fill, "#10b981", c.fontColor, { fontWeight: "bold" }),
      makeNode("f2", "Process 1", 280, 130, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("f3", "Decision?", 280, 280, "diamond", c.fill, "#f59e0b", c.fontColor),
      makeNode("f4", "Process 2A", 60, 460, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("f5", "Process 2B", 500, 460, "rectangle", c.fill, "#8b5cf6", c.fontColor),
      makeNode("f6", "End", 280, 620, "roundedRect", c.fill, "#ef4444", c.fontColor, { fontWeight: "bold" }),
    ],
    edges: [
      makeEdge("f1", "f2", { stroke: "#10b981" }),
      makeEdge("f2", "f3", { stroke: "#6366f1" }),
      makeEdge("f3", "f4", { id: "e-f3-yes", sourceHandle: "left-source", targetHandle: "top-target", stroke: "#f59e0b", label: "Yes" }),
      makeEdge("f3", "f5", { id: "e-f3-no", sourceHandle: "right-source", targetHandle: "top-target", stroke: "#f59e0b", label: "No" }),
      makeEdge("f4", "f6", { stroke: "#6366f1" }),
      makeEdge("f5", "f6", { stroke: "#8b5cf6" }),
    ],
  };
}

export function getSwotTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeGroup("sw-g1", "Strengths", 0, 0, 300, 260, "#10b981", "#10b981", "rgba(16,185,129,0.08)"),
      makeGroup("sw-g2", "Weaknesses", 340, 0, 300, 260, "#ef4444", "#ef4444", "rgba(239,68,68,0.08)"),
      makeGroup("sw-g3", "Opportunities", 0, 300, 300, 260, "#3b82f6", "#3b82f6", "rgba(59,130,246,0.08)"),
      makeGroup("sw-g4", "Threats", 340, 300, 300, 260, "#f59e0b", "#f59e0b", "rgba(245,158,11,0.08)"),
      makeNode("sw-s1", "Strong brand", 30, 50, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("sw-s2", "Skilled team", 30, 140, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("sw-w1", "Limited budget", 370, 50, "rectangle", c.fill, "#ef4444", c.fontColor),
      makeNode("sw-w2", "Slow delivery", 370, 140, "rectangle", c.fill, "#ef4444", c.fontColor),
      makeNode("sw-o1", "New market", 30, 350, "rectangle", c.fill, "#3b82f6", c.fontColor),
      makeNode("sw-o2", "Partnerships", 30, 440, "rectangle", c.fill, "#3b82f6", c.fontColor),
      makeNode("sw-t1", "Competition", 370, 350, "rectangle", c.fill, "#f59e0b", c.fontColor),
      makeNode("sw-t2", "Regulation", 370, 440, "rectangle", c.fill, "#f59e0b", c.fontColor),
    ],
    edges: [],
  };
}

export function getKwlTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("kwl-title", "KWL Chart", 280, 0, "roundedRect", c.fill, "#8b5cf6", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeGroup("kwl-g1", "What I Know", 0, 80, 240, 360, "#10b981", "#10b981", "rgba(16,185,129,0.06)"),
      makeGroup("kwl-g2", "Want to Know", 270, 80, 240, 360, "#f59e0b", "#f59e0b", "rgba(245,158,11,0.06)"),
      makeGroup("kwl-g3", "What I Learned", 540, 80, 240, 360, "#6366f1", "#6366f1", "rgba(99,102,241,0.06)"),
      makeNode("kwl-k1", "Prior fact 1", 25, 130, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("kwl-k2", "Prior fact 2", 25, 220, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("kwl-k3", "Prior fact 3", 25, 310, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("kwl-w1", "Question 1", 295, 130, "rectangle", c.fill, "#f59e0b", c.fontColor),
      makeNode("kwl-w2", "Question 2", 295, 220, "rectangle", c.fill, "#f59e0b", c.fontColor),
      makeNode("kwl-w3", "Question 3", 295, 310, "rectangle", c.fill, "#f59e0b", c.fontColor),
      makeNode("kwl-l1", "Insight 1", 565, 130, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("kwl-l2", "Insight 2", 565, 220, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("kwl-l3", "Insight 3", 565, 310, "rectangle", c.fill, "#6366f1", c.fontColor),
    ],
    edges: [
      makeEdge("kwl-k1", "kwl-w1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("kwl-k2", "kwl-w2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("kwl-k3", "kwl-w3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("kwl-w1", "kwl-l1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("kwl-w2", "kwl-l2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("kwl-w3", "kwl-l3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
    ],
  };
}

export function getCauseEffectTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      // Effect (right side)
      makeNode("ce-eff", "Effect", 700, 220, "roundedRect", c.fill, "#ef4444", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      // Spine
      makeNode("ce-spine", "Fishbone", 420, 230, "rectangle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold" }),
      // Cause A (top)
      makeNode("ce-c1", "Cause A", 150, 80, "rectangle", c.fill, "#10b981", c.fontColor, { fontWeight: "bold" }),
      makeNode("ce-c1a", "Sub-cause A1", 0, 0, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("ce-c1b", "Sub-cause A2", 300, 0, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      // Cause B (middle)
      makeNode("ce-c2", "Cause B", 150, 230, "rectangle", c.fill, "#f59e0b", c.fontColor, { fontWeight: "bold" }),
      makeNode("ce-c2a", "Sub-cause B1", 0, 160, "rectangle", c.fillAlt, "#f59e0b", c.fontColor),
      makeNode("ce-c2b", "Sub-cause B2", 300, 160, "rectangle", c.fillAlt, "#f59e0b", c.fontColor),
      // Cause C (bottom)
      makeNode("ce-c3", "Cause C", 150, 380, "rectangle", c.fill, "#8b5cf6", c.fontColor, { fontWeight: "bold" }),
      makeNode("ce-c3a", "Sub-cause C1", 0, 460, "rectangle", c.fillAlt, "#8b5cf6", c.fontColor),
      makeNode("ce-c3b", "Sub-cause C2", 300, 460, "rectangle", c.fillAlt, "#8b5cf6", c.fontColor),
    ],
    edges: [
      makeEdge("ce-spine", "ce-eff", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("ce-c1", "ce-spine", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("ce-c2", "ce-spine", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("ce-c3", "ce-spine", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#8b5cf6" }),
      makeEdge("ce-c1a", "ce-c1", { sourceHandle: "bottom-source", targetHandle: "top-target", stroke: "#10b981" }),
      makeEdge("ce-c1b", "ce-c1", { sourceHandle: "bottom-source", targetHandle: "top-target", stroke: "#10b981" }),
      makeEdge("ce-c2a", "ce-c2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("ce-c2b", "ce-c2", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#f59e0b" }),
      makeEdge("ce-c3a", "ce-c3", { sourceHandle: "top-source", targetHandle: "bottom-target", stroke: "#8b5cf6" }),
      makeEdge("ce-c3b", "ce-c3", { sourceHandle: "top-source", targetHandle: "bottom-target", stroke: "#8b5cf6" }),
    ],
  };
}

export function getTimelineTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  const timeColors = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6"];
  return {
    nodes: [
      makeNode("tl-1", "Event 1\n2024 Q1", 0, 150, "roundedRect", c.fill, timeColors[0], c.fontColor),
      makeNode("tl-2", "Event 2\n2024 Q2", 200, 280, "roundedRect", c.fill, timeColors[1], c.fontColor),
      makeNode("tl-3", "Event 3\n2024 Q3", 400, 150, "roundedRect", c.fill, timeColors[2], c.fontColor),
      makeNode("tl-4", "Event 4\n2024 Q4", 600, 280, "roundedRect", c.fill, timeColors[3], c.fontColor),
      makeNode("tl-5", "Event 5\n2025 Q1", 800, 150, "roundedRect", c.fill, timeColors[4], c.fontColor),
    ],
    edges: [
      makeEdge("tl-1", "tl-2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: timeColors[0] }),
      makeEdge("tl-2", "tl-3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: timeColors[1] }),
      makeEdge("tl-3", "tl-4", { sourceHandle: "right-source", targetHandle: "left-target", stroke: timeColors[2] }),
      makeEdge("tl-4", "tl-5", { sourceHandle: "right-source", targetHandle: "left-target", stroke: timeColors[3] }),
    ],
  };
}

export function getOrgChartTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("oc-ceo", "CEO", 475, 0, "roundedRect", c.fill, "#8b5cf6", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("oc-vp1", "VP Engineering", 25, 150, "rectangle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold" }),
      makeNode("oc-vp2", "VP Marketing", 405, 150, "rectangle", c.fill, "#ec4899", c.fontColor, { fontWeight: "bold" }),
      makeNode("oc-vp3", "VP Operations", 785, 150, "rectangle", c.fill, "#10b981", c.fontColor, { fontWeight: "bold" }),
      makeNode("oc-d1", "Frontend", 0, 320, "rectangle", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("oc-d2", "Backend", 190, 320, "rectangle", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("oc-d3", "Brand", 380, 320, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("oc-d4", "Growth", 570, 320, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("oc-d5", "Logistics", 760, 320, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("oc-d6", "Support", 950, 320, "rectangle", c.fillAlt, "#10b981", c.fontColor),
    ],
    edges: [
      makeEdge("oc-ceo", "oc-vp1", { stroke: "#8b5cf6" }),
      makeEdge("oc-ceo", "oc-vp2", { stroke: "#8b5cf6" }),
      makeEdge("oc-ceo", "oc-vp3", { stroke: "#8b5cf6" }),
      makeEdge("oc-vp1", "oc-d1", { stroke: "#6366f1" }),
      makeEdge("oc-vp1", "oc-d2", { stroke: "#6366f1" }),
      makeEdge("oc-vp2", "oc-d3", { stroke: "#ec4899" }),
      makeEdge("oc-vp2", "oc-d4", { stroke: "#ec4899" }),
      makeEdge("oc-vp3", "oc-d5", { stroke: "#10b981" }),
      makeEdge("oc-vp3", "oc-d6", { stroke: "#10b981" }),
    ],
  };
}

export function getProcessMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("pm-start", "Start", 300, 0, "roundedRect", c.fill, "#10b981", c.fontColor, { fontWeight: "bold" }),
      makeNode("pm-p1", "Process 1", 300, 130, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("pm-d1", "Decision 1?", 300, 280, "diamond", c.fill, "#f59e0b", c.fontColor),
      makeNode("pm-p2", "Process 2", 60, 460, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("pm-p3", "Process 3", 60, 590, "rectangle", c.fill, "#06b6d4", c.fontColor),
      makeNode("pm-p4", "Process 4", 540, 460, "rectangle", c.fill, "#8b5cf6", c.fontColor),
      makeNode("pm-d2", "Decision 2?", 540, 600, "diamond", c.fill, "#f59e0b", c.fontColor),
      makeNode("pm-end", "End", 300, 780, "roundedRect", c.fill, "#ef4444", c.fontColor, { fontWeight: "bold" }),
    ],
    edges: [
      makeEdge("pm-start", "pm-p1", { stroke: "#10b981" }),
      makeEdge("pm-p1", "pm-d1", { stroke: "#6366f1" }),
      makeEdge("pm-d1", "pm-p2", { id: "e-pm-yes", sourceHandle: "left-source", targetHandle: "top-target", stroke: "#f59e0b", label: "Yes" }),
      makeEdge("pm-d1", "pm-p4", { id: "e-pm-no", sourceHandle: "right-source", targetHandle: "top-target", stroke: "#f59e0b", label: "No" }),
      makeEdge("pm-p2", "pm-p3", { stroke: "#6366f1" }),
      makeEdge("pm-p3", "pm-end", { stroke: "#06b6d4" }),
      makeEdge("pm-p4", "pm-d2", { stroke: "#8b5cf6" }),
      makeEdge("pm-d2", "pm-end", { id: "e-pm-d2-end", sourceHandle: "left-source", targetHandle: "right-target", stroke: "#f59e0b", label: "Done" }),
      makeEdge("pm-d2", "pm-p4", { id: "e-pm-d2-loop", sourceHandle: "right-source", targetHandle: "right-target", stroke: "#ef4444", label: "Retry" }),
    ],
  };
}

export function getVennDiagramTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("vn-title", "Venn Diagram", 240, 0, "roundedRect", c.fill, "#8b5cf6", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("vn-a", "Set A", 120, 100, "ellipse", "rgba(99,102,241,0.15)", "#6366f1", c.fontColor),
      makeNode("vn-b", "Set B", 380, 100, "ellipse", "rgba(236,72,153,0.15)", "#ec4899", c.fontColor),
      makeNode("vn-c", "Set C", 250, 260, "ellipse", "rgba(16,185,129,0.15)", "#10b981", c.fontColor),
      makeNode("vn-ab", "A & B", 280, 110, "rectangle", "rgba(245,158,11,0.15)", "#f59e0b", c.fontColor, { fontSize: 11 }),
      makeNode("vn-bc", "B & C", 370, 250, "rectangle", "rgba(245,158,11,0.15)", "#f59e0b", c.fontColor, { fontSize: 11 }),
      makeNode("vn-ac", "A & C", 150, 250, "rectangle", "rgba(245,158,11,0.15)", "#f59e0b", c.fontColor, { fontSize: 11 }),
      makeNode("vn-abc", "All", 270, 200, "circle", "rgba(239,68,68,0.2)", "#ef4444", c.fontColor, { fontSize: 11, fontWeight: "bold" }),
    ],
    edges: [],
  };
}

// ═══════════════════════════════════════════
// IPG i-THINK THINKING MAP TEMPLATES
// ═══════════════════════════════════════════

export function getCircleMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  // Proper Circle Map: rectangular Frame of Reference → large outer circle → small inner
  // circle with main concept → detail nodes arranged in the ring between circles.
  // No connecting edges — spatial placement within the circles IS the relationship.
  //
  // Layout (all positions are top-left corner):
  //   Frame group:  640×620 at (0,0)
  //   Outer circle: 500×500 at (70,60)  → centre (320, 310), radius 250
  //   Inner circle: 150×150 at (245,235) → centre (320, 310)
  //   Details in ring at ~radius 175 from centre
  return {
    nodes: [
      // Frame of Reference (outer rectangle)
      makeGroup("cm-frame", "Frame of Reference", 0, 0, 640, 620, "#8b5cf6", "#8b5cf6", "rgba(139,92,246,0.04)"),
      // Outer circle (large, translucent boundary)
      {
        id: "cm-outer", type: "ellipse", position: { x: 70, y: 60 },
        style: { width: 500, height: 500 },
        data: {
          label: "", fillColor: isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.08)",
          strokeColor: "#6366f1", strokeWidth: 2, fontColor: c.fontColor,
          fontSize: 14, shape: "ellipse", opacity: 1, rotation: 0, shadow: false,
          fontWeight: "normal", fontStyle: "normal", textDecoration: "none",
          textAlign: "center", fontFamily: "inherit", gradientColor: "",
        },
      },
      // Inner circle (main concept)
      {
        id: "cm-inner", type: "circle", position: { x: 245, y: 235 },
        style: { width: 150, height: 150 },
        data: {
          label: "Main Concept", fillColor: c.fill,
          strokeColor: "#6366f1", strokeWidth: 2, fontColor: c.fontColor,
          fontSize: 16, shape: "circle", opacity: 1, rotation: 0, shadow: false,
          fontWeight: "bold", fontStyle: "normal", textDecoration: "none",
          textAlign: "center", fontFamily: "inherit", gradientColor: "",
        },
      },
      // Detail / definition nodes arranged in the ring between inner & outer circles
      makeNode("cm-d1", "Detail 1", 250, 100, "rectangle", c.fillAlt, "#8b5cf6", c.fontColor),
      makeNode("cm-d2", "Detail 2", 420, 165, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("cm-d3", "Detail 3", 420, 385, "rectangle", c.fillAlt, "#f59e0b", c.fontColor),
      makeNode("cm-d4", "Detail 4", 250, 460, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("cm-d5", "Detail 5", 80, 385, "rectangle", c.fillAlt, "#06b6d4", c.fontColor),
      makeNode("cm-d6", "Detail 6", 80, 165, "rectangle", c.fillAlt, "#ef4444", c.fontColor),
    ],
    edges: [],
  };
}

export function getDoubleBubbleMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  // circle=90x90, ellipse=130x80. Need 30px+ gap between every pair.
  // Layout: UniqueA | ConceptA | Shared | ConceptB | UniqueB
  // Unique ellipse right edge → gap → Concept circle left edge → gap → Shared ellipse left → ...
  return {
    nodes: [
      makeNode("db-title", "Double Bubble Map", 310, 0, "roundedRect", c.fill, "#8b5cf6", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      // Two central concepts (circle 90x90)
      makeNode("db-a", "Concept A", 200, 210, "circle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold", fontSize: 15 }),
      makeNode("db-b", "Concept B", 560, 210, "circle", c.fill, "#ec4899", c.fontColor, { fontWeight: "bold", fontSize: 15 }),
      // Shared qualities (middle, ellipse 130x80) — centred between the two concepts
      makeNode("db-s1", "Similar 1", 365, 90, "ellipse", "rgba(16,185,129,0.15)", "#10b981", c.fontColor),
      makeNode("db-s2", "Similar 2", 365, 210, "ellipse", "rgba(16,185,129,0.15)", "#10b981", c.fontColor),
      makeNode("db-s3", "Similar 3", 365, 330, "ellipse", "rgba(16,185,129,0.15)", "#10b981", c.fontColor),
      // Unique to A (left, ellipse 130x80)
      makeNode("db-a1", "Unique A1", 0, 90, "ellipse", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("db-a2", "Unique A2", 0, 210, "ellipse", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("db-a3", "Unique A3", 0, 330, "ellipse", c.fillAlt, "#6366f1", c.fontColor),
      // Unique to B (right, ellipse 130x80)
      makeNode("db-b1", "Unique B1", 720, 90, "ellipse", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("db-b2", "Unique B2", 720, 210, "ellipse", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("db-b3", "Unique B3", 720, 330, "ellipse", c.fillAlt, "#ec4899", c.fontColor),
    ],
    edges: [
      // Shared edges
      makeEdge("db-a", "db-s1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("db-s1", "db-b", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("db-a", "db-s2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("db-s2", "db-b", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("db-a", "db-s3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("db-s3", "db-b", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      // Unique to A
      makeEdge("db-a", "db-a1", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#6366f1" }),
      makeEdge("db-a", "db-a2", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#6366f1" }),
      makeEdge("db-a", "db-a3", { sourceHandle: "left-source", targetHandle: "right-target", stroke: "#6366f1" }),
      // Unique to B
      makeEdge("db-b", "db-b1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("db-b", "db-b2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("db-b", "db-b3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
    ],
  };
}

export function getBraceMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("bm-title", "Brace Map", 300, 0, "roundedRect", c.fill, "#f59e0b", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      // Whole
      makeNode("bm-whole", "Whole Object", 0, 200, "roundedRect", c.fill, "#f59e0b", c.fontColor, { fontWeight: "bold", fontSize: 15 }),
      // Major parts
      makeNode("bm-p1", "Part 1", 250, 80, "rectangle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold" }),
      makeNode("bm-p2", "Part 2", 250, 220, "rectangle", c.fill, "#10b981", c.fontColor, { fontWeight: "bold" }),
      makeNode("bm-p3", "Part 3", 250, 360, "rectangle", c.fill, "#ec4899", c.fontColor, { fontWeight: "bold" }),
      // Sub-parts
      makeNode("bm-s1a", "Sub-part 1A", 480, 50, "rectangle", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("bm-s1b", "Sub-part 1B", 480, 140, "rectangle", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("bm-s2a", "Sub-part 2A", 480, 230, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("bm-s3a", "Sub-part 3A", 480, 320, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
      makeNode("bm-s3b", "Sub-part 3B", 480, 410, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
    ],
    edges: [
      makeEdge("bm-whole", "bm-p1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("bm-whole", "bm-p2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("bm-whole", "bm-p3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("bm-p1", "bm-s1a", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("bm-p1", "bm-s1b", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("bm-p2", "bm-s2a", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("bm-p3", "bm-s3a", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("bm-p3", "bm-s3b", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
    ],
  };
}

export function getBridgeMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("br-title", "Bridge Map", 260, 0, "roundedRect", c.fill, "#06b6d4", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      // Relating factor
      makeNode("br-rel", "Relating Factor", 230, 70, "roundedRect", c.fill, "#06b6d4", c.fontColor, { fontWeight: "bold" }),
      // Pair 1
      makeNode("br-a1", "Item A1", 30, 170, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("br-b1", "Item B1", 30, 280, "rectangle", c.fill, "#8b5cf6", c.fontColor),
      // Pair 2
      makeNode("br-a2", "Item A2", 220, 170, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("br-b2", "Item B2", 220, 280, "rectangle", c.fill, "#059669", c.fontColor),
      // Pair 3
      makeNode("br-a3", "Item A3", 410, 170, "rectangle", c.fill, "#f59e0b", c.fontColor),
      makeNode("br-b3", "Item B3", 410, 280, "rectangle", c.fill, "#d97706", c.fontColor),
      // As labels
      makeNode("br-as1", "as", 140, 220, "ellipse", "rgba(99,102,241,0.1)", "#6366f1", c.fontColor, { fontSize: 12 }),
      makeNode("br-as2", "as", 330, 220, "ellipse", "rgba(16,185,129,0.1)", "#10b981", c.fontColor, { fontSize: 12 }),
    ],
    edges: [
      makeEdge("br-a1", "br-b1", { stroke: "#6366f1" }),
      makeEdge("br-a2", "br-b2", { stroke: "#10b981" }),
      makeEdge("br-a3", "br-b3", { stroke: "#f59e0b" }),
      makeEdge("br-b1", "br-a2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#8b5cf6", label: "as" }),
      makeEdge("br-b2", "br-a3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#059669", label: "as" }),
    ],
  };
}

export function getFlowMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("fm-title", "Flow Map", 280, 0, "roundedRect", c.fill, "#10b981", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeNode("fm-1", "Stage 1", 0, 100, "rectangle", c.fill, "#10b981", c.fontColor, { fontWeight: "bold" }),
      makeNode("fm-2", "Stage 2", 200, 100, "rectangle", c.fill, "#6366f1", c.fontColor, { fontWeight: "bold" }),
      makeNode("fm-3", "Stage 3", 400, 100, "rectangle", c.fill, "#f59e0b", c.fontColor, { fontWeight: "bold" }),
      makeNode("fm-4", "Stage 4", 600, 100, "rectangle", c.fill, "#ec4899", c.fontColor, { fontWeight: "bold" }),
      // Sub-stages
      makeNode("fm-1a", "Detail 1a", 0, 240, "rectangle", c.fillAlt, "#10b981", c.fontColor),
      makeNode("fm-2a", "Detail 2a", 200, 240, "rectangle", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("fm-2b", "Detail 2b", 200, 330, "rectangle", c.fillAlt, "#6366f1", c.fontColor),
      makeNode("fm-3a", "Detail 3a", 400, 240, "rectangle", c.fillAlt, "#f59e0b", c.fontColor),
      makeNode("fm-4a", "Detail 4a", 600, 240, "rectangle", c.fillAlt, "#ec4899", c.fontColor),
    ],
    edges: [
      makeEdge("fm-1", "fm-2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("fm-2", "fm-3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("fm-3", "fm-4", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#f59e0b" }),
      makeEdge("fm-1", "fm-1a", { stroke: "#10b981" }),
      makeEdge("fm-2", "fm-2a", { stroke: "#6366f1" }),
      makeEdge("fm-2", "fm-2b", { stroke: "#6366f1" }),
      makeEdge("fm-3", "fm-3a", { stroke: "#f59e0b" }),
      makeEdge("fm-4", "fm-4a", { stroke: "#ec4899" }),
    ],
  };
}

export function getMultiFlowMapTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("mf-title", "Multi-Flow Map", 240, 0, "roundedRect", c.fill, "#ef4444", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      // Central event
      makeNode("mf-event", "Event", 260, 200, "roundedRect", c.fill, "#ef4444", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      // Causes (left)
      makeNode("mf-c1", "Cause 1", 20, 100, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("mf-c2", "Cause 2", 20, 200, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("mf-c3", "Cause 3", 20, 300, "rectangle", c.fill, "#6366f1", c.fontColor),
      // Effects (right)
      makeNode("mf-e1", "Effect 1", 500, 100, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("mf-e2", "Effect 2", 500, 200, "rectangle", c.fill, "#10b981", c.fontColor),
      makeNode("mf-e3", "Effect 3", 500, 300, "rectangle", c.fill, "#10b981", c.fontColor),
    ],
    edges: [
      makeEdge("mf-c1", "mf-event", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("mf-c2", "mf-event", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("mf-c3", "mf-event", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
      makeEdge("mf-event", "mf-e1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("mf-event", "mf-e2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
      makeEdge("mf-event", "mf-e3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#10b981" }),
    ],
  };
}

export function getCornellNotesTemplate(isDark = true): { nodes: Node[]; edges: Edge[] } {
  const c = colors(isDark);
  return {
    nodes: [
      makeNode("cn-title", "Cornell Notes", 280, 0, "roundedRect", c.fill, "#8b5cf6", c.fontColor, { fontWeight: "bold", fontSize: 16 }),
      makeGroup("cn-cues", "Cues / Questions", 0, 60, 200, 400, "#ec4899", "#ec4899", "rgba(236,72,153,0.06)"),
      makeGroup("cn-notes", "Notes", 230, 60, 460, 400, "#6366f1", "#6366f1", "rgba(99,102,241,0.06)"),
      makeGroup("cn-summary", "Summary", 0, 490, 690, 140, "#10b981", "#10b981", "rgba(16,185,129,0.06)"),
      makeNode("cn-c1", "Key term?", 20, 110, "rectangle", c.fill, "#ec4899", c.fontColor),
      makeNode("cn-c2", "Main idea?", 20, 210, "rectangle", c.fill, "#ec4899", c.fontColor),
      makeNode("cn-c3", "Why important?", 20, 310, "rectangle", c.fill, "#ec4899", c.fontColor),
      makeNode("cn-n1", "Detail note 1", 260, 110, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("cn-n2", "Detail note 2", 260, 210, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("cn-n3", "Detail note 3", 260, 310, "rectangle", c.fill, "#6366f1", c.fontColor),
      makeNode("cn-n4", "Supporting fact", 460, 160, "rectangle", c.fill, "#06b6d4", c.fontColor),
      makeNode("cn-s1", "Write your summary here...", 100, 520, "rectangle", c.fill, "#10b981", c.fontColor),
    ],
    edges: [
      makeEdge("cn-c1", "cn-n1", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("cn-c2", "cn-n2", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("cn-c3", "cn-n3", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#ec4899" }),
      makeEdge("cn-n1", "cn-n4", { sourceHandle: "right-source", targetHandle: "left-target", stroke: "#6366f1" }),
    ],
  };
}
