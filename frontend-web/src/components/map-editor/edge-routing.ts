/**
 * Edge routing utility — routes edges around node obstacles using a
 * visibility-graph approach so that arrow lines never sit behind or
 * on top of elements.
 */

import type { Node } from "@xyflow/react";

// ── Types ──

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

// ── Helpers ──

const PADDING = 20; // gap between edge path and node boundary

/** Expand a rect by `pad` on every side */
function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

/** Get corner points of a rect */
function corners(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/** Check if a line segment from A to B intersects rectangle R */
function segmentIntersectsRect(a: Point, b: Point, r: Rect): boolean {
  // Use Cohen-Sutherland-style clipping test
  const xmin = r.x, ymin = r.y, xmax = r.x + r.w, ymax = r.y + r.h;

  let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;

  const code = (x: number, y: number) => {
    let c = 0;
    if (x < xmin) c |= 1;
    else if (x > xmax) c |= 2;
    if (y < ymin) c |= 4;
    else if (y > ymax) c |= 8;
    return c;
  };

  let c0 = code(x0, y0);
  let c1 = code(x1, y1);

  for (let i = 0; i < 20; i++) {
    if ((c0 | c1) === 0) return true;   // both inside
    if ((c0 & c1) !== 0) return false;   // both outside same side

    const cOut = c0 !== 0 ? c0 : c1;
    let x = 0, y = 0;
    if (cOut & 8) {
      x = x0 + (x1 - x0) * (ymax - y0) / (y1 - y0); y = ymax;
    } else if (cOut & 4) {
      x = x0 + (x1 - x0) * (ymin - y0) / (y1 - y0); y = ymin;
    } else if (cOut & 2) {
      y = y0 + (y1 - y0) * (xmax - x0) / (x1 - x0); x = xmax;
    } else if (cOut & 1) {
      y = y0 + (y1 - y0) * (xmin - x0) / (x1 - x0); x = xmin;
    }

    if (cOut === c0) { x0 = x; y0 = y; c0 = code(x0, y0); }
    else { x1 = x; y1 = y; c1 = code(x1, y1); }
  }
  return false;
}

/** Check if segment crosses any obstacle */
function segmentBlocked(a: Point, b: Point, obstacles: Rect[]): boolean {
  for (const r of obstacles) {
    if (segmentIntersectsRect(a, b, r)) return true;
  }
  return false;
}

/** Euclidean distance */
function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Check if a point is inside any obstacle */
function pointInsideAny(p: Point, obstacles: Rect[]): boolean {
  for (const r of obstacles) {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      return true;
    }
  }
  return false;
}

// ── Visibility Graph + Dijkstra ──

function findPathAroundObstacles(
  source: Point,
  target: Point,
  obstacles: Rect[],
): Point[] {
  // If direct path is clear, return it
  if (!segmentBlocked(source, target, obstacles)) {
    return [source, target];
  }

  // Build waypoint candidates from inflated obstacle corners
  const waypoints: Point[] = [source, target];
  for (const obs of obstacles) {
    const inflated = inflate(obs, 4); // small extra clearance beyond the padding already applied
    for (const c of corners(inflated)) {
      if (!pointInsideAny(c, obstacles)) {
        waypoints.push(c);
      }
    }
  }

  const n = waypoints.length;

  // Build adjacency: connect all pairs that have clear line of sight
  const adj: { to: number; cost: number }[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!segmentBlocked(waypoints[i], waypoints[j], obstacles)) {
        const d = dist(waypoints[i], waypoints[j]);
        adj[i].push({ to: j, cost: d });
        adj[j].push({ to: i, cost: d });
      }
    }
  }

  // Dijkstra from 0 (source) to 1 (target)
  const INF = 1e18;
  const costs = new Float64Array(n).fill(INF);
  const prev = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  costs[0] = 0;

  for (let iter = 0; iter < n; iter++) {
    // Find unvisited node with lowest cost
    let u = -1, best = INF;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && costs[i] < best) { best = costs[i]; u = i; }
    }
    if (u === -1 || u === 1) break;
    visited[u] = 1;

    for (const { to: v, cost: w } of adj[u]) {
      const nc = costs[u] + w;
      if (nc < costs[v]) {
        costs[v] = nc;
        prev[v] = u;
      }
    }
  }

  // Reconstruct path
  if (costs[1] >= INF) {
    // No path found, fallback to direct
    return [source, target];
  }

  const path: Point[] = [];
  for (let v = 1; v !== -1; v = prev[v]) {
    path.push(waypoints[v]);
  }
  path.reverse();
  return path;
}

// ── Public API ──

/** Convert a list of React Flow nodes into padded obstacle rectangles,
 *  excluding the source and target nodes of the current edge. */
export function getObstacles(
  allNodes: Node[],
  sourceNodeId: string,
  targetNodeId: string,
): Rect[] {
  const rects: Rect[] = [];
  for (const n of allNodes) {
    if (n.id === sourceNodeId || n.id === targetNodeId) continue;
    if (n.hidden) continue;
    const w = (n.measured?.width ?? n.width ?? 140);
    const h = (n.measured?.height ?? n.height ?? 60);
    rects.push(inflate(
      { x: n.position.x, y: n.position.y, w, h },
      PADDING,
    ));
  }
  return rects;
}

/** Compute an SVG path string that routes from source to target
 *  while avoiding the given obstacles. Returns the path `d` string
 *  and the midpoint for label placement. */
export function computeAvoidancePath(
  sx: number, sy: number,
  tx: number, ty: number,
  obstacles: Rect[],
  smooth = true,
): { path: string; labelX: number; labelY: number } {
  const source: Point = { x: sx, y: sy };
  const target: Point = { x: tx, y: ty };

  const waypoints = findPathAroundObstacles(source, target, obstacles);

  if (waypoints.length <= 2) {
    // Direct line
    return {
      path: `M ${sx} ${sy} L ${tx} ${ty}`,
      labelX: (sx + tx) / 2,
      labelY: (sy + ty) / 2,
    };
  }

  // Build SVG path
  let d = `M ${waypoints[0].x} ${waypoints[0].y}`;

  if (smooth && waypoints.length > 2) {
    // Use quadratic curves through waypoints for a smooth path
    for (let i = 1; i < waypoints.length - 1; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const next = waypoints[i + 1];

      // Smoothing: use the corner as a control point and midpoints as curve endpoints
      const midBefore = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 };
      const midAfter = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 };

      if (i === 1) {
        d += ` L ${midBefore.x} ${midBefore.y}`;
      }
      d += ` Q ${curr.x} ${curr.y} ${midAfter.x} ${midAfter.y}`;
    }
    const last = waypoints[waypoints.length - 1];
    d += ` L ${last.x} ${last.y}`;
  } else {
    for (let i = 1; i < waypoints.length; i++) {
      d += ` L ${waypoints[i].x} ${waypoints[i].y}`;
    }
  }

  // Label at midpoint of the path
  const midIdx = Math.floor(waypoints.length / 2);
  const midPt = waypoints.length % 2 === 0
    ? { x: (waypoints[midIdx - 1].x + waypoints[midIdx].x) / 2, y: (waypoints[midIdx - 1].y + waypoints[midIdx].y) / 2 }
    : waypoints[midIdx];

  return { path: d, labelX: midPt.x, labelY: midPt.y };
}
