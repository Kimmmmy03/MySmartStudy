"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import AnimatedBg from "@/components/ui/animated-bg";
import TransitionLoader from "@/components/ui/transition-loader";
import BadgeCelebration from "@/components/badge-celebration";
import AiCompanionWidget from "@/components/ai-companion/ai-companion-widget";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { MindmapProvider } from "@/contexts/mindmap-context";
import { badgesApi } from "@/lib/api";
import { resolveBadge } from "@/lib/utils";
import { useHeartbeat } from "@/hooks/use-heartbeat";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Badge celebration state
  const [celebrationBadges, setCelebrationBadges] = useState<{ id: string; name: string; icon: string; color: string; description: string }[]>([]);
  const celebratedRef = useRef<Set<string>>(new Set());
  const isCheckingBadgesRef = useRef(false);
  const [badgeCheckReady, setBadgeCheckReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mss-sidebar-collapsed");
    if (stored === "true") setSidebarCollapsed(true);
  }, []);

  useHeartbeat(!!profile);

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("mss-sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/");
      return;
    }

    if (!profile) return;

    // Admin can access all routes
    if (profile.role === "admin") return;

    if (profile.role === "student" && (pathname.startsWith("/lecturer") || pathname.startsWith("/admin"))) {
      router.replace("/student/dashboard");
    } else if (profile.role === "lecturer" && (pathname.startsWith("/student") || pathname.startsWith("/admin"))) {
      router.replace("/lecturer/dashboard");
    }
  }, [user, profile, loading, pathname, router]);

  // Track when profile first becomes available for badge checking
  useEffect(() => {
    if (profile && profile.role === "student" && !badgeCheckReady) {
      setBadgeCheckReady(true);
    }
  }, [profile, badgeCheckReady]);

  // Check for newly earned badges on every page navigation.
  //
  // Server-authoritative: `/badges/check` returns `newly_awarded` — the IDs
  // it *just* added to the user's `badges` array on this call. Anything
  // already in `badges` from a prior award won't appear, so we celebrate
  // only what's genuinely new. We previously diffed against a localStorage
  // "seen" list, which re-fired the celebration on a fresh browser /
  // incognito / cleared-cache login because the seen list was empty even
  // when the badge was already earned.
  useEffect(() => {
    if (!badgeCheckReady) return;
    if (isCheckingBadgesRef.current) return;

    const doCheck = async () => {
      isCheckingBadgesRef.current = true;
      try {
        const { newly_awarded } = await badgesApi.checkMyBadges();
        const justAwarded = (newly_awarded || []).filter(
          (id) => !celebratedRef.current.has(id)
        );
        if (justAwarded.length === 0) return;

        // Refresh the profile so the achievements page + badge counters
        // pick up the new badges without an extra fetch on the next view.
        await refreshProfile();

        justAwarded.forEach((id) => celebratedRef.current.add(id));

        const defs = await badgesApi.definitions();
        const badgeInfos = justAwarded.map((id) => {
          const badge = resolveBadge(id, defs);
          const def = defs.find((d) => d.id === id);
          return {
            id,
            name: badge.name,
            icon: badge.icon,
            color: def?.color || "from-amber-500 to-yellow-400",
            description: badge.description || "Badge earned!",
          };
        });
        setCelebrationBadges(badgeInfos);
      } catch {
        /* silent */
      } finally {
        isCheckingBadgesRef.current = false;
      }
    };

    doCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, badgeCheckReady]);

  if (loading || !user || !profile) {
    return <TransitionLoader />;
  }

  return (
    <MindmapProvider>
      <div className="min-h-screen bg-dark-900 relative dashboard-bg">
        <AnimatedBg />
        <Navbar onMobileMenuToggle={() => setSidebarOpen(true)} />
        <div className="flex">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
          <main className="flex-1 min-h-[calc(100vh-4rem)]">
            <div className="p-4 lg:p-6 pb-6 lg:pb-6 max-lg:pb-24">{children}</div>
          </main>
        </div>
        {profile.role === "student" && <AiCompanionWidget />}
        <MobileBottomNav role={profile.role} />

        {/* Badge celebration overlay — students only */}
        {profile.role === "student" && (
          <BadgeCelebration
            badges={celebrationBadges}
            onClose={() => setCelebrationBadges([])}
          />
        )}
      </div>
    </MindmapProvider>
  );
}
