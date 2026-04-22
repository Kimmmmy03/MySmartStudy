"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Map, Trophy, Flame, Zap, Star, Target, Gem, Rocket,
  GraduationCap, BookOpen, Brain, Handshake, Bird, CheckCircle,
  Lightbulb, Palette, Medal, Crown, Sparkles, Compass,
  Users, Clock, ShieldCheck, Award, Heart,
  type LucideIcon,
} from "lucide-react";

// ── Icon name → Lucide component map ──
const ICON_MAP: Record<string, LucideIcon> = {
  map: Map,
  trophy: Trophy,
  flame: Flame,
  zap: Zap,
  star: Star,
  target: Target,
  gem: Gem,
  rocket: Rocket,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  brain: Brain,
  handshake: Handshake,
  bird: Bird,
  "check-circle": CheckCircle,
  lightbulb: Lightbulb,
  palette: Palette,
  medal: Medal,
  crown: Crown,
  sparkles: Sparkles,
  compass: Compass,
  users: Users,
  clock: Clock,
  "shield-check": ShieldCheck,
  award: Award,
  heart: Heart,
};

// ── Default color per icon ──
const ICON_COLORS: Record<string, string> = {
  map: "text-accent-blue",
  trophy: "text-amber-400",
  flame: "text-orange-400",
  zap: "text-yellow-400",
  star: "text-amber-300",
  target: "text-red-400",
  gem: "text-accent-purple",
  rocket: "text-accent-cyan",
  "graduation-cap": "text-indigo-400",
  "book-open": "text-accent-blue",
  brain: "text-accent-pink",
  handshake: "text-accent-emerald",
  bird: "text-sky-400",
  "check-circle": "text-accent-emerald",
  lightbulb: "text-yellow-300",
  palette: "text-accent-pink",
  medal: "text-amber-400",
  crown: "text-yellow-400",
  sparkles: "text-accent-purple",
  compass: "text-teal-400",
  users: "text-accent-blue",
  clock: "text-accent-cyan",
  "shield-check": "text-accent-emerald",
  award: "text-amber-400",
  heart: "text-red-400",
};

// ── Animation variants by icon category ──
const FLICKER_ICONS = new Set(["flame"]);
const PULSE_ICONS = new Set(["trophy", "medal", "star", "crown", "award", "gem"]);
const BOUNCE_ICONS = new Set(["rocket", "zap", "sparkles"]);

function getAnimation(icon: string) {
  if (FLICKER_ICONS.has(icon)) {
    return {
      animate: { opacity: [1, 0.7, 1, 0.85, 1] },
      transition: { duration: 2, repeat: Infinity, repeatDelay: 1 },
    };
  }
  if (PULSE_ICONS.has(icon)) {
    return {
      animate: { scale: [1, 1.08, 1] },
      transition: { duration: 1.5, repeat: Infinity, repeatDelay: 2 },
    };
  }
  if (BOUNCE_ICONS.has(icon)) {
    return {
      animate: { y: [0, -3, 0] },
      transition: { duration: 1.2, repeat: Infinity, repeatDelay: 2.5 },
    };
  }
  return {
    animate: { rotate: [0, 5, -5, 0] },
    transition: { duration: 2, repeat: Infinity, repeatDelay: 3 },
  };
}

// Check if a string is an emoji (contains non-ASCII / emoji chars)
function isEmoji(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(str);
}

// ── Local lottie file manifest ──
// List the icon names that have a .lottie file in public/lottie/badges/
// Update this list when you add or remove .lottie files from that folder.
const LOCAL_LOTTIE_FILES = new Set([
  "bird",
  "brain",
  "flame",
  "handshake",
  "map",
  "star",
  "trophy",
  "zap",
]);

// ── Cache for fetched lottie data ──
// Stores fetched ArrayBuffer data (or null for failed loads) keyed by URL
const lottieDataCache: Record<string, ArrayBuffer | null> = {};

