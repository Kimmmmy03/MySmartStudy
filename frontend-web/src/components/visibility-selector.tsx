"use client";

import { Lock, Link2, Globe2 } from "lucide-react";
import clsx from "clsx";
import type { MapVisibility } from "@/lib/api";

const OPTIONS: { value: MapVisibility; label: string; hint: string; icon: typeof Lock; accent: string }[] = [
  {
    value: "private",
    label: "Private",
    hint: "Only you can see it",
    icon: Lock,
    accent: "ring-dark-400 text-dark-100",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    hint: "Anyone with the share code",
    icon: Link2,
    accent: "ring-accent-blue text-accent-blue",
  },
  {
    value: "public",
    label: "Public",
    hint: "Shows on your followers' feed",
    icon: Globe2,
    accent: "ring-accent-purple text-accent-purple",
  },
];

/**
 * Three-way visibility picker used in the map editor properties panel and the
 * quick toggle on My Maps cards. Renders stacked on narrow containers.
 */
export default function VisibilitySelector({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: MapVisibility;
  onChange: (next: MapVisibility) => void;
  disabled?: boolean;
  /** Hide descriptions — for tight layouts like hover menus. */
  compact?: boolean;
}) {
  return (
    <div className={clsx("grid gap-2", compact ? "grid-cols-3" : "grid-cols-1")}>
      {OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={clsx(
              "text-left rounded-xl border transition-all",
              compact ? "p-2" : "p-3",
              selected
                ? `border-transparent ring-2 ${opt.accent} bg-white/5`
                : "border-white/10 text-dark-200 hover:border-white/25 hover:bg-white/[0.03]",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-2">
              <opt.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{opt.label}</span>
            </div>
            {!compact && (
              <p className="text-xs text-dark-400 mt-1">{opt.hint}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
