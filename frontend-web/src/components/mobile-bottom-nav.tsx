"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Map, Award, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const openAI = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(15); } catch { /* ignore */ }
    }
    // Toggle so a second tap on the same FAB collapses the AI panel
    // (using the same circular reveal animation in reverse).
    window.dispatchEvent(new CustomEvent("toggle-ai-companion"));
  };

  // Floating capsule that visually detaches from the screen edge.
  const barStyle: React.CSSProperties = isLight
    ? {
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(27,42,128,0.08)",
        boxShadow:
          "0 8px 32px rgba(27,42,128,0.12), 0 2px 8px rgba(27,42,128,0.06)",
      }
    : {
        background: "rgba(12,17,35,0.92)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
      };

  const inactiveColor = isLight ? "#6b7280" : "#9ca3af";
  const activeColor = "#ffffff";
  const activePillBg = "linear-gradient(135deg, #2E4DA7 0%, #6366f1 100%)";
  const ringColor = isLight ? "#f4f6fb" : "#0c1123";

  const handleTap = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(8); } catch { /* ignore */ }
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 4px) + 0.5rem)" }}
    >
      <div
        className="flex items-center justify-around mx-auto max-w-md rounded-full px-2.5 py-2"
        style={barStyle}
      >
        {studentNav.map((item) => {

          /* ── Centre FAB (AI Buddy) — perfect circle, lifted ── */
          if (item.center) {
            return (
              <button
                key="ai-buddy"
                onClick={openAI}
                className="flex flex-col items-center -mt-6 active:scale-90 transition-transform"
                aria-label="Open AI Buddy"
              >
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center"
                  style={{
                    boxShadow: `0 6px 20px rgba(99,102,241,0.45), 0 0 0 4px ${ringColor}`,
                  }}
                >
                  <img
                    src="/ai-brain-logo.svg"
                    alt="AI Buddy"
                    className="w-8 h-8"
                    draggable={false}
                  />
                </motion.div>
              </button>
            );
          }

          /* ── Regular nav item ── animated pill that expands when active.
                Inactive: icon only. Active: gradient pill with icon + label
                that morphs across slots via layoutId. */
          const { href, label, icon: Icon } = item;
          const active = pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              onClick={handleTap}
              className="relative flex items-center justify-center min-h-[44px] min-w-[44px] px-2 active:scale-95 transition-transform"
              aria-label={label}
            >
              {active && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-y-1 -inset-x-1 rounded-full"
                  style={{ background: activePillBg, boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 px-2 py-1.5">
                <Icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: active ? activeColor : inactiveColor }}
                />
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, width: 0, marginLeft: -4 }}
                      animate={{ opacity: 1, width: "auto", marginLeft: 0 }}
                      exit={{ opacity: 0, width: 0, marginLeft: -4 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="overflow-hidden whitespace-nowrap text-xs font-semibold"
                      style={{ color: activeColor }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
