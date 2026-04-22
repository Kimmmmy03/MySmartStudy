"use client";

import { useState, useRef, useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Bold, Italic, Underline,
  ChevronDown, ChevronRight, Lock, Unlock,
  ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
  Upload, Eraser, Sparkles, Loader2, Check,
  Type, Palette, Move, Image, Layers, Link2,
  Minus, ArrowRight as ArrowRightIcon, Anchor,
} from "lucide-react";
import { alignNodes, distributeNodes, reorderZIndex } from "./alignment-utils";
import type { CustomEdgeData } from "./custom-edges";

interface PropertiesPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onNodeChange: (id: string, data: Record<string, unknown>) => void;
  onEdgeChange: (id: string, updates: Partial<Edge>) => void;
  nodes: Node[];
  selectedNodeIds: string[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  mapId?: string | null;
  onSaveMap?: () => void;
}

function Section({ label, icon, children, defaultOpen = true }: { label: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-[11px] font-semibold text-dark-200 py-2.5 px-1 hover:text-dark-100 transition-colors">
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown className="w-3 h-3 text-dark-400" /> : <ChevronRight className="w-3 h-3 text-dark-400" />}
      </button>
      {open && <div className="space-y-2.5 pb-3 px-1">{children}</div>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] text-dark-400 mb-1 font-medium">{children}</label>;
}

function ColorSwatch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-8 rounded-lg cursor-pointer bg-dark-700 border border-white/10 hover:border-white/20 transition-colors" />
      </div>
    </div>
  );
}

function SmallInput({ type = "number", value, onChange, min, max, step, label }: {
  type?: string; value: string | number; onChange: (v: string) => void; min?: number; max?: number; step?: number; label?: string;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step}
        className="glass-input w-full px-2 py-1.5 text-xs rounded-lg" />
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, displayValue }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; displayValue?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        {displayValue && <span className="text-[10px] text-dark-300">{displayValue}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent-blue h-1.5 rounded-full" />
    </div>
  );
}

