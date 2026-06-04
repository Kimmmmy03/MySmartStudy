"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-segment error boundary. Catches render/runtime errors thrown by any
 * page under the app and shows a clean fallback instead of a white screen or a
 * raw stack trace. The error is logged to the console (and would go to an error
 * reporting service in production) but never shown to the user.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for diagnostics; do not surface internals to the user.
    console.error("Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 gap-4 px-6 text-center">
      <h1 className="text-5xl font-bold text-dark-600">Oops</h1>
      <h2 className="text-xl font-semibold text-dark-200">Something went wrong</h2>
      <p className="text-sm text-dark-400 max-w-md">
        An unexpected error occurred while loading this page. You can try again, or head back home.
      </p>
      {error?.digest && (
        <p className="text-xs text-dark-500">Reference: {error.digest}</p>
      )}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={reset}
          className="btn-gradient px-4 py-2 text-white rounded-xl text-sm relative z-10"
        >
          <span className="relative z-10">Try Again</span>
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl text-sm text-dark-200 border border-white/10 hover:bg-white/5 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
