"use client";

import { useState, useEffect } from "react";
import { Flame } from "lucide-react";
import { analyticsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface HeatmapData {
  data: number[][];
  days: string[];
}

export default function EngagementHeatmap() {
  const { user } = useAuth();
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    analyticsApi.engagementHeatmap()
      .then((d) => { if (d && Array.isArray(d.data) && Array.isArray(d.days)) setHeatmap(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !heatmap) {
    return (
      <div className="glass-card p-6 h-[300px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxVal = Math.max(1, ...heatmap.data.flat());

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-accent-amber" />
        <h3 className="text-lg font-semibold text-white">Engagement Heatmap</h3>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex gap-1 mb-1 ml-12">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="w-5 text-center text-[9px] text-dark-400">
                {i % 4 === 0 ? `${i}` : ""}
              </div>
            ))}
          </div>
          {heatmap.days.map((day, di) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="text-xs text-dark-400 w-10 text-right">{day}</span>
              <div className="flex gap-1">
                {heatmap.data[di]?.map((val, hi) => {
                  const intensity = val / maxVal;
                  return (
                    <div
                      key={hi}
                      className="w-5 h-5 rounded-sm"
                      title={`${day} ${hi}:00 — ${val} activities`}
                      style={{
                        backgroundColor: val === 0
                          ? "rgba(255,255,255,0.03)"
                          : `rgba(139, 92, 246, ${0.15 + intensity * 0.85})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