function resolveLottieUrl(icon: string, lottieUrl?: string): string | null {
  if (lottieUrl && lottieUrl.trim()) {
    if (lottieUrl.startsWith("blob:")) return null;
    if (lottieUrl.startsWith("http")) return lottieUrl;
    if (!lottieUrl.startsWith("/")) return null;
    return `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000"}${lottieUrl}`;
  }
  if (!isEmoji(icon) && LOCAL_LOTTIE_FILES.has(icon)) {
    return `/lottie/badges/${icon}.lottie`;
  }
  return null;
}

// ── Lazy-loaded DotLottie component — uses `data` prop (ArrayBuffer) to avoid internal fetch issues ──
import dynamic from "next/dynamic";

const DotLottiePlayer = dynamic(
  () => import("@lottiefiles/dotlottie-react").then(mod => {
    const { DotLottieReact } = mod;
    return function LottieWrapper({ data, size, autoplay = true, dprOverride }: { data: ArrayBuffer; size: number; autoplay?: boolean; dprOverride?: number }) {
      const defaultDpr = typeof window !== "undefined" ? (window.devicePixelRatio || 2) : 3;
      const dpr = dprOverride || defaultDpr;
      return (
        <DotLottieReact
          key={dpr}
          data={data}
          loop={autoplay}
          autoplay={autoplay}
          renderConfig={{ devicePixelRatio: dpr }}
          style={{ width: size, height: size }}
        />
      );
    };
  }),
  { ssr: false }
);

// ── Lottie renderer — fetches file as ArrayBuffer, then renders via data prop ──
function LottieRenderer({ src, size, autoplay, className, dprOverride }: { src: string; size: number; autoplay: boolean; className: string; dprOverride?: number }) {
  const [data, setData] = useState<ArrayBuffer | null | undefined>(() => {
    // Check cache synchronously
    if (src in lottieDataCache) return lottieDataCache[src];
    return undefined; // not yet fetched
  });

  useEffect(() => {
    // Already resolved from cache
    if (data !== undefined) return;

    let cancelled = false;
    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("Got HTML instead of lottie");
        return res.arrayBuffer();
      })
      .then(buf => {
        if (cancelled) return;
        lottieDataCache[src] = buf;
        setData(buf);
      })
      .catch(() => {
        if (cancelled) return;
        lottieDataCache[src] = null;
        setData(null);
      });
    return () => { cancelled = true; };
  }, [src, data]);

  // Not loaded yet or failed — render nothing (Lucide fallback shows through)
  if (!data) return null;

  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <DotLottiePlayer data={data} size={size} autoplay={autoplay} dprOverride={dprOverride} />
    </div>
  );
}

interface BadgeIconProps {
  icon: string;
  size?: number;
  animated?: boolean;
  colored?: boolean;
  className?: string;
  lottieUrl?: string;
  /** Pass an ArrayBuffer directly to preview a .lottie file without uploading */
  lottieData?: ArrayBuffer | null;
  /** Override device pixel ratio for Lottie rendering quality (1-8) */
  lottieDpr?: number;
}

