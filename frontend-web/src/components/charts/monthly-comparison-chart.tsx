"use client";

import { useState, useEffect } from "react";
import { statsApi, type MonthlyComparison } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

export default function MonthlyComparisonChart() {
  const [data, setData] = useState<MonthlyComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.monthlyComparison().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="glass-card p-6 h-[280px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = [
    { name: data.previous_month.label, maps: data.previous_month.count },
    { name: data.current_month.label, maps: data.current_month.count },
  ];

  const change = data.previous_month.count > 0
    ? Math.round(((data.current_month.count - data.previous_month.count) / data.previous_month.count) * 100)
    : data.current_month.count > 0 ? 100 : 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-purple" />
          <h3 className="text-lg font-semibold text-white">Monthly Comparison</h3>
        </div>
        {change !== 0 && (
          <span className={`text-sm font-medium ${change > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {change > 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 12 }}
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
          <Bar dataKey="maps" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
