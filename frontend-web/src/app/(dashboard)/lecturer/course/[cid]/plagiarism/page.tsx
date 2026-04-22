"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { assignmentsApi, aiPlagiarismApi, type AssignmentOut, type SubmissionOut, type PlagiarismReport, type PlagiarismNetworkReport } from "@/lib/api";
import { UserAvatar } from "@/components/ui/user-avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Bot, Globe, BookOpen, FileText, Loader2, ChevronDown, ChevronUp, Network, AlertTriangle, Users, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const sourceIcon = (type: string) => {
  switch (type) {
    case "ai_generated": return <Bot className="w-3.5 h-3.5" />;
    case "web": return <Globe className="w-3.5 h-3.5" />;
    case "book": return <BookOpen className="w-3.5 h-3.5" />;
    default: return <FileText className="w-3.5 h-3.5" />;
  }
};

const sourceLabel = (type: string) => {
  switch (type) {
    case "ai_generated": return "AI Generated";
    case "web": return "Web Source";
    case "book": return "Book";
    case "article": return "Article";
    default: return type;
  }
};

function CircularProgress({ percentage, size = 80 }: { percentage: number; size?: number }) {
  const radius = size * 0.45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    percentage > 50 ? "text-red-400" :
    percentage > 20 ? "text-accent-amber" :
    "text-accent-emerald";
  const strokeColor =
    percentage > 50 ? "#f87171" :
    percentage > 20 ? "#f59e0b" :
    "#10b981";

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={strokeColor} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-bold ${color}`}>{percentage}%</span>
      </div>
    </div>
  );
}

export default function PlagiarismPage() {
  const { cid } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"individual" | "network">("individual");
  const [assignments, setAssignments] = useState<AssignmentOut[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Individual tab state
  const [submissions, setSubmissions] = useState<SubmissionOut[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [reports, setReports] = useState<Record<string, PlagiarismReport>>({});
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  // Network tab state
  const [networkReport, setNetworkReport] = useState<PlagiarismNetworkReport | null>(null);
  const [analyzingNetwork, setAnalyzingNetwork] = useState(false);

  useEffect(() => {
    if (!cid) return;
    assignmentsApi.list(cid as string).then(a => {
      setAssignments(a);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cid]);

  useEffect(() => {
    if (!selectedAssignment) { setSubmissions([]); return; }
    setLoadingSubs(true);
    setReports({});
    setNetworkReport(null);
    assignmentsApi.getSubmissions(selectedAssignment).then(s => {
      setSubmissions(s);
      setLoadingSubs(false);
    }).catch(() => setLoadingSubs(false));
  }, [selectedAssignment]);

  const handleAnalyze = async (subId: string) => {
    setAnalyzing(subId);
    try {
      const report = await aiPlagiarismApi.analyze(subId);
      setReports(prev => ({ ...prev, [subId]: report }));
      setExpandedSub(subId);
    } catch { /* empty */ }
    setAnalyzing(null);
  };

  const handleAnalyzeNetwork = async () => {
    if (!selectedAssignment) return;
    setAnalyzingNetwork(true);
    try {
      const report = await aiPlagiarismApi.analyzeAssignment(selectedAssignment);
      setNetworkReport(report);
    } catch { /* empty */ }
    setAnalyzingNetwork(false);
  };

  const tabs = [
    { key: "individual" as const, label: "Individual Analysis", icon: Shield },
    { key: "network" as const, label: "Cross-Submission Similarity", icon: Network },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/lecturer/course/${cid}`)} className="text-dark-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Shield className="w-6 h-6 text-accent-cyan" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plagiarism Detection</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">AI-powered plagiarism analysis and cross-submission similarity</p>
        </div>
      </div>

      {/* Assignment Selector */}
      <div className="glass-card p-4 mb-6">
        <label className="text-xs font-medium text-gray-600 dark:text-dark-300 mb-2 block">Select Assignment</label>
        {loading ? (
          <div className="flex items-center gap-2 text-dark-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading assignments...
          </div>
        ) : (
          <select
            value={selectedAssignment}
            onChange={e => setSelectedAssignment(e.target.value)}
            className="glass-input w-full py-2.5 bg-dark-800 appearance-none cursor-pointer"
          >
            <option value="" className="bg-dark-800">Choose an assignment...</option>
            {assignments.map(a => (
              <option key={a.id} value={a.id} className="bg-dark-800">{a.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      {selectedAssignment && (
        <>
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.key
                    ? "bg-accent-cyan/15 text-accent-cyan"
                    : "text-dark-400 hover:text-dark-200 hover:bg-white/5"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Individual Analysis Tab */}
          {activeTab === "individual" && (
            <div className="space-y-3">
              {loadingSubs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-accent-cyan animate-spin" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12 glass-card">
                  <Shield className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                  <p className="text-sm text-dark-400">No submissions for this assignment</p>
                </div>
              ) : (
                <>
                  <div className="glass-card overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-5 py-3 border-b border-white/5 text-xs font-medium text-dark-400 uppercase tracking-wide">
                      <span>Student</span>
                      <span>Submitted</span>
                      <span className="text-center">AI %</span>
                      <span className="text-center">Grade</span>
                      <span className="text-center">Actions</span>
                    </div>

                    {/* Table Rows */}
                    {submissions.map(sub => {
                      const report = reports[sub.id];
                      const isExpanded = expandedSub === sub.id;
                      const isAnalyzing = analyzing === sub.id;

                      return (
                        <div key={sub.id} className="border-b border-white/5 last:border-0">
                          <div className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-5 py-3 items-center">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar name={sub.student_name} photoUrl={sub.student_photo_url} size={28} role="student" />
                              <span className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{sub.student_name}</span>
                            </div>
                            <span className="text-xs text-dark-400">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                            <div className="flex justify-center">
                              {report ? (
                                <CircularProgress percentage={report.plagiarism_percentage} size={44} />
                              ) : (
                                <span className="text-xs text-dark-500">—</span>
                              )}
                            </div>
                            <div className="flex justify-center">
                              {sub.grade !== null ? (
                                <span className={clsx("text-sm font-semibold",
                                  sub.grade >= 80 ? "text-accent-emerald" : sub.grade >= 50 ? "text-accent-amber" : "text-red-400"
                                )}>{sub.grade}%</span>
                              ) : (
                                <span className="text-xs text-dark-500">Ungraded</span>
                              )}
                            </div>
                            <div className="flex justify-center gap-2">
                              {!report ? (
                                <button
                                  onClick={() => handleAnalyze(sub.id)}
                                  disabled={isAnalyzing}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-colors border border-accent-cyan/20 disabled:opacity-40"
                                >
                                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                                  {isAnalyzing ? "..." : "Analyze"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-dark-300 hover:bg-white/10 transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  {isExpanded ? "Hide" : "Details"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Report */}
                          <AnimatePresence>
                            {isExpanded && report && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-4 space-y-3">
                                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                                    {/* Sources */}
                                    {report.sources.length > 0 && (
                                      <div className="space-y-2">
                                        <p className="text-xs font-medium text-dark-300 uppercase tracking-wide">Sources Detected</p>
                                        {report.sources.map((source, i) => (
                                          <div key={i} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-dark-300">{sourceIcon(source.type)}</span>
                                              <span className="text-xs font-medium text-white">{sourceLabel(source.type)}</span>
                                              <div className="flex-1 mx-2">
                                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                  <div
                                                    className={clsx("h-full rounded-full transition-all duration-500",
                                                      source.confidence > 0.7 ? "bg-red-400" : source.confidence > 0.4 ? "bg-accent-amber" : "bg-accent-emerald"
                                                    )}
                                                    style={{ width: `${source.confidence * 100}%` }}
                                                  />
                                                </div>
                                              </div>
                                              <span className="text-[10px] text-dark-400">{Math.round(source.confidence * 100)}%</span>
                                            </div>
                                            {source.evidence && (
                                              <p className="text-xs text-dark-400 italic pl-5 border-l border-white/5">{source.evidence}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Summary */}
                                    {report.summary && (
                                      <div className="pt-2 border-t border-white/5">
                                        <p className="text-xs font-medium text-dark-300 mb-1">Summary</p>
                                        <p className="text-xs text-dark-400">{report.summary}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Network Analysis Tab */}
          {activeTab === "network" && (
            <div className="space-y-4">
              {/* Run Analysis Button */}
              {!networkReport && !analyzingNetwork && (
                <div className="text-center py-12 glass-card">
                  <Network className="w-12 h-12 text-dark-500 mx-auto mb-3" />
                  <p className="text-sm text-dark-300 mb-4">Analyze similarity between all submissions for this assignment</p>
                  <button
                    onClick={handleAnalyzeNetwork}
                    className="inline-flex items-center gap-2 px-5 py-2.5 btn-gradient rounded-xl text-sm font-medium text-white"
                  >
                    <Network className="w-4 h-4" /> Run Network Analysis
                  </button>
                </div>
              )}

              {analyzingNetwork && (
                <div className="text-center py-12 glass-card">
                  <Loader2 className="w-8 h-8 text-accent-cyan animate-spin mx-auto mb-3" />
                  <p className="text-sm text-white">Analyzing cross-submission similarity...</p>
                  <p className="text-xs text-dark-400 mt-1">This may take a moment for large classes</p>
                </div>
              )}

              {networkReport && (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="glass-card p-4 text-center">
                      <p className="text-2xl font-bold text-white">{networkReport.total_submissions}</p>
                      <p className="text-xs text-dark-400">Total Submissions</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <p className="text-2xl font-bold text-accent-amber">{networkReport.flagged_clusters.length}</p>
                      <p className="text-xs text-dark-400">Flagged Clusters</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <p className="text-2xl font-bold text-accent-cyan">{networkReport.network_graph.edges.length}</p>
                      <p className="text-xs text-dark-400">Similarity Connections</p>
                    </div>
                  </div>

                  {/* Summary */}
                  {networkReport.summary && (
                    <div className="glass-card p-4">
                      <p className="text-xs font-medium text-dark-300 mb-1">Analysis Summary</p>
                      <p className="text-sm text-dark-200">{networkReport.summary}</p>
                    </div>
                  )}

                  {/* Network Graph Visualization */}
                  {networkReport.network_graph.nodes.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Network className="w-4 h-4 text-accent-cyan" /> Similarity Network
                      </h3>
                      <NetworkGraph graph={networkReport.network_graph} />
                    </div>
                  )}

                  {/* Flagged Clusters */}
                  {networkReport.flagged_clusters.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent-amber" /> Flagged Clusters
                      </h3>
                      {networkReport.flagged_clusters.map((cluster, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="glass-card p-4 border-l-2 border-l-red-400"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-red-400" />
                              <span className="text-sm font-medium text-white">Cluster {i + 1}</span>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                              Max Similarity: {Math.round(cluster.max_similarity * 100)}%
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {cluster.students.map(student => (
                              <span key={student.id} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-dark-200 border border-white/5">
                                {student.name || student.id}
                                <span className="ml-1.5 text-dark-500">({Math.round(student.similarity_to_cluster * 100)}%)</span>
                              </span>
                            ))}
                          </div>

                          {cluster.analysis && (
                            <p className="text-xs text-dark-400 pt-2 border-t border-white/5">{cluster.analysis}</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {networkReport.flagged_clusters.length === 0 && (
                    <div className="text-center py-8 glass-card">
                      <Shield className="w-10 h-10 text-accent-emerald mx-auto mb-2" />
                      <p className="text-sm text-dark-200">No suspicious clusters detected</p>
                      <p className="text-xs text-dark-400 mt-1">All submissions appear to be sufficiently unique</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// Simple network graph visualization using SVG
function NetworkGraph({ graph }: { graph: { nodes: { id: string; name: string }[]; edges: { source: string; target: string; similarity: number }[] } }) {
  const nodeCount = graph.nodes.length;
  const width = 500;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Position nodes in a circle
  const nodePositions = graph.nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const posMap = new Map(nodePositions.map(n => [n.id, n]));

  const edgeColor = (sim: number) =>
    sim > 0.7 ? "#f87171" : sim > 0.4 ? "#f59e0b" : "rgba(255,255,255,0.15)";

  return (
    <div className="flex justify-center overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-lg">
        {/* Edges */}
        {graph.edges.map((edge, i) => {
          const source = posMap.get(edge.source);
          const target = posMap.get(edge.target);
          if (!source || !target) return null;
          return (
            <line key={i} x1={source.x} y1={source.y} x2={target.x} y2={target.y}
              stroke={edgeColor(edge.similarity)}
              strokeWidth={Math.max(1, edge.similarity * 3)}
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {nodePositions.map(node => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={20} fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.5)" strokeWidth={1.5} />
            <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle"
              className="fill-white text-[9px] font-medium" style={{ pointerEvents: "none" }}>
              {(node.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </text>
            <text x={node.x} y={node.y + 34} textAnchor="middle"
              className="fill-dark-400 text-[8px]" style={{ pointerEvents: "none" }}>
              {node.name ? node.name.split(" ")[0] : node.id.slice(0, 6)}
            </text>
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(10, ${height - 50})`}>
          <line x1="0" y1="0" x2="20" y2="0" stroke="#f87171" strokeWidth="2" />
          <text x="25" y="4" className="fill-dark-400 text-[8px]">High (&gt;70%)</text>
          <line x1="0" y1="14" x2="20" y2="14" stroke="#f59e0b" strokeWidth="2" />
          <text x="25" y="18" className="fill-dark-400 text-[8px]">Medium (&gt;40%)</text>
          <line x1="0" y1="28" x2="20" y2="28" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <text x="25" y="32" className="fill-dark-400 text-[8px]">Low (&lt;40%)</text>
        </g>
      </svg>
    </div>
  );
}
