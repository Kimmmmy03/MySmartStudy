"use client";

import { useState, useEffect } from "react";
import { statsApi, type StudyActivityDay } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";

export default function StudyActivityChart() {
  const [data, setData] = useState<StudyActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.studyActivity().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 h-[280px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-accent-blue" />
        <h3 className="text-lg font-semibold text-white">Study Activity (30 Days)</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 10 }}
            interval={6}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(18,18,26,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#fff",
            }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
