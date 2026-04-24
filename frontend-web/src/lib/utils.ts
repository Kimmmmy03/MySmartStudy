const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

/** Resolve a relative backend URL (e.g. /uploads/avatars/...) to a full URL. */
export function resolveBackendUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${BACKEND_URL}${url}`;
  return url;
}

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Map legacy badge IDs (from old gamification.py) to proper display names. */
const LEGACY_BADGES: Record<string, { name: string; icon: string; description: string }> = {
  first_map: { name: "Cartographer", icon: "map", description: "Created your first mind map" },
  map_master: { name: "Map Master", icon: "trophy", description: "Created multiple mind maps" },
  "7_day_streak": { name: "Unstoppable", icon: "zap", description: "Maintained a 7-day streak" },
  course_joiner: { name: "Explorer", icon: "compass", description: "Joined your first course" },
  collaborator: { name: "Team Player", icon: "users", description: "Collaborated on mind maps" },
};

/** Resolve a badge ID to display info, checking definitions first then legacy fallback. */
export function resolveBadge(
  badgeId: string,
  defs: { id: string; name: string; icon: string; description: string; lottie_url?: string }[]
): { name: string; icon: string; description: string; lottie_url?: string } {
  const def = defs.find(d => d.id === badgeId);
  if (def) return { name: def.name, icon: def.icon, description: def.description, lottie_url: def.lottie_url };
  const legacy = LEGACY_BADGES[badgeId];
  if (legacy) return legacy;
  return { name: badgeId, icon: "medal", description: "" };
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** Convert a stored semester value ("1", "2", "3") to its display label using
 * Roman numerals (I, II, III). Non-numeric values pass through unchanged so
 * legacy records (e.g. old "Short" entries from before the dropdown was
 * trimmed) still render instead of breaking the UI. */
export function semesterLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const s = String(value).trim();
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || String(n) !== s) return s;
  const romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return romans[n] || s;
}
