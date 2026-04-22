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

  // Check for newly earned badges on every page navigation
  // 1. Calls /badges/check to trigger server-side auto-award
  // 2. Refreshes profile to get latest badges
  // 3. Compares with localStorage to find unseen badges
  // 4. Shows celebration overlay for any new ones
  useEffect(() => {
    if (!badgeCheckReady) return;
    if (isCheckingBadgesRef.current) return;

    const doCheck = async () => {
      isCheckingBadgesRef.current = true;
      try {
        // Trigger server-side badge checks (awards any pending badges)
        await badgesApi.checkMyBadges();
        // Refresh profile to get the latest badge list
        const fresh = await refreshProfile();
        if (!fresh) return;

        const currentBadges: string[] = fresh.badges || [];
        const storageKey = `mss-seen-badges-${fresh.id}`;
        const seenRaw = localStorage.getItem(storageKey);
        const seenBadges: string[] = seenRaw ? JSON.parse(seenRaw) : [];

        // Find badges not yet seen AND not already celebrated this session
        const newBadgeIds = currentBadges.filter(
          (id) => !seenBadges.includes(id) && !celebratedRef.current.has(id)
        );

        if (newBadgeIds.length > 0) {
          // Mark as celebrated so we don't re-show on next navigation
          newBadgeIds.forEach((id) => celebratedRef.current.add(id));

          const defs = await badgesApi.definitions();
          const badgeInfos = newBadgeIds.map((id) => {
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
        }

        // Keep localStorage in sync with current badges
        localStorage.setItem(storageKey, JSON.stringify(currentBadges));
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
