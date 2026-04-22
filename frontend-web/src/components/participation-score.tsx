"use client";

import { motion } from "framer-motion";
import { Trophy, MessageCircle, Map, FileText } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";

interface ParticipationData {
  student_id: string;
  display_name: string;
  email: string;
  photo_url?: string | null;
  discussions: number;
  maps: number;
  submissions: number;
  total_score: number;
  breakdown: {
    discussions: number;
    maps: number;
    submissions: number;
  };
}

interface ParticipationScoreProps {
  data: ParticipationData[];
  loading: boolean;
}

export default function ParticipationScore({ data, loading }: ParticipationScoreProps) {
  if (loading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxScore = Math.max(1, ...data.map((d) => d.total_score));

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-accent-amber" />
        <span className="text-sm font-semibold text-white">Participation Scores</span>
      </div>
      {data.length === 0 ? (
        <div className="p-8 text-center text-dark-400">No data yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-3 text-dark-300 font-medium">#</th>
              <th className="text-left p-3 text-dark-300 font-medium">Student</th>
              <th className="text-center p-3 text-dark-300 font-medium"><MessageCircle className="w-3.5 h-3.5 inline" /></th>
              <th className="text-center p-3 text-dark-300 font-medium"><Map className="w-3.5 h-3.5 inline" /></th>
              <th className="text-center p-3 text-dark-300 font-medium"><FileText className="w-3.5 h-3.5 inline" /></th>
              <th className="text-left p-3 text-dark-300 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <motion.tr
                key={d.student_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-white/5"
              >
                <td className="p-3 text-dark-400">{i + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={d.display_name} photoUrl={d.photo_url} size={32} role="student" />
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{d.display_name}</p>
                      <p className="text-xs text-dark-400 truncate">{d.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-center text-dark-200">{d.discussions}</td>
                <td className="p-3 text-center text-dark-200">{d.maps}</td>
                <td className="p-3 text-center text-dark-200">{d.submissions}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-purple rounded-full"
                        style={{ width: `${(d.total_score / maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-accent-purple">{d.total_score}</span>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
