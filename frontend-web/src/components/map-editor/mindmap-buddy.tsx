"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { type Node, type Edge } from "@xyflow/react";
import { aiMindmapBuddyApi, type MapAnalysis, type NodeSuggestion } from "@/lib/api";
import {
  Bot, X, ChevronDown, ChevronUp, Star, Lightbulb, MessageSquare,
  Sparkles, Send, Loader2, RefreshCw, Plus, ArrowRight, BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MindmapBuddyProps {
  nodes: Node[];
  edges: Edge[];
  title: string;
  mapType?: string;
  taskDescription?: string;
  onAddNode?: (label: string) => void;
  selectedNode?: Node | null;
}

type Tab = "analyze" | "suggest" | "chat";

export default function MindmapBuddy({
  nodes,
  edges,
  title,
  mapType,
  taskDescription,
  onAddNode,
  selectedNode,
}: MindmapBuddyProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("analyze");
  const [analysis, setAnalysis] = useState<MapAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<NodeSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "buddy"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Analyze ──
  const handleAnalyze = useCallback(async () => {
    if (nodes.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await aiMindmapBuddyApi.analyze({
        title,
        nodes: nodes.map(n => ({ id: n.id, label: (n.data as Record<string, unknown>)?.label || "", type: n.type, position: n.position })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
        task_description: taskDescription,
        map_type: mapType,
      });
      setAnalysis(result);
    } catch {
      setAnalysis(null);
    }
    setAnalyzing(false);
  }, [nodes, edges, title, taskDescription, mapType]);

  // ── Node Suggestions ──
  const handleSuggest = useCallback(async () => {
    if (!selectedNode) return;
    setSuggesting(true);
    const nodeData = selectedNode.data as Record<string, unknown>;
    const label = (nodeData?.label as string) || "";

    // Find parent and sibling labels
    const parentEdges = edges.filter(e => e.target === selectedNode.id);
    const parentIds = parentEdges.map(e => e.source);
    const parentLabels = nodes
      .filter(n => parentIds.includes(n.id))
      .map(n => ((n.data as Record<string, unknown>)?.label as string) || "");

    const childEdgesOfParent = edges.filter(e => parentIds.includes(e.source) && e.target !== selectedNode.id);
    const siblingLabels = nodes
      .filter(n => childEdgesOfParent.map(e => e.target).includes(n.id))
      .map(n => ((n.data as Record<string, unknown>)?.label as string) || "");

    try {
      const result = await aiMindmapBuddyApi.recommendNodes({
        node_id: selectedNode.id,
        node_label: label,
        parent_labels: parentLabels,
        sibling_labels: siblingLabels,
        map_topic: title,
      });
      setSuggestions(result.suggestions || []);
    } catch {
      setSuggestions([]);
    }
    setSuggesting(false);
  }, [selectedNode, edges, nodes, title]);

  // ── Chat ──
  const handleChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    try {
      const result = await aiMindmapBuddyApi.chat(msg, {
        title,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeLabels: nodes.slice(0, 20).map(n => ((n.data as Record<string, unknown>)?.label as string) || ""),
      });
      setChatMessages(prev => [...prev, { role: "buddy", text: result.response }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "buddy", text: "Sorry, I couldn't process that. Try again!" }]);
    }
    setChatLoading(false);
  }, [chatInput, title, nodes, edges]);

  // Rating color
  const ratingColor = (r: number) =>
    r >= 8 ? "text-emerald-400" : r >= 6 ? "text-accent-blue" : r >= 4 ? "text-amber-400" : "text-red-400";

  const ratingBg = (r: number) =>
    r >= 8 ? "from-emerald-500/20 to-emerald-500/5" : r >= 6 ? "from-blue-500/20 to-blue-500/5" : r >= 4 ? "from-amber-500/20 to-amber-500/5" : "from-red-500/20 to-red-500/5";

  if (!open) {
    return (
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-lg shadow-accent-purple/20 hover:shadow-accent-purple/40 transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium">Smart Buddy</span>
        {analysis && (
          <span className={`text-xs font-bold ${ratingColor(analysis.rating)}`}>
            {analysis.rating}/10
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-6 right-6 z-50 w-[380px] glass-card rounded-2xl border border-white/10 shadow-2xl shadow-black/30 flex flex-col overflow-hidden"
        style={{ maxHeight: minimized ? "auto" : "70vh" }}
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-accent-purple/10 to-accent-blue/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Smart Buddy</h3>
              <p className="text-[10px] text-dark-400">AI Mind Map Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setMinimized(!minimized)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-dark-400">
              {minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-dark-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {([
                { key: "analyze" as Tab, icon: Star, label: "Analyze" },
                { key: "suggest" as Tab, icon: Lightbulb, label: "Suggest" },
                { key: "chat" as Tab, icon: MessageSquare, label: "Chat" },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    tab === t.key
                      ? "text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5"
                      : "text-dark-400 hover:text-dark-200 hover:bg-white/5"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* ── Analyze Tab ── */}
              {tab === "analyze" && (
                <div className="p-4 space-y-4">
                  {nodes.length === 0 ? (
                    <div className="text-center py-8 text-dark-400 text-sm">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Add some nodes to your mind map first, then I can analyze it!
                    </div>
                  ) : !analysis ? (
                    <div className="text-center py-6">
                      <p className="text-dark-300 text-sm mb-3">
                        Let me analyze your mind map and give you feedback!
                      </p>
                      <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {analyzing ? "Analyzing..." : "Analyze My Map"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Rating */}
                      <div className={`rounded-xl p-4 bg-gradient-to-br ${ratingBg(analysis.rating)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-dark-400 uppercase tracking-wider">Rating</span>
                          <button onClick={handleAnalyze} disabled={analyzing} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-dark-400">
                            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className={`text-3xl font-bold ${ratingColor(analysis.rating)}`}>{analysis.rating}</span>
                          <span className="text-dark-400 text-sm mb-1">/10</span>
                          <span className={`text-sm font-medium ml-auto ${ratingColor(analysis.rating)}`}>{analysis.rating_label}</span>
                        </div>
                        {/* Star bar */}
                        <div className="flex gap-0.5 mt-2">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${
                                i < analysis.rating ? "bg-current opacity-70" : "bg-white/10"
                              }`}
                              style={{ color: analysis.rating >= 8 ? "#34d399" : analysis.rating >= 6 ? "#60a5fa" : analysis.rating >= 4 ? "#fbbf24" : "#f87171" }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Structure Feedback */}
                      <p className="text-sm text-dark-200 leading-relaxed">{analysis.structure_feedback}</p>

                      {/* Strengths */}
                      {analysis.strengths.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Strengths</h4>
                          <ul className="space-y-1.5">
                            {analysis.strengths.map((s, i) => (
                              <li key={i} className="flex gap-2 text-sm text-dark-200">
                                <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Improvements */}
                      {analysis.improvements.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Improvements</h4>
                          <ul className="space-y-1.5">
                            {analysis.improvements.map((s, i) => (
                              <li key={i} className="flex gap-2 text-sm text-dark-200">
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggested Nodes */}
                      {analysis.suggested_nodes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-accent-blue mb-2 uppercase tracking-wider">Suggested Nodes</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.suggested_nodes.map((label, i) => (
                              <button
                                key={i}
                                onClick={() => onAddNode?.(label)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-blue/10 text-accent-blue text-xs hover:bg-accent-blue/20 transition-colors border border-accent-blue/20"
                              >
                                <Plus className="w-3 h-3" />
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Map Type Recommendation */}
                      {analysis.type_change_reason && (
                        <div className="rounded-xl p-3 bg-accent-purple/10 border border-accent-purple/20">
                          <h4 className="text-xs font-semibold text-accent-purple mb-1">Recommended Map Type</h4>
                          <p className="text-sm font-medium text-white">{analysis.recommended_map_type}</p>
                          <p className="text-xs text-dark-300 mt-1">{analysis.type_change_reason}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Suggest Tab ── */}
              {tab === "suggest" && (
                <div className="p-4 space-y-4">
                  {!selectedNode ? (
                    <div className="text-center py-8 text-dark-400 text-sm">
                      <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Select a node on your map to get suggestions for child nodes.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-dark-400">Selected node</p>
                          <p className="text-sm font-medium text-white">
                            {((selectedNode.data as Record<string, unknown>)?.label as string) || "(empty)"}
                          </p>
                        </div>
                        <button
                          onClick={handleSuggest}
                          disabled={suggesting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {suggesting ? "Thinking..." : "Get Suggestions"}
                        </button>
                      </div>

                      {suggestions.length > 0 && (
                        <div className="space-y-2">
                          {suggestions.map((s, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
                            >
                              <div className="w-6 h-6 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-accent-blue">{i + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{s.label}</p>
                                <p className="text-xs text-dark-400 mt-0.5">{s.description}</p>
                                {s.source && (
                                  <span className="inline-flex items-center gap-1 text-[10px] mt-1 px-1.5 py-0.5 rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                                    <BookOpen className="w-2.5 h-2.5" />
                                    {s.source.title}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => onAddNode?.(s.label)}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent-blue/10 text-accent-blue transition-all"
                                title="Add as node"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Chat Tab ── */}
              {tab === "chat" && (
                <div className="flex flex-col h-[340px]">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8 text-dark-400 text-sm">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Ask me anything about your mind map!
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                            m.role === "user"
                              ? "bg-accent-blue/20 text-white rounded-br-md"
                              : "bg-white/5 text-dark-200 rounded-bl-md"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white/5 px-3 py-2 rounded-2xl rounded-bl-md">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-dark-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 rounded-full bg-dark-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-dark-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 border-t border-white/5">
                    <form
                      onSubmit={e => { e.preventDefault(); handleChat(); }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Ask about your mind map..."
                        className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-dark-500 outline-none focus:border-accent-blue/30"
                      />
                      <button
                        type="submit"
                        disabled={chatLoading || !chatInput.trim()}
                        className="p-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
