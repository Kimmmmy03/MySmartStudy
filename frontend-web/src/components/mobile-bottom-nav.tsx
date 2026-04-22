"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Map, Award, User } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/contexts/theme-context";
import clsx from "clsx";

interface RegularItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  center?: false;
}

interface CenterItem {
  center: true;
  label: string;
}

type NavItem = RegularItem | CenterItem;

const studentNav: NavItem[] = [
  { href: "/student/dashboard", label: "Home",    icon: LayoutDashboard },
  { href: "/student/my-maps",   label: "Maps",    icon: Map },
  { center: true,               label: "AI Buddy" },
  { href: "/student/achievements", label: "Badges", icon: Award },
  { href: "/student/profile",   label: "Profile", icon: User },
];

export default function MobileBottomNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const { theme } = useTheme();

  if (role !== "student") return null;

  const isLight = theme === "light";
  const openAI = () => window.dispatchEvent(new CustomEvent("open-ai-companion"));

  const barStyle: React.CSSProperties = isLight
    ? {
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(27,42,128,0.1)",
        boxShadow: "0 -2px 20px rgba(27,42,128,0.08)",
      }
    : {
        background: "rgba(12,17,35,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
      };

  const inactiveColor = isLight ? "#6b7280" : "#6b7280";
  const inactiveLabel = isLight ? "#9ca3af" : "#6b7280";
  const activeColor = "#6366f1";
  const activePillBg = isLight ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.12)";
  const ringColor = isLight ? "#f4f6fb" : "#0c1123";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-3 pb-[env(safe-area-inset-bottom,4px)]">
      <div
        className="flex items-center justify-around mx-auto max-w-md rounded-2xl px-2 py-1.5"
        style={barStyle}
      >
        {studentNav.map((item) => {

          /* ── Centre FAB (AI Buddy) ── */
          if (item.center) {
            return (
              <button
                key="ai-buddy"
                onClick={openAI}
                className="flex flex-col items-center gap-0.5 -mt-4 active:scale-90 transition-transform"
                aria-label="Open AI Buddy"
              >
                <div
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/25"
                  style={{ boxShadow: `0 4px 12px rgba(99,102,241,0.3), 0 0 0 3px ${ringColor}` }}
                >
                  <img
                    src="/ai-brain-logo.svg"
                    alt="AI Buddy"
                    className="w-7 h-7"
                    draggable={false}
                  />
                </div>
                <span className="text-[9px] font-semibold mt-0.5" style={{ color: inactiveLabel }}>{item.label}</span>
              </button>
            );
          }

          /* ── Regular nav item ── */
          const { href, label, icon: Icon } = item;
          const active = pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-[48px] rounded-xl transition-all duration-200"
              aria-label={label}
            >
              {active && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: activePillBg }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                />
              )}
              <Icon
                className={clsx("w-5 h-5 relative z-10", active && "drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]")}
                style={{ color: active ? activeColor : inactiveColor }}
              />
              <span
                className="text-[10px] font-semibold relative z-10"
                style={{ color: active ? activeColor : inactiveLabel }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
