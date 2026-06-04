"use client";

import { useEffect } from "react";

/**
 * Global error boundary — catches errors thrown in the ROOT layout itself
 * (which `error.tsx` cannot, since it renders inside the layout). Must render
 * its own <html>/<body>. Last line of defence against a fully blank screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a14", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, color: "#4b5563", margin: 0 }}>Oops</h1>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>The app ran into a problem</h2>
          <p style={{ fontSize: 14, color: "#9ca3af", maxWidth: 420 }}>
            Please refresh the page. If the problem persists, try again later.
          </p>
          {error?.digest && <p style={{ fontSize: 12, color: "#6b7280" }}>Reference: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ marginTop: 8, padding: "8px 16px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 14 }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
