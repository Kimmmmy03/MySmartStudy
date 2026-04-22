"use client";

import { useState, useEffect } from "react";
import { analyticsApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Users, TrendingUp, AlertTriangle, UserX } from "lucide-react";
import EngagementHeatmap from "@/components/charts/engagement-heatmap";
import SubmissionTrendsChart from "@/components/charts/submission-trends-chart";
import MapPopularityChart from "@/components/charts/map-popularity-chart";
import { UserAvatar } from "@/components/ui/user-avatar";

interface AtRiskStudent {
  id: string;
  display_name: string;
  email: string;
  photo_url?: string | null;
  last_active: string;
  has_submissions: boolean;
  reason: string;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalCourses, setTotalCourses] = useState(0);
  const [avgSubmission, setAvgSubmission] = useState(0);
  const [assignmentStats, setAssignmentStats] = useState<{ title: string; submitted: number; total: number }[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const data = await analyticsApi.get();
      setTotalStudents(data.total_students);
      setTotalCourses(data.total_courses);
      setAvgSubmission(data.avg_submission_rate);
      setAssignmentStats(data.assignment_stats);
    };
    load();

    analyticsApi.atRiskStudents().then(setAtRisk).catch(() => {});
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Performance Analytics</h1>
        <p className="text-sm text-dark-300">Track student engagement and assignment submissions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-5 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-accent-purple/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-accent-purple" />
          </div>
          <p className="text-3xl font-bold text-white">{totalStudents}</p>
          <p className="text-sm text-dark-300">Total Students Enrolled</p>
        </div>
        <div className="glass-card p-5 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-accent-blue/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-accent-blue" />
          </div>
          <p className="text-3xl font-bold text-white">{avgSubmission}%</p>
          <p className="text-sm text-dark-300">Avg. Submission Rate</p>
          <div className="w-full bg-dark-600 rounded-full h-2 mt-2">
            <div className="bg-gradient-to-r from-accent-blue to-accent-purple h-2 rounded-full transition-all" style={{ width: `${avgSubmission}%` }} />
          </div>
        </div>
        <div className="glass-card p-5 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-white">{assignmentStats.filter(a => a.total > 0 && (a.submitted / a.total) < 0.5).length}</p>
          <p className="text-sm text-dark-300">Low Submission Assignments</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SubmissionTrendsChart />
        <MapPopularityChart />
      </div>

      <div className="mb-8">
        <EngagementHeatmap />
      </div>

      {/* At-Risk Students */}
      {atRisk.length > 0 && (
        <div className="glass-card overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-white">At-Risk Students</span>
            <span className="text-xs text-dark-400 ml-auto">Inactive &gt; 7 days</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-3 text-dark-300 font-medium">Student</th>
                <th className="text-left p-3 text-dark-300 font-medium">Email</th>
                <th className="text-left p-3 text-dark-300 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map((s) => (
                <tr key={s.id} className="border-b border-white/5">
                  <td className="p-3 text-white font-medium">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={s.display_name} photoUrl={s.photo_url} size={28} role="student" />
                      <span>{s.display_name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-dark-300">{s.email}</td>
                  <td className="p-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                      {s.reason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Assignment Submissions</h2>
        {assignmentStats.length === 0 ? (
          <p className="text-dark-400 text-sm">No assignments created yet.</p>
        ) : (
          <div className="space-y-4">
            {assignmentStats.map((a, i) => {
              const pct = a.total > 0 ? Math.round((a.submitted / a.total) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-dark-100">{a.title}</span>
                    <span className="text-xs text-dark-300">{a.submitted}/{a.total} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-dark-600 rounded-full h-3">
                    <div className="bg-gradient-to-r from-accent-purple to-accent-blue h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
