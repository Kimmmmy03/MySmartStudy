"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/**
 * Catch-all redirect for legacy /messages and /messages/{conv_id} URLs.
 *
 * Old DM notifications (created before commit 3749aaf) stored
 * link="/messages/{conv_id}", but the web only has role-prefixed inboxes
 * at /student/messages and /lecturer/messages. Without this redirect,
 * clicking those notifications hits the Next.js not-found page.
 *
 * We don't preserve the conv_id segment because the inbox doesn't deep-link
 * into a specific conversation; landing on the inbox is the right outcome.
 */
export default function MessagesRedirect() {
  const router = useRouter();
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
    router.replace(`/${role}/messages`);
  }, [loading, profile, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-accent-blue/20 border-t-accent-blue animate-spin" />
    </div>
  );
}
