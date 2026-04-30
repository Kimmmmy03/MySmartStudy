"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, User, LogOut, Sparkles, Sun, Moon, Menu } from "lucide-react";
import NotificationDropdown from "@/components/notification-dropdown";
import { useTheme } from "@/contexts/theme-context";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

function resolvePhotoUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return `${BACKEND_URL}${url}`;
  return url;
}

export default function Navbar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resolvedPhoto = resolvePhotoUrl(profile?.photoURL);
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "U")}&background=1B2A80&color=fff`;
  const avatarUrl = resolvedPhoto || fallbackAvatar;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleHamburger = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(8); } catch { /* ignore */ }
    }
    onMobileMenuToggle?.();
  };

  const profilePath = profile?.role === "lecturer" ? "/lecturer/profile" : "/student/profile";

  return (
    <nav
      className="h-14 lg:h-16 glass border-b border-white/5 dark:border-white/5 flex items-center justify-between px-3 lg:px-6 sticky top-0 z-40 navbar-bar"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
        {/* Mobile hamburger — circular pill, larger touch target */}
        {onMobileMenuToggle && (
          <button
            onClick={handleHamburger}
            className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-dark-200" />
          </button>
        )}

        {/* Logo — clean on mobile (no box wrapper), full chip on desktop */}
        <div className="flex items-center gap-2 lg:gap-3 lg:px-3 lg:py-1.5 lg:rounded-xl lg:bg-white/5 lg:border lg:border-white/8 navbar-logo-box">
          <Image
            src="/logo.png"
            alt="MySmartStudy"
            width={28}
            height={28}
            className="lg:w-[34px] lg:h-[34px]"
          />
          <span className="hidden sm:inline text-lg font-bold text-gradient">MySmartStudy</span>
          <span className="sm:hidden text-base font-bold text-gradient">MSS</span>
        </div>
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        {/* Theme toggle — desktop only on mobile it lives in the avatar menu */}
        <button
          onClick={toggleTheme}
          className="hidden lg:flex w-9 h-9 rounded-xl items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors homepage-toggle-btn"
          aria-label="Toggle theme"
        >
          <AnimatePresence mode="wait">
            {theme === "dark" ? (
              <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Sun className="w-5 h-5 text-amber-400" />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <Moon className="w-5 h-5 text-ipg-navy" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <NotificationDropdown kind="messages" />
        <NotificationDropdown kind="general" />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 lg:gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full lg:rounded-xl p-1 lg:px-3 lg:py-2 transition-all duration-200"
          >
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-8 h-8 lg:w-8 lg:h-8 rounded-full ring-2 ring-ipg-navy/30 lg:ring-ipg-navy/20"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== fallbackAvatar) img.src = fallbackAvatar;
              }}
            />
            <span className="text-sm font-medium text-gray-800 dark:text-dark-100 navbar-text hidden sm:inline">
              {profile?.displayName}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-dark-300 navbar-subtitle transition-transform hidden sm:block ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 glass-card py-1 z-50 dropdown-menu rounded-2xl"
              >
                <div className="px-4 py-3 border-b border-white/5 mobile-menu-border">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={avatarUrl}
                      alt=""
                      className="w-9 h-9 rounded-full ring-2 ring-ipg-navy/20"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white dash-heading truncate">{profile?.displayName}</p>
                      <p className="text-xs text-dark-300 dash-muted truncate">{profile?.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-ipg-navy/10 text-ipg-sky">
                    <Sparkles className="w-3 h-3" />
                    {profile?.role}
                  </span>
                </div>

                {/* Mobile-only theme toggle row — desktop has it in the navbar */}
                <button
                  onClick={() => { toggleTheme(); }}
                  className="lg:hidden w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-dark-100 hover:bg-white/5 transition-colors dropdown-item"
                >
                  <span className="flex items-center gap-2.5">
                    {theme === "dark" ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-ipg-navy" />
                    )}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </span>
                </button>

                <button
                  onClick={() => { setDropdownOpen(false); router.push(profilePath); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-100 hover:bg-white/5 transition-colors dropdown-item"
                >
                  <User className="w-4 h-4" /> Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
