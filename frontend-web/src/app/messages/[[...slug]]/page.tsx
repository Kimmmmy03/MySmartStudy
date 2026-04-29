"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/**
 * Catch-all redirect for legacy /messages and /messages/{conv_id} URLs.
 *
 * Old DM notifications (created before commit 3749aaf) stored
 * link="/messages/{conv_id}", but the web only has role-prefixed inboxes
 * at /student/messages and /lecturer/messages. Without this redirect,
 * clicking those notifications hits the Next.js not-found page.
 *
 * Preserve the conv_id (from the path or query) as ?conv= on the inbox URL
 * so the messages view can auto-open the conversation. New notifications
 * created by the backend already use this query-param form directly.
 */
export default function MessagesRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    // Mirror the backend's per-recipient mapping: only student/lecturer have
    // their own inbox route. Anything else (admin, unset) lands on /student.
    const role = profile.role === "lecturer" ? "lecturer" : "student";

    // Slug catch-all: /messages/{conv_id} → first slug segment is the id.
    const slug = params?.slug;
    const pathConvId = Array.isArray(slug) ? slug[0] : (typeof slug === "string" ? slug : "");
    const queryConvId = searchParams?.get("conv") || "";
    const convId = queryConvId || pathConvId;

    const target = `/${role}/messages${convId ? `?conv=${encodeURIComponent(convId)}` : ""}`;
    router.replace(target);
  }, [loading, profile, params, searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-accent-blue/20 border-t-accent-blue animate-spin" />
    </div>
  );
}
