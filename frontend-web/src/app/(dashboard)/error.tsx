"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-white">Something went wrong</h2>
      <p className="text-sm text-dark-300 max-w-md text-center">{error.message}</p>
      <button onClick={reset} className="btn-gradient px-4 py-2 text-white rounded-xl text-sm relative z-10">
        <span className="relative z-10">Try Again</span>
      </button>
    </div>
  );
}
