import type { Node } from "@xyflow/react";

const W = 140;
const H = 60;

function getNodeBounds(n: Node) {
  const w = (n.measured?.width ?? (n.style?.width as number) ?? W);
  const h = (n.measured?.height ?? (n.style?.height as number) ?? H);
  return { x: n.position.x, y: n.position.y, w, h };
}

export function alignNodes(
  nodes: Node[],
  selectedIds: string[],
  direction: "left" | "centerH" | "right" | "top" | "centerV" | "bottom",
): Node[] {
  const sel = nodes.filter(n => selectedIds.includes(n.id));
  if (sel.length < 2) return nodes;
  const bounds = sel.map(getNodeBounds);

  let ref: number;
  switch (direction) {
    case "left": ref = Math.min(...bounds.map(b => b.x)); break;
    case "right": ref = Math.max(...bounds.map(b => b.x + b.w)); break;
    case "centerH": { const xs = bounds.map(b => b.x + b.w / 2); ref = (Math.min(...xs) + Math.max(...xs)) / 2; break; }
    case "top": ref = Math.min(...bounds.map(b => b.y)); break;
    case "bottom": ref = Math.max(...bounds.map(b => b.y + b.h)); break;
    case "centerV": { const ys = bounds.map(b => b.y + b.h / 2); ref = (Math.min(...ys) + Math.max(...ys)) / 2; break; }
  }

  return nodes.map(n => {
    if (!selectedIds.includes(n.id)) return n;
    const b = getNodeBounds(n);
    let pos = { ...n.position };
    switch (direction) {
      case "left": pos.x = ref; break;
      case "right": pos.x = ref - b.w; break;
      case "centerH": pos.x = ref - b.w / 2; break;
      case "top": pos.y = ref; break;
      case "bottom": pos.y = ref - b.h; break;
      case "centerV": pos.y = ref - b.h / 2; break;
    }
    return { ...n, position: pos };
  });
}

export function distributeNodes(
  nodes: Node[],
  selectedIds: string[],
  axis: "horizontal" | "vertical",
): Node[] {
  const sel = nodes.filter(n => selectedIds.includes(n.id));
  if (sel.length < 3) return nodes;

  const sorted = [...sel].sort((a, b) =>
    axis === "horizontal" ? a.position.x - b.position.x : a.position.y - b.position.y
  );
  const bounds = sorted.map(getNodeBounds);

  if (axis === "horizontal") {
    const first = bounds[0].x;
    const last = bounds[bounds.length - 1].x + bounds[bounds.length - 1].w;
    const totalNodeW = bounds.reduce((s, b) => s + b.w, 0);
    const gap = (last - first - totalNodeW) / (bounds.length - 1);
    let cx = first;
    const posMap = new Map<string, number>();
    sorted.forEach((n, i) => {
      posMap.set(n.id, cx);
      cx += bounds[i].w + gap;
    });
    return nodes.map(n => posMap.has(n.id) ? { ...n, position: { ...n.position, x: posMap.get(n.id)! } } : n);
  } else {
    const first = bounds[0].y;
    const last = bounds[bounds.length - 1].y + bounds[bounds.length - 1].h;
    const totalNodeH = bounds.reduce((s, b) => s + b.h, 0);
    const gap = (last - first - totalNodeH) / (bounds.length - 1);
    let cy = first;
    const posMap = new Map<string, number>();
    sorted.forEach((n, i) => {
      posMap.set(n.id, cy);
      cy += bounds[i].h + gap;
    });
    return nodes.map(n => posMap.has(n.id) ? { ...n, position: { ...n.position, y: posMap.get(n.id)! } } : n);
  }
}

export function reorderZIndex(
  nodes: Node[],
  selectedIds: string[],
  direction: "front" | "back" | "forward" | "backward",
): Node[] {
  const getZ = (n: Node) => (n.style?.zIndex as number) || 0;
  const selSet = new Set(selectedIds);

  if (direction === "front") {
    const maxZ = Math.max(...nodes.map(getZ), 0);
    return nodes.map(n => !selSet.has(n.id) ? n : { ...n, style: { ...n.style, zIndex: maxZ + 1 } });
  }
  if (direction === "back") {
    const minZ = Math.min(...nodes.map(getZ), 0);
    return nodes.map(n => !selSet.has(n.id) ? n : { ...n, style: { ...n.style, zIndex: minZ - 1 } });
  }
  // forward / backward: move one step
  const step = direction === "forward" ? 1 : -1;
  return nodes.map(n => !selSet.has(n.id) ? n : { ...n, style: { ...n.style, zIndex: getZ(n) + step } });
}
