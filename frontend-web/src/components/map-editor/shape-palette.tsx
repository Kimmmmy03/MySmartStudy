"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, ArrowRight, GitBranch, Network, Circle, Binary, Workflow, Grid2x2, Columns3, GitMerge, Clock, Building2, Route, CircleDot, StickyNote, PanelLeftClose, PanelLeftOpen, Target, GitCompareArrows, Ungroup, Waypoints, ListOrdered, Split } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { getHierarchicalTemplate, getSpiderTemplate, getBubbleTemplate, getTreeTemplate, getFlowchartTemplate, getSwotTemplate, getKwlTemplate, getCauseEffectTemplate, getTimelineTemplate, getOrgChartTemplate, getProcessMapTemplate, getVennDiagramTemplate, getCornellNotesTemplate, getCircleMapTemplate, getDoubleBubbleMapTemplate, getBraceMapTemplate, getBridgeMapTemplate, getFlowMapTemplate, getMultiFlowMapTemplate } from "./templates";
import { PREVIEWS, SHAPE_LABELS } from "./shape-meta";
import type { Node, Edge } from "@xyflow/react";

interface ShapePaletteProps {
  onAddNode: (shape: string) => void;
  onLoadTemplate: (nodes: Node[], edges: Edge[]) => void;
}

// ── Categories ──

const CATEGORIES = [
  {
    id: "basic",
    label: "Basic",
    shapes: ["rectangle", "roundedRect", "circle", "ellipse", "diamond", "triangle"],
  },
  {
    id: "flowchart",
    label: "Flowchart",
    shapes: ["parallelogram", "cylinder", "database", "document", "hexagon", "arrowShape"],
  },
  {
    id: "creative",
    label: "Creative",
    shapes: ["star", "cloud", "callout", "pentagon", "octagon", "cross"],
  },
  {
    id: "special",
    label: "Special",
    shapes: ["text", "image", "group"],
  },
];

const templates = [
  { id: "hierarchical", label: "Hierarchical", icon: GitBranch, get: getHierarchicalTemplate },
  { id: "spider", label: "Spider", icon: Network, get: getSpiderTemplate },
  { id: "bubble", label: "Bubble", icon: Circle, get: getBubbleTemplate },
  { id: "tree", label: "Tree", icon: Binary, get: getTreeTemplate },
  { id: "flowchart", label: "Flowchart", icon: Workflow, get: getFlowchartTemplate },
  { id: "swot", label: "SWOT Analysis", icon: Grid2x2, get: getSwotTemplate },
  { id: "kwl", label: "KWL Chart", icon: Columns3, get: getKwlTemplate },
  { id: "causeEffect", label: "Cause & Effect", icon: GitMerge, get: getCauseEffectTemplate },
  { id: "timeline", label: "Timeline", icon: Clock, get: getTimelineTemplate },
  { id: "orgChart", label: "Org Chart", icon: Building2, get: getOrgChartTemplate },
  { id: "processMap", label: "Process Map", icon: Route, get: getProcessMapTemplate },
  { id: "vennDiagram", label: "Venn Diagram", icon: CircleDot, get: getVennDiagramTemplate },
  { id: "cornellNotes", label: "Cornell Notes", icon: StickyNote, get: getCornellNotesTemplate },
];

const ipgTemplates = [
  { id: "circleMap", label: "Circle Map", icon: Target, get: getCircleMapTemplate },
  { id: "doubleBubble", label: "Double Bubble", icon: GitCompareArrows, get: getDoubleBubbleMapTemplate },
  { id: "braceMap", label: "Brace Map", icon: Ungroup, get: getBraceMapTemplate },
  { id: "bridgeMap", label: "Bridge Map", icon: Waypoints, get: getBridgeMapTemplate },
  { id: "flowMap", label: "Flow Map", icon: ListOrdered, get: getFlowMapTemplate },
  { id: "multiFlowMap", label: "Multi-Flow Map", icon: Split, get: getMultiFlowMapTemplate },
];

