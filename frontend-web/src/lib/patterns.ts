/**
 * Tiling SVG patterns for course cards.
 * Each pattern is a small SVG tile that repeats across the element.
 * Use getPatternStyle() to get CSS properties for a background overlay.
 */

function encodeSvg(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\n\s*/g, ""))}")`;
}

type PatternDef = {
  label: string;
  img?: string;
  svg?: (c: string) => string;
  size: string; // backgroundSize
  opacity?: number;
  blend?: React.CSSProperties['mixBlendMode'];
};

const PATTERNS: Record<string, PatternDef> = {
  songket: {
    label: "Songket Tradisi",
    img: "/patterns/songket_pattern.png",
    size: "200px 200px",
    opacity: 0.4,
    blend: "overlay",
  },
  batik: {
    label: "Batik Moden",
    img: "/patterns/batik_pattern.png",
    size: "250px 250px",
    opacity: 0.4,
    blend: "overlay",
  },
  pucuk_rebung: {
    label: "Pucuk Rebung",
    img: "/patterns/pucuk_rebung_pattern.png",
    size: "200px 200px",
    opacity: 0.4,
    blend: "overlay",
  },
  ipg_education: {
    label: "Ilmu IPG",
    img: "/patterns/ipg_education_pattern.png",
    size: "200px 200px",
    opacity: 0.35,
    blend: "overlay",
  },
};

/**
 * Returns inline CSS properties that tile a pattern across an element.
 * @param patternId  One of: books, computer, science, math, art, music, globe, code
 * @param color      SVG stroke/fill color, e.g. "rgba(59,130,246,0.18)"
 */
export function getPatternStyle(
  patternId: string,
  color: string = "rgba(255,255,255,0.12)",
): React.CSSProperties | null {
  const def = PATTERNS[patternId];
  if (!def) return null;
  return {
    backgroundImage: def.img ? `url("${def.img}")` : (def.svg ? encodeSvg(def.svg(color)) : "none"),
    backgroundRepeat: "repeat",
    backgroundSize: def.size,
    ...(def.img ? {
      opacity: def.opacity || 1,
      mixBlendMode: def.blend || "normal",
    } : {}),
  };
}

/** All available pattern IDs with their labels, for the picker UI. */
export const PATTERN_LIST = [
  { id: "", label: "None" },
  ...Object.entries(PATTERNS).map(([id, { label }]) => ({ id, label })),
];

/**
 * Returns a small inline preview swatch (CSS properties) for use in the pattern picker.
 * Uses a neutral color so it looks good on any background.
 */
export function getPatternPreviewStyle(patternId: string): React.CSSProperties | null {
  return getPatternStyle(patternId, "rgba(140,140,180,0.55)");
}

/**
 * Returns CSS for an inner layer (absolute-positioned) that renders only the
 * pattern image — no element-level opacity, no mixBlendMode. Use this for
 * picker buttons so the pattern stays visible in light mode (mixBlendMode:
 * overlay against a white background washes patterns out to invisible).
 */
export function getPatternLayerStyle(patternId: string): React.CSSProperties | null {
  const def = PATTERNS[patternId];
  if (!def) return null;
  return {
    backgroundImage: def.img ? `url("${def.img}")` : (def.svg ? encodeSvg(def.svg("rgba(255,255,255,0.5)")) : "none"),
    backgroundRepeat: "repeat",
    backgroundSize: def.size,
    opacity: 0.85,
  };
}