export default function BadgeIcon({ icon, size = 20, animated = false, colored = false, className = "", lottieUrl, lottieData: directData, lottieDpr }: BadgeIconProps) {
  // Stable key suffix to force full remount when DPR or size changes
  const lottieKey = `${lottieDpr ?? "auto"}-${size}`;

  // If direct ArrayBuffer data is provided (e.g. file preview), render it immediately
  if (directData) {
    return (
      <div key={`direct-${lottieKey}`} className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <DotLottiePlayer data={directData} size={size} autoplay={animated} dprOverride={lottieDpr} />
      </div>
    );
  }

  const resolvedLottie = resolveLottieUrl(icon, lottieUrl);

  // Check cache: if lottie data was already fetched and is valid, we know to show it
  // If it was fetched and failed (null), skip lottie entirely
  const cachedData = resolvedLottie ? lottieDataCache[resolvedLottie] : undefined;
  const lottieKnownBroken = resolvedLottie ? (resolvedLottie in lottieDataCache && lottieDataCache[resolvedLottie] === null) : false;

  // Resolve color for Lucide fallback
  const resolvedClass = colored && !className.includes("text-")
    ? `${ICON_COLORS[icon] || "text-accent-blue"} ${className}`
    : className;

  // Render Lucide icon
  const renderLucide = () => {
    if (isEmoji(icon)) {
      const fontSize = size * 0.75;
      if (animated) {
        const anim = getAnimation("star");
        return (
          <motion.span className={resolvedClass} style={{ fontSize, lineHeight: 1, display: "inline-flex" }} {...anim}>
            {icon}
          </motion.span>
        );
      }
      return <span className={resolvedClass} style={{ fontSize, lineHeight: 1 }}>{icon}</span>;
    }

    const IconComponent = ICON_MAP[icon];
    if (!IconComponent) {
      const Fallback = Medal;
      if (animated) {
        const anim = getAnimation("medal");
        return (
          <motion.div className={`inline-flex ${resolvedClass}`} {...anim}>
            <Fallback size={size} />
          </motion.div>
        );
      }
      return <Fallback size={size} className={resolvedClass} />;
    }

    if (animated) {
      const anim = getAnimation(icon);
      return (
        <motion.div className={`inline-flex ${resolvedClass}`} {...anim}>
          <IconComponent size={size} />
        </motion.div>
      );
    }

    return <IconComponent size={size} className={resolvedClass} />;
  };

  // No lottie URL or known broken → Lucide only
  if (!resolvedLottie || lottieKnownBroken) return renderLucide();

  // Lottie data already cached and valid → show lottie only (no fallback overlap)
  if (cachedData) {
    return (
      <LottieRenderer key={`cached-${lottieKey}`} src={resolvedLottie} size={size} autoplay={animated} className={className} dprOverride={lottieDpr} />
    );
  }

  // Not yet fetched — show Lucide while LottieRenderer fetches in the background
  return (
    <LottieWithFallback
      key={`fb-${lottieKey}`}
      src={resolvedLottie}
      size={size}
      autoplay={animated}
      className={className}
      fallback={renderLucide()}
      dprOverride={lottieDpr}
    />
  );
}

// Shows Lucide fallback until Lottie data is fetched, then switches to Lottie (no overlap)
function LottieWithFallback({ src, size, autoplay, className, fallback, dprOverride }: {
  src: string; size: number; autoplay: boolean; className: string; fallback: ReactNode; dprOverride?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (src in lottieDataCache) {
      setReady(lottieDataCache[src] !== null);
      return;
    }

    let cancelled = false;
    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error("Failed");
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("HTML");
        return res.arrayBuffer();
      })
      .then(buf => {
        if (cancelled) return;
        lottieDataCache[src] = buf;
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        lottieDataCache[src] = null;
      });
    return () => { cancelled = true; };
  }, [src]);

  if (!ready) return <>{fallback}</>;

  return (
    <LottieRenderer src={src} size={size} autoplay={autoplay} className={className} dprOverride={dprOverride} />
  );
}

// ── Icon options for picker grids ──
export const LUCIDE_ICON_OPTIONS = [
  { value: "trophy", label: "Trophy" },
  { value: "star", label: "Star" },
  { value: "flame", label: "Flame" },
  { value: "zap", label: "Zap" },
  { value: "target", label: "Target" },
  { value: "gem", label: "Gem" },
  { value: "rocket", label: "Rocket" },
  { value: "graduation-cap", label: "Graduation Cap" },
  { value: "book-open", label: "Book" },
  { value: "brain", label: "Brain" },
  { value: "handshake", label: "Handshake" },
  { value: "map", label: "Map" },
  { value: "bird", label: "Bird" },
  { value: "check-circle", label: "Check" },
  { value: "lightbulb", label: "Lightbulb" },
  { value: "palette", label: "Palette" },
  { value: "medal", label: "Medal" },
  { value: "crown", label: "Crown" },
  { value: "sparkles", label: "Sparkles" },
  { value: "compass", label: "Compass" },
  { value: "users", label: "Users" },
  { value: "award", label: "Award" },
  { value: "shield-check", label: "Shield" },
  { value: "heart", label: "Heart" },
  { value: "clock", label: "Clock" },
];