export default function ShapePalette({ onAddNode, onLoadTemplate }: ShapePaletteProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggle = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }));

  const onDragStart = (e: React.DragEvent, shape: string) => {
    e.dataTransfer.setData("application/reactflow-shape", shape);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!sidebarOpen ? (
        <motion.div
          key="collapsed"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 40, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="glass border-r border-white/5 flex flex-col items-center py-3 overflow-hidden"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 hover:bg-white/5 rounded-lg text-dark-300 hover:text-white transition-colors"
            title="Open shape palette"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="expanded"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 224, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="glass border-r border-white/5 overflow-y-auto overflow-x-hidden p-3 space-y-1 select-none"
        >
          {/* Collapse button */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.15 }}
            className="flex items-center justify-between mb-1"
          >
            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider whitespace-nowrap">Elements</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-white/5 rounded-lg text-dark-400 hover:text-white transition-colors"
              title="Collapse palette"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </motion.div>

          {CATEGORIES.map((cat, catIdx) => {
            const isOpen = !collapsed[cat.id];
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + catIdx * 0.04, duration: 0.15 }}
              >
                <button
                  onClick={() => toggle(cat.id)}
                  className="flex items-center gap-1.5 w-full text-left text-[11px] font-semibold text-dark-400 uppercase tracking-wider py-1.5 hover:text-dark-200 transition-colors whitespace-nowrap"
                >
                  {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {cat.label}
                </button>
                {isOpen && (
                  <div className="grid grid-cols-3 gap-1.5 pb-2">
                    {cat.shapes.map(shape => (
                      <button
                        key={shape}
                        draggable
                        onDragStart={e => onDragStart(e, shape)}
                        onClick={() => onAddNode(shape)}
                        className="flex flex-col items-center gap-0.5 p-2 rounded-lg border border-white/5 hover:border-accent-blue/30 hover:bg-accent-blue/5 transition-all text-dark-300 hover:text-accent-blue cursor-grab active:cursor-grabbing"
                        title={SHAPE_LABELS[shape]}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-6 h-6"
                        >
                          {PREVIEWS[shape]}
                        </svg>
                        <span className="text-[9px] font-medium leading-tight whitespace-nowrap">{SHAPE_LABELS[shape]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Connections hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.15 }}
            className="pt-1 pb-2"
          >
            <p className="text-[10px] text-dark-400 flex items-center gap-1 whitespace-nowrap">
              <ArrowRight className="w-3 h-3" /> Drag handles to connect
            </p>
          </motion.div>

          {/* Templates */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.15 }}
          >
            <button
              onClick={() => toggle("templates")}
              className="flex items-center gap-1.5 w-full text-left text-[11px] font-semibold text-dark-400 uppercase tracking-wider py-1.5 hover:text-dark-200 transition-colors whitespace-nowrap"
            >
              {!collapsed.templates ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Templates
            </button>
            {!collapsed.templates && (
              <div className="space-y-0.5 pb-2">
                {templates.map(({ id, label, icon: Icon, get }) => (
                  <button
                    key={id}
                    onClick={() => { const { nodes, edges } = get(isDark); onLoadTemplate(nodes, edges); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-dark-200 hover:bg-accent-blue/5 hover:text-accent-blue transition-colors whitespace-nowrap"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* IPG i-Think Templates */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.15 }}
          >
            <button
              onClick={() => toggle("ipgTemplates")}
              className="flex items-center gap-1.5 w-full text-left text-[11px] font-semibold text-dark-400 uppercase tracking-wider py-1.5 hover:text-dark-200 transition-colors whitespace-nowrap"
            >
              {!collapsed.ipgTemplates ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              i-Think Maps
            </button>
            {!collapsed.ipgTemplates && (
              <div className="space-y-0.5 pb-2">
                {ipgTemplates.map(({ id, label, icon: Icon, get }) => (
                  <button
                    key={id}
                    onClick={() => { const { nodes, edges } = get(isDark); onLoadTemplate(nodes, edges); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-dark-200 hover:bg-accent-purple/5 hover:text-accent-purple transition-colors whitespace-nowrap"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
