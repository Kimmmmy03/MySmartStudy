"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { activityApi } from "@/lib/api";

/**
 * Map the current pathname to an analytics feature key.
 * Keep keys aligned with KNOWN_FEATURES in backend/app/routers/activity.py.
 */
function featureFromPath(path: string): string {
  if (!path) return "other";
  if (path.startsWith("/admin")) return "admin";
  if (path.includes("/course/") && path.includes("/discussion")) return "course_detail";
  if (path.includes("/course/")) return "course_detail";
  if (path.includes("/assignments")) return "assignments";
  if (path.includes("/quizzes") || path.includes("/quiz/")) return "quizzes";
  if (path.includes("/my-maps") || path.includes("/create-map") || path.includes("/view-map") || path.includes("/review-maps")) return "maps";
  if (path.includes("/gradebook") || path.includes("/grades")) return "gradebook";
  if (path.includes("/messages")) return "messages";
  if (path.includes("/planner")) return "planner";
  if (path.includes("/calendar")) return "calendar";
  if (path.includes("/achievements")) return "achievements";
  if (path.includes("/profile")) return "profile";
  if (path.includes("/attendance")) return "attendance";
  if (path.includes("/peer-review")) return "peer_review";
  if (path.includes("/groups")) return "groups";
  if (path.includes("/companion")) return "companion";
  if (path.includes("/study-material") || path.includes("/ai-summary") || path.includes("/flashcard")) return "study_materials";
  if (path.includes("/study-plan")) return "study_plan";
  if (path.includes("/plagiarism")) return "plagiarism";
  if (path.includes("/mindmap-buddy")) return "mindmap_buddy";
  if (path.includes("/image-generator") || path.includes("/ai-images")) return "images";
  if (path.endsWith("/dashboard")) return "dashboard";
  if (path.includes("/courses")) return "courses";
  return "other";
}

/**
 * Sends /api/activity/heartbeat every 60s while the tab is visible.
 * Used by the admin usage-analytics page to show time spent per user
 * and which features they use most.
 */
export function useHeartbeat(enabled: boolean) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const send = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      activityApi.heartbeat(featureFromPath(pathRef.current), "web").catch(() => {
        /* silent — analytics is best-effort */
      });
    };

    // Fire one ping immediately so short sessions still register
    send();
    const id = window.setInterval(send, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
