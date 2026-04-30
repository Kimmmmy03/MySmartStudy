"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  LayoutDashboard, Map, BookOpen, Calendar, CalendarDays, Award, User, BarChart3, Activity,
  Users, Eye, BadgeCheck, X, ScrollText, ChevronLeft, ChevronRight, ChevronDown, Newspaper, GraduationCap, MessageCircle, Bell, UserCheck, Compass, BarChart2, Megaphone, LogOut,
} from "lucide-react";
import clsx from "clsx";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  label: string;
  links: NavLink[];
}

const studentGroups: NavGroup[] = [
  {
    id: "main",
    label: "Main",
    links: [
      { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/student/my-maps", label: "My Maps", icon: Map },
      { href: "/student/courses", label: "Courses", icon: BookOpen },
    ],
  },
  {
    id: "community",
    label: "Community",
    links: [
      { href: "/student/feed", label: "Feed", icon: Users },
      { href: "/student/explore", label: "Explore", icon: Compass },
    ],
  },
  {
    id: "academic",
    label: "Academic",
    links: [
      { href: "/student/gradebook", label: "Gradebook", icon: GraduationCap },
      { href: "/student/study-materials", label: "Study Materials", icon: BookOpen },
      { href: "/student/attendance", label: "Attendance", icon: UserCheck },
      { href: "/student/certificates", label: "Certificates", icon: ScrollText },
      { href: "/student/achievements", label: "Achievements", icon: Award },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    links: [
      { href: "/student/messages", label: "Messages", icon: MessageCircle },
      { href: "/student/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    links: [
      { href: "/student/study-guide", label: "Study Guide", icon: Compass },
      { href: "/student/exam-planner", label: "Exam Planner", icon: GraduationCap },
      { href: "/student/planner", label: "Calendar & Planner", icon: CalendarDays },
      { href: "/student/activity", label: "Activity Log", icon: Activity },
    ],
  },
];

const lecturerGroups: NavGroup[] = [
  {
    id: "main",
    label: "Main",
    links: [
      { href: "/lecturer/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/lecturer/class-management", label: "Class Management", icon: Users },
      { href: "/lecturer/review-maps", label: "Review Maps", icon: Eye },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    links: [
      { href: "/lecturer/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/lecturer/manage-badges", label: "Manage Badges", icon: BadgeCheck },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    links: [
      { href: "/lecturer/messages", label: "Messages", icon: MessageCircle },
      { href: "/lecturer/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    links: [
      { href: "/lecturer/learning-plan", label: "Learning Plan", icon: BookOpen },
      { href: "/lecturer/planner", label: "Planner", icon: Calendar },
    ],
  },
];

const adminGroups: NavGroup[] = [
  {
    id: "main",
    label: "Main",
    links: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/users", label: "User Management", icon: Users },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/homepage-editor", label: "Homepage Editor", icon: Newspaper },
      { href: "/admin/manage-badges", label: "Manage Badges", icon: BadgeCheck },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/admin/ai-usage", label: "AI Usage", icon: BarChart2 },
      { href: "/admin/usage-analytics", label: "Usage Analytics", icon: Activity },
    ],
  },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

function resolvePhotoUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return `${BACKEND_URL}${url}`;
  return url;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups = profile?.role === "admin" ? adminGroups : profile?.role === "lecturer" ? lecturerGroups : studentGroups;
  const roleLabel = profile?.role === "admin" ? "Admin" : profile?.role === "lecturer" ? "Lecturer" : "Student";

  const resolvedPhoto = resolvePhotoUrl(profile?.photoURL);
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "U")}&background=1B2A80&color=fff`;
  const avatarUrl = resolvedPhoto || fallbackAvatar;

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={clsx(
          // Desktop: sticky in-flow column. Mobile: fixed drawer with rounded right edge.
          "fixed lg:sticky top-[3.5rem] lg:top-16 left-0 h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)] z-50 transition-all duration-300",
          // Drawer styling — glass + rounded right corners on mobile only.
          "glass border-r border-white/5 lg:rounded-r-none rounded-r-3xl shadow-2xl lg:shadow-none",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-16 w-[88vw] max-w-[20rem]" : "w-[88vw] max-w-[20rem] lg:w-64"
        )}
      >
        {/* ── Mobile profile header ──
            Replaces the old plain "Student Menu" label with a richer card:
            avatar + name + role badge. Tappable to jump to the profile page. */}
        <div className="lg:hidden flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-white/5 mobile-menu-border">
          <Link
            href={profile?.role === "lecturer" ? "/lecturer/profile" : profile?.role === "admin" ? "/admin/dashboard" : "/student/profile"}
            onClick={onClose}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <img
              src={avatarUrl}
              alt=""
              className="w-12 h-12 rounded-full ring-2 ring-ipg-navy/30 flex-shrink-0"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== fallbackAvatar) img.src = fallbackAvatar;
              }}
            />
            <div className="min-w-0 flex-1">
              {/* text-dark-100 instead of text-white so it adapts to light
                  theme via the html.light override in globals.css. */}
              <p className="text-sm font-semibold text-dark-100 truncate">{profile?.displayName || "Welcome"}</p>
              <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-accent-blue/20 to-accent-purple/20 text-accent-blue uppercase tracking-wider">
                {roleLabel}
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all flex-shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-dark-300" />
          </button>
        </div>

        {/* Desktop header with collapse toggle */}
        <div className="hidden lg:flex items-center justify-between px-5 py-4">
          {!collapsed && (
            <span className="text-[11px] font-semibold text-dark-400 sidebar-label uppercase tracking-widest">{roleLabel} Menu</span>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors sidebar-collapse-btn"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-dark-400 sidebar-icon" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-dark-400 sidebar-icon" />
            )}
          </button>
        </div>

        <nav
          className={clsx("space-y-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}
          style={{ maxHeight: "calc(100% - 9rem)" }}
        >
          {groups.map((group) => {
            const isGroupOpen = !collapsedGroups[group.id];
            const hasActiveLink = group.links.some(l => pathname === l.href || pathname.startsWith(l.href + "/"));

            return (
              <div key={group.id}>
                {/* Group header */}
                {!collapsed && groups.length > 1 && (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={clsx(
                      "flex items-center justify-between w-full px-3 py-1.5 mt-2 text-[10px] font-semibold uppercase tracking-widest transition-colors rounded-md",
                      hasActiveLink ? "text-dark-200" : "text-dark-500 hover:text-dark-300"
                    )}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={clsx("w-3 h-3 transition-transform", !isGroupOpen && "-rotate-90")} />
                  </button>
                )}

                {/* Links */}
                {(collapsed || isGroupOpen) && (
                  <div className="space-y-0.5">
                    {group.links.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(href + "/");
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => {
                            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                              try { navigator.vibrate(8); } catch { /* ignore */ }
                            }
                            onClose();
                          }}
                          title={collapsed ? label : undefined}
                          className={clsx(
                            "relative flex items-center gap-3 text-sm font-medium transition-all duration-200 sidebar-link active:scale-[0.98]",
                            // Bigger touch targets + softer pill on mobile.
                            collapsed
                              ? "px-0 py-2.5 justify-center rounded-xl"
                              : "px-3 py-3 lg:py-2 rounded-2xl lg:rounded-xl",
                            // text-dark-100 instead of text-white so the
                            // light theme palette override (globals.css)
                            // turns it dark; sidebar-link-active also
                            // bumps it to navy in light mode.
                            active
                              ? "text-dark-100 bg-gradient-to-r from-accent-blue/25 to-accent-purple/15 lg:from-ipg-navy/15 lg:to-ipg-navy/15 sidebar-link-active"
                              : "text-dark-200 hover:text-dark-100 hover:bg-white/5"
                          )}
                        >
                          {active && (
                            <motion.div
                              layoutId="sidebar-active"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-accent-blue"
                              transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            />
                          )}
                          <Icon className={clsx("w-5 h-5 flex-shrink-0 sidebar-icon", active && "text-accent-blue sidebar-icon-active")} />
                          {!collapsed && <span className="lg:inline">{label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — sign out on mobile, profile chip on desktop */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/5 mobile-menu-border space-y-1">
          {/* Mobile: prominent sign-out button */}
          <button
            onClick={handleSignOut}
            className="lg:hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-red-400 hover:bg-red-500/10 active:scale-[0.98] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>

          {/* Desktop: compact profile chip (mobile profile already shown in header) */}
          <Link
            href={profile?.role === "lecturer" ? "/lecturer/profile" : "/student/profile"}
            className={clsx(
              "hidden lg:flex items-center gap-3 rounded-xl hover:bg-white/5 transition-colors",
              collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
            )}
          >
            <User className="w-5 h-5 flex-shrink-0 text-dark-300 sidebar-icon" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-100 sidebar-user-name truncate">{profile?.displayName}</p>
                <p className="text-[11px] text-dark-400 sidebar-user-email truncate">{profile?.email}</p>
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
