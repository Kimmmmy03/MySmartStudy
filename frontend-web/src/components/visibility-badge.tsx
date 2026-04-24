"use client";

import { Lock, Link2, Globe2 } from "lucide-react";
import clsx from "clsx";
import type { MapVisibility } from "@/lib/api";

const META: Record<MapVisibility, { label: string; icon: typeof Lock; tone: string }> = {
  private:  { label: "Private",  icon: Lock,    tone: "bg-white/5 text-dark-300 border-white/10" },
  unlisted: { label: "Unlisted", icon: Link2,   tone: "bg-accent-blue/10 text-accent-blue border-accent-blue/20" },
  public:   { label: "Public",   icon: Globe2,  tone: "bg-accent-purple/10 text-accent-purple border-accent-purple/20" },
};

export default function VisibilityBadge({
  visibility,
  size = "md",
  className,
}: {
  visibility: MapVisibility | string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const key: MapVisibility = (visibility === "public" || visibility === "unlisted") ? visibility : "private";
  const { label, icon: Icon, tone } = META[key];
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        pad,
        tone,
        className
      )}
      title={label}
    >
      <Icon className={iconSize} />
      {label}
    </span>
  );
}
