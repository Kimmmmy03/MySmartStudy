// Shape labels and thumbnail SVGs, shared by the palette and the
// drag-to-swap prompt. Kept UI-free here (just JSX literals + strings) so
// both consumers can import without circular deps.

import type { ReactNode } from "react";

export const SHAPE_LABELS: Record<string, string> = {
  rectangle: "Rectangle",
  roundedRect: "Rounded",
  circle: "Circle",
  ellipse: "Ellipse",
  diamond: "Diamond",
  hexagon: "Hexagon",
  triangle: "Triangle",
  parallelogram: "Parallel",
  star: "Star",
  cylinder: "Cylinder",
  cloud: "Cloud",
  callout: "Callout",
  arrowShape: "Arrow",
  database: "Database",
  document: "Document",
  pentagon: "Pentagon",
  octagon: "Octagon",
  cross: "Cross",
  text: "Text",
  image: "Image",
  group: "Group",
};

// SVG path/element previews in a 24x24 viewBox. Wrap with an <svg> at the call site.
export const PREVIEWS: Record<string, ReactNode> = {
  rectangle: <rect x="2" y="5" width="20" height="14" rx="2" />,
  roundedRect: <rect x="2" y="5" width="20" height="14" rx="5" />,
  circle: <circle cx="12" cy="12" r="10" />,
  ellipse: <ellipse cx="12" cy="12" rx="11" ry="7" />,
  diamond: <polygon points="12,1 23,12 12,23 1,12" />,
  hexagon: <polygon points="6,1 18,1 24,12 18,23 6,23 0,12" />,
  triangle: <polygon points="12,2 23,22 1,22" />,
  parallelogram: <polygon points="6,3 23,3 18,21 1,21" />,
  star: <polygon points="12,1 15,9 23,9 17,14 19,22 12,18 5,22 7,14 1,9 9,9" />,
  cylinder: (
    <>
      <ellipse cx="12" cy="5" rx="10" ry="4" />
      <rect x="2" y="5" width="20" height="14" />
      <ellipse cx="12" cy="19" rx="10" ry="4" />
      <line x1="2" y1="5" x2="2" y2="19" />
      <line x1="22" y1="5" x2="22" y2="19" />
    </>
  ),
  cloud: <path d="M6 17c-2 0-4-1.5-4-3.5s1.5-3 3-3.5c0-3 2.5-5 5.5-5 2.5 0 4.5 1.5 5 3.5 2.5.5 4.5 2 4.5 4.5s-2 4-4.5 4H6z" />,
  callout: <path d="M2 2h20v14H9l-4 5v-5H2V2z" />,
  arrowShape: <polygon points="0,6 16,6 16,1 24,12 16,23 16,18 0,18" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="10" ry="4" />
      <path d="M2 5v14c0 2.2 4.5 4 10 4s10-1.8 10-4V5" />
      <ellipse cx="12" cy="19" rx="10" ry="4" fill="none" />
    </>
  ),
  document: <path d="M3 2h18v17c-3-2-6 2-9 0s-6 2-9 0V2z" />,
  pentagon: <polygon points="12,1 23,9 19,22 5,22 1,9" />,
  octagon: <polygon points="7,1 17,1 23,7 23,17 17,23 7,23 1,17 1,7" />,
  cross: <polygon points="8,1 16,1 16,8 23,8 23,16 16,16 16,23 8,23 8,16 1,16 1,8 8,8" />,
  text: <text x="4" y="17" fontSize="14" fontWeight="bold">T</text>,
  image: (
    <>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <circle cx="8" cy="9" r="2" />
      <polyline points="22,17 17,11 13,15 10,13 2,21" />
    </>
  ),
  group: <rect x="2" y="2" width="20" height="20" rx="3" strokeDasharray="3,3" />,
};

/** Shapes whose data model is incompatible with a regular shape node. */
export const NON_SWAPPABLE_SHAPES = new Set(["text", "image", "group"]);