function ToggleBtn({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-lg transition-all ${active ? "bg-accent-blue/15 text-accent-blue shadow-sm" : "text-dark-400 hover:text-dark-200 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

function StylePresetBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
        active
          ? "bg-accent-purple/15 text-accent-purple border border-accent-purple/30 shadow-sm"
          : "bg-white/5 text-dark-300 border border-white/8 hover:bg-white/8 hover:text-dark-100"
      }`}>
      {label}
    </button>
  );
}

export default function PropertiesPanel({
  selectedNode, selectedEdge, onNodeChange, onEdgeChange,
  nodes, selectedNodeIds, setNodes, mapId, onSaveMap,
}: PropertiesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSaved, setAiSaved] = useState(false);
  const [aiCachedResult, setAiCachedResult] = useState(false);
  const [aiQuota, setAiQuota] = useState<{ used: number; limit: number; can_generate: boolean } | null>(null);

  useEffect(() => {
    import("@/lib/api").then(({ aiImagesApi }) => {
      aiImagesApi.getQuota().then(q => setAiQuota(q)).catch(() => {});
    });
  }, []);

  if (!selectedNode && !selectedEdge && selectedNodeIds.length < 2) {
    return null;
  }

  // ── Multi-select alignment tools ──

  if (selectedNodeIds.length >= 2 && !selectedNode && !selectedEdge) {
    return (
      <div className="w-64 glass border-l border-white/5 p-3 space-y-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-6 h-6 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <span className="text-xs font-semibold text-dark-100">{selectedNodeIds.length} nodes selected</span>
        </div>

        <Section label="Align" icon={<AlignCenterVertical className="w-3.5 h-3.5 text-dark-400" />}>
          <div className="grid grid-cols-6 gap-1">
            <ToggleBtn active={false} onClick={() => setNodes(alignNodes(nodes, selectedNodeIds, "left"))} title="Align left"><AlignStartVertical className="w-3.5 h-3.5" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(alignNodes(nodes, selectedNodeIds, "centerH"))} title="Center H"><AlignCenterVertical className="w-3.5 h-3.5" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(alignNodes(nodes, selectedNodeIds, "right"))} title="Align right"><AlignEndVertical className="w-3.5 h-3.5" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(alignNodes(nodes, selectedNodeIds, "top"))} title="Align top"><AlignStartVertical className="w-3.5 h-3.5 rotate-90" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(alignNodes(nodes, selectedNodeIds, "centerV"))} title="Center V"><AlignCenterVertical className="w-3.5 h-3.5 rotate-90" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(alignNodes(nodes, selectedNodeIds, "bottom"))} title="Align bottom"><AlignEndVertical className="w-3.5 h-3.5 rotate-90" /></ToggleBtn>
          </div>
        </Section>

        {selectedNodeIds.length >= 3 && (
          <Section label="Distribute" icon={<AlignHorizontalSpaceAround className="w-3.5 h-3.5 text-dark-400" />}>
            <div className="flex gap-1">
              <ToggleBtn active={false} onClick={() => setNodes(distributeNodes(nodes, selectedNodeIds, "horizontal"))} title="Distribute H"><AlignHorizontalSpaceAround className="w-3.5 h-3.5" /></ToggleBtn>
              <ToggleBtn active={false} onClick={() => setNodes(distributeNodes(nodes, selectedNodeIds, "vertical"))} title="Distribute V"><AlignVerticalSpaceAround className="w-3.5 h-3.5" /></ToggleBtn>
            </div>
          </Section>
        )}

        <Section label="Layer" icon={<Layers className="w-3.5 h-3.5 text-dark-400" />}>
          <div className="flex gap-1">
            <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, selectedNodeIds, "front"))} title="Bring to front"><ArrowUpToLine className="w-3.5 h-3.5" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, selectedNodeIds, "forward"))} title="Bring forward"><ArrowUp className="w-3.5 h-3.5" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, selectedNodeIds, "backward"))} title="Send backward"><ArrowDown className="w-3.5 h-3.5" /></ToggleBtn>
            <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, selectedNodeIds, "back"))} title="Send to back"><ArrowDownToLine className="w-3.5 h-3.5" /></ToggleBtn>
          </div>
        </Section>
      </div>
    );
  }

  // ── Node properties ──

  if (selectedNode) {
    const d = selectedNode.data as Record<string, unknown>;
    const shape = (d.shape as string) || "rectangle";
    const update = (key: string, val: unknown) => onNodeChange(selectedNode.id, { ...d, [key]: val });

    const isRect = ["rectangle", "roundedRect"].includes(shape);

    const handleImageUpload = async (file: File) => {
      if (!mapId) {
        const reader = new FileReader();
        reader.onload = (e) => { update("imageUrl", e.target?.result as string); };
        reader.readAsDataURL(file);
        return;
      }
      setUploading(true);
      try {
        const { mapsApi } = await import("@/lib/api");
        const result = await mapsApi.uploadNodeImage(mapId, file);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
        update("imageUrl", `${apiUrl}${result.image_url}`);
        // Auto-save the map immediately
        setTimeout(() => onSaveMap?.(), 300);
      } catch {
        const reader = new FileReader();
        reader.onload = (e) => { update("imageUrl", e.target?.result as string); };
        reader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
    };

    const isImageNode = shape === "image";

    const quotaExhausted = aiQuota !== null && !aiQuota.can_generate;

    const aiImageSection = (
      <Section label="AI Image" icon={<Sparkles className="w-3.5 h-3.5 text-accent-purple" />} defaultOpen={isImageNode}>
        {/* Quota indicator */}
        {aiQuota !== null && (
          <div className="flex items-center justify-between text-[10px] bg-white/5 rounded-lg px-2 py-1.5">
            <span className="text-dark-300">Daily quota</span>
            <span className={quotaExhausted ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
              {aiQuota.used}/{aiQuota.limit} used
            </span>
          </div>
        )}
        {quotaExhausted && (
          <p className="text-[10px] text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1.5">
            Daily limit reached. Try again tomorrow or use a cached prompt.
          </p>
        )}
        <div>
          <Label>Describe the image</Label>
          <input type="text" value={aiPrompt} onChange={e => { setAiPrompt(e.target.value); setAiError(""); }}
            placeholder="e.g. A diagram of photosynthesis..."
            className="glass-input w-full px-2.5 py-1.5 text-xs rounded-lg" />
        </div>
        <div>
          <Label>Style</Label>
          <div className="flex flex-wrap gap-1">
            {[
              { key: "", label: "Realistic" },
              { key: "cartoon", label: "Cartoon" },
              { key: "realistic", label: "Realistic" },
              { key: "sketch", label: "Sketch" },
              { key: "watercolor", label: "Watercolor" },
              { key: "flat", label: "Flat" },
              { key: "3d", label: "3D" },
              { key: "pixel", label: "Pixel" },
            ].map(s => (
              <StylePresetBtn key={s.key} active={aiStyle === s.key} onClick={() => setAiStyle(s.key)} label={s.label} />
            ))}
          </div>
        </div>
        <button
          onClick={async () => {
            if (!aiPrompt.trim()) return;
            setAiGenerating(true);
            setAiError("");
            setAiSaved(false);
            setAiCachedResult(false);
            try {
              const { aiImagesApi } = await import("@/lib/api");
              const result = await aiImagesApi.generate(aiPrompt.trim(), aiStyle || undefined, mapId || undefined);
              const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
              const imageUrl = result.image_url.startsWith("http") ? result.image_url : `${apiUrl}${result.image_url}`;
              update("imageUrl", imageUrl);
              if (shape !== "image") { update("shape", "image"); }
              setAiPrompt("");
              setAiCachedResult(result.cached ?? false);
              // Refresh quota after generation
              if (result.quota) setAiQuota(result.quota);
              else aiImagesApi.getQuota().then(q => setAiQuota(q)).catch(() => {});
              // Auto-save the map immediately so the image is persisted
              setTimeout(() => onSaveMap?.(), 300);
              setAiSaved(true);
              setTimeout(() => setAiSaved(false), 3000);
            } catch (err: unknown) {
              setAiError(err instanceof Error ? err.message : "Failed to generate image");
            } finally {
              setAiGenerating(false);
            }
          }}
          disabled={aiGenerating || !aiPrompt.trim() || quotaExhausted}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-pink text-xs text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-accent-purple/10"
        >
          {aiGenerating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> {quotaExhausted ? "Limit Reached" : "Generate Image"}</>
          )}
        </button>
        {aiSaved && (
          <p className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-lg px-2 py-1.5 flex items-center gap-1">
            <Check className="w-3 h-3" />
            {aiCachedResult ? "Reused cached image (no credit used)" : "Image generated & saved to map"}
          </p>
        )}
        {aiError && <p className="text-[10px] text-red-400 bg-red-500/5 rounded-lg px-2 py-1">{aiError}</p>}
      </Section>
    );

    const imageUploadSection = (
      <Section label="Image" icon={<Image className="w-3.5 h-3.5 text-dark-400" />}>
        <div>
          <Label>Image URL</Label>
          <input type="text" value={(d.imageUrl as string) || ""} onChange={e => update("imageUrl", e.target.value)}
            placeholder="https://..." className="glass-input w-full px-2.5 py-1.5 text-xs rounded-lg" />
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/15 text-xs text-dark-200 hover:bg-white/5 hover:border-white/25 transition-all disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Uploading..." : "Upload Image"}
          </button>
        </div>
        {(d.imageUrl as string) && (
          <button onClick={() => update("imageUrl", "")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] text-red-400 hover:bg-red-500/10 transition-colors">
            <Eraser className="w-3 h-3" /> Remove Image
          </button>
        )}
      </Section>
    );

    return (
      <div className="w-64 glass border-l border-white/5 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 sticky top-0 glass z-10">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isImageNode ? "bg-accent-purple/10" : "bg-accent-blue/10"}`}>
              {isImageNode ? <Image className="w-3.5 h-3.5 text-accent-purple" /> : <Type className="w-3.5 h-3.5 text-accent-blue" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-dark-100 truncate">{(d.label as string) || (isImageNode ? "Image" : "Node")}</p>
              <p className="text-[10px] text-dark-400 capitalize">{shape}</p>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-0">
          {/* For image nodes: AI Image on top, then Image upload, then minimal styling */}
          {isImageNode && aiImageSection}
          {isImageNode && imageUploadSection}

          {/* Text — always shown (image nodes use label as caption) */}
          <Section label={isImageNode ? "Caption" : "Text"} icon={<Type className="w-3.5 h-3.5 text-dark-400" />} defaultOpen={!isImageNode}>
            <div>
              <Label>{isImageNode ? "Caption" : "Label"}</Label>
              <input type="text" value={(d.label as string) || ""} onChange={e => update("label", e.target.value)}
                className="glass-input w-full px-2.5 py-1.5 text-xs rounded-lg" placeholder={isImageNode ? "Image caption..." : "Enter label..."} />
            </div>
            {!isImageNode && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <SmallInput label="Font Size" value={(d.fontSize as number) || 14} onChange={v => update("fontSize", parseInt(v) || 14)} min={8} max={72} />
                  <ColorSwatch label="Font Color" value={(d.fontColor as string) || "#e0e0e0"} onChange={v => update("fontColor", v)} />
                </div>
                <div>
                  <Label>Font Family</Label>
                  <select value={(d.fontFamily as string) || "inherit"} onChange={e => update("fontFamily", e.target.value)}
                    className="glass-input w-full px-2.5 py-1.5 text-xs rounded-lg">
                    <option value="inherit">Default</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                  </select>
                </div>
                <div className="flex items-center gap-0.5 bg-white/3 rounded-lg p-0.5">
                  <ToggleBtn active={d.fontWeight === "bold"} onClick={() => update("fontWeight", d.fontWeight === "bold" ? "normal" : "bold")} title="Bold"><Bold className="w-3.5 h-3.5" /></ToggleBtn>
                  <ToggleBtn active={d.fontStyle === "italic"} onClick={() => update("fontStyle", d.fontStyle === "italic" ? "normal" : "italic")} title="Italic"><Italic className="w-3.5 h-3.5" /></ToggleBtn>
                  <ToggleBtn active={d.textDecoration === "underline"} onClick={() => update("textDecoration", d.textDecoration === "underline" ? "none" : "underline")} title="Underline"><Underline className="w-3.5 h-3.5" /></ToggleBtn>
                  <div className="w-px h-4 bg-white/10 mx-0.5" />
                  <ToggleBtn active={d.textAlign === "left"} onClick={() => update("textAlign", "left")} title="Left"><AlignLeft className="w-3.5 h-3.5" /></ToggleBtn>
                  <ToggleBtn active={!d.textAlign || d.textAlign === "center"} onClick={() => update("textAlign", "center")} title="Center"><AlignCenter className="w-3.5 h-3.5" /></ToggleBtn>
                  <ToggleBtn active={d.textAlign === "right"} onClick={() => update("textAlign", "right")} title="Right"><AlignRight className="w-3.5 h-3.5" /></ToggleBtn>
                </div>
              </>
            )}
          </Section>

          {/* Appearance — shown for non-image nodes */}
          {!isImageNode && (
            <Section label="Appearance" icon={<Palette className="w-3.5 h-3.5 text-dark-400" />}>
              <div className="grid grid-cols-2 gap-2">
                <ColorSwatch label="Fill" value={(d.fillColor as string) || "#1a1a28"} onChange={v => update("fillColor", v)} />
                <ColorSwatch label="Stroke" value={(d.strokeColor as string) || "#6366f1"} onChange={v => update("strokeColor", v)} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update("fillColor", "transparent")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${(d.fillColor as string) === "transparent" ? "bg-accent-blue/15 text-accent-blue" : "text-dark-400 hover:text-dark-200 bg-white/5 hover:bg-white/8"}`}
                >
                  <Eraser className="w-3 h-3" />
                  No Fill
                </button>
                <label className="flex items-center gap-1.5 text-[10px] text-dark-300 cursor-pointer bg-white/5 hover:bg-white/8 rounded-lg px-2.5 py-1.5 transition-colors">
                  <input type="checkbox" checked={!!d.shadow} onChange={e => update("shadow", e.target.checked)}
                    className="rounded border-dark-400 bg-dark-700 text-accent-blue w-3 h-3" />
                  Shadow
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Gradient</Label>
                  <label className="flex items-center gap-1 text-[10px] text-dark-400 cursor-pointer">
                    <input type="checkbox" checked={!!d.gradientColor} onChange={e => update("gradientColor", e.target.checked ? "#6366f1" : "")}
                      className="rounded border-dark-400 bg-dark-700 text-accent-blue w-3 h-3" />
                    On
                  </label>
                </div>
                {!!d.gradientColor && (
                  <input type="color" value={(d.gradientColor as string) || "#6366f1"}
                    onChange={e => update("gradientColor", e.target.value)}
                    className="w-full h-7 rounded-lg cursor-pointer bg-dark-700 border border-white/10" />
                )}
              </div>
              <Slider label="Stroke Width" value={(d.strokeWidth as number) ?? 2} onChange={v => update("strokeWidth", v)} min={0} max={8} displayValue={`${(d.strokeWidth as number) ?? 2}px`} />
              <Slider label="Opacity" value={Math.round(((d.opacity as number) ?? 1) * 100)} onChange={v => update("opacity", v / 100)} min={10} max={100} displayValue={`${Math.round(((d.opacity as number) ?? 1) * 100)}%`} />
              {isRect && (
                <Slider label="Radius" value={(d.borderRadius as number) ?? (shape === "roundedRect" ? 12 : 4)} onChange={v => update("borderRadius", v)} min={0} max={30} displayValue={`${(d.borderRadius as number) ?? (shape === "roundedRect" ? 12 : 4)}px`} />
              )}
            </Section>
          )}

          {/* Image nodes: minimal style controls */}
          {isImageNode && (
            <Section label="Style" icon={<Palette className="w-3.5 h-3.5 text-dark-400" />} defaultOpen={false}>
              <Slider label="Opacity" value={Math.round(((d.opacity as number) ?? 1) * 100)} onChange={v => update("opacity", v / 100)} min={10} max={100} displayValue={`${Math.round(((d.opacity as number) ?? 1) * 100)}%`} />
              <label className="flex items-center gap-1.5 text-[10px] text-dark-300 cursor-pointer bg-white/5 hover:bg-white/8 rounded-lg px-2.5 py-1.5 transition-colors">
                <input type="checkbox" checked={!!d.shadow} onChange={e => update("shadow", e.target.checked)}
                  className="rounded border-dark-400 bg-dark-700 text-accent-blue w-3 h-3" />
                Shadow
              </label>
              <Slider label="Stroke Width" value={(d.strokeWidth as number) ?? 2} onChange={v => update("strokeWidth", v)} min={0} max={8} displayValue={`${(d.strokeWidth as number) ?? 2}px`} />
              <ColorSwatch label="Border Color" value={(d.strokeColor as string) || "#6366f1"} onChange={v => update("strokeColor", v)} />
            </Section>
          )}

          {/* Transform */}
          <Section label="Transform" icon={<Move className="w-3.5 h-3.5 text-dark-400" />} defaultOpen={false}>
            <Slider label="Rotation" value={(d.rotation as number) ?? 0} onChange={v => update("rotation", v)} min={0} max={360} step={5} displayValue={`${(d.rotation as number) ?? 0}°`} />
          </Section>

          {/* Lock & Layer */}
          <Section label="More" icon={<Lock className="w-3.5 h-3.5 text-dark-400" />} defaultOpen={false}>
            <div className="flex items-center gap-2">
              <button onClick={() => update("locked", !d.locked)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${d.locked ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-dark-400 hover:text-dark-200 bg-white/5"}`}>
                {d.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {d.locked ? "Locked" : "Unlocked"}
              </button>
            </div>
            <div className="flex gap-1">
              <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, [selectedNode.id], "front"))} title="Bring to front"><ArrowUpToLine className="w-3.5 h-3.5" /></ToggleBtn>
              <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, [selectedNode.id], "forward"))} title="Bring forward"><ArrowUp className="w-3.5 h-3.5" /></ToggleBtn>
              <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, [selectedNode.id], "backward"))} title="Send backward"><ArrowDown className="w-3.5 h-3.5" /></ToggleBtn>
              <ToggleBtn active={false} onClick={() => setNodes(reorderZIndex(nodes, [selectedNode.id], "back"))} title="Send to back"><ArrowDownToLine className="w-3.5 h-3.5" /></ToggleBtn>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  // ── Edge properties ──

  if (selectedEdge) {
    const style = (selectedEdge.style || {}) as Record<string, unknown>;
    const edgeData = (selectedEdge.data || {}) as CustomEdgeData;
    const edgeType = selectedEdge.type || "bezier";

    const updateStyle = (key: string, val: unknown) => {
      onEdgeChange(selectedEdge.id, { style: { ...style, [key]: val } });
    };
    const updateData = (key: string, val: unknown) => {
      onEdgeChange(selectedEdge.id, { data: { ...edgeData, [key]: val } });
    };
    const updateType = (type: string) => {
      onEdgeChange(selectedEdge.id, { type });
    };

    return (
      <div className="w-64 glass border-l border-white/5 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 sticky top-0 glass z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <Link2 className="w-3.5 h-3.5 text-accent-purple" />
            </div>
            <p className="text-xs font-semibold text-dark-100">Edge Properties</p>
          </div>
        </div>

        <div className="p-3 space-y-0">
          <Section label="Type" icon={<Minus className="w-3.5 h-3.5 text-dark-400" />}>
            <div className="grid grid-cols-2 gap-1.5">
              {(["bezier", "straight", "step", "elbowed"] as const).map(t => (
                <button key={t} onClick={() => updateType(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${edgeType === t ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/20" : "text-dark-400 hover:bg-white/5 border border-transparent"}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Style" icon={<Palette className="w-3.5 h-3.5 text-dark-400" />}>
            <div className="grid grid-cols-2 gap-2">
              <ColorSwatch label="Color" value={(style.stroke as string) || "#6366f1"} onChange={v => updateStyle("stroke", v)} />
              <SmallInput label="Width" value={(style.strokeWidth as number) || 2} onChange={v => updateStyle("strokeWidth", parseInt(v) || 2)} min={1} max={8} />
            </div>
            <div>
              <Label>Line Style</Label>
              <div className="flex gap-1">
                {[
                  { label: "Solid", value: "" },
                  { label: "Dashed", value: "8,4" },
                  { label: "Dotted", value: "2,3" },
                ].map(ls => (
                  <button key={ls.label} onClick={() => updateData("strokeDasharray", ls.value)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${(edgeData.strokeDasharray || "") === ls.value ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/20" : "text-dark-400 hover:bg-white/5 border border-transparent"}`}>
                    {ls.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-dark-300 cursor-pointer bg-white/5 hover:bg-white/8 rounded-lg px-2.5 py-1.5 transition-colors">
              <input type="checkbox" checked={!!edgeData.animated} onChange={e => updateData("animated", e.target.checked)}
                className="rounded border-dark-400 bg-dark-700 text-accent-blue w-3 h-3" />
              Animated
            </label>
          </Section>

          <Section label="Label" icon={<Type className="w-3.5 h-3.5 text-dark-400" />}>
            <div>
              <Label>Text</Label>
              <input type="text" value={edgeData.label || ""} onChange={e => updateData("label", e.target.value)}
                placeholder="Edge label..." className="glass-input w-full px-2.5 py-1.5 text-xs rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorSwatch label="Text Color" value={edgeData.labelColor || "#e0e0e0"} onChange={v => updateData("labelColor", v)} />
              <ColorSwatch label="Background" value={edgeData.labelBgColor || "#1a1a28"} onChange={v => updateData("labelBgColor", v)} />
            </div>
          </Section>

          <Section label="Arrows" icon={<ArrowRightIcon className="w-3.5 h-3.5 text-dark-400" />}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Source</Label>
                <select value={edgeData.sourceArrow || "none"} onChange={e => updateData("sourceArrow", e.target.value)}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded-lg">
                  <option value="none">None</option>
                  <option value="arrow">Arrow</option>
                  <option value="openArrow">Open Arrow</option>
                  <option value="thinArrow">Thin Arrow</option>
                  <option value="block">Block</option>
                  <option value="diamond">Diamond</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
              <div>
                <Label>Target</Label>
                <select value={edgeData.targetArrow || "block"} onChange={e => updateData("targetArrow", e.target.value)}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded-lg">
                  <option value="none">None</option>
                  <option value="arrow">Arrow</option>
                  <option value="openArrow">Open Arrow</option>
                  <option value="thinArrow">Thin Arrow</option>
                  <option value="block">Block</option>
                  <option value="diamond">Diamond</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorSwatch label="Arrow Color" value={edgeData.arrowColor || (style.stroke as string) || "#6366f1"} onChange={v => updateData("arrowColor", v)} />
              <SmallInput label="Arrow Size" value={edgeData.arrowSize || 8} onChange={v => updateData("arrowSize", parseInt(v) || 8)} min={4} max={20} />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-dark-300 cursor-pointer bg-white/5 hover:bg-white/8 rounded-lg px-2.5 py-1.5 transition-colors">
                <input type="checkbox" checked={!edgeData.arrowColor} onChange={e => updateData("arrowColor", e.target.checked ? "" : (style.stroke as string) || "#6366f1")}
                  className="rounded border-dark-400 bg-dark-700 text-accent-blue w-3 h-3" />
                Match line color
              </label>
            </div>
          </Section>

          <Section label="Anchor Points" icon={<Anchor className="w-3.5 h-3.5 text-dark-400" />} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Source Side</Label>
                <select
                  value={selectedEdge.sourceHandle || "auto"}
                  onChange={e => onEdgeChange(selectedEdge.id, { sourceHandle: e.target.value === "auto" ? null : e.target.value })}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded-lg"
                >
                  <option value="auto">Auto</option>
                  <option value="top-source">Top</option>
                  <option value="bottom-source">Bottom</option>
                  <option value="left-source">Left</option>
                  <option value="right-source">Right</option>
                </select>
              </div>
              <div>
                <Label>Target Side</Label>
                <select
                  value={selectedEdge.targetHandle || "auto"}
                  onChange={e => onEdgeChange(selectedEdge.id, { targetHandle: e.target.value === "auto" ? null : e.target.value })}
                  className="glass-input w-full px-2 py-1.5 text-xs rounded-lg"
                >
                  <option value="auto">Auto</option>
                  <option value="top-target">Top</option>
                  <option value="bottom-target">Bottom</option>
                  <option value="left-target">Left</option>
                  <option value="right-target">Right</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-dark-500">Choose which side of each node the edge connects to.</p>
          </Section>
        </div>
      </div>
    );
  }

  return null;
}
