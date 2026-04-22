"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import Homepage from "@/components/homepage/homepage";

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // If already logged in, redirect to dashboard
    if (user && profile) {
      if (profile.role === "lecturer") {
        router.replace("/lecturer/dashboard");
      } else if (profile.role === "admin") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/student/dashboard");
      }
    }
  }, [user, profile, loading, router]);

  // Show homepage for unauthenticated users
  if (loading || (user && profile)) {
    return null;
  }

  return <Homepage />;
}
