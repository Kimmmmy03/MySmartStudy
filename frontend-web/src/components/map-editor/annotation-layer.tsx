"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { mapsApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, Trash2, Pencil, Eraser, Undo2, Redo2, Minus, GripVertical } from "lucide-react";
import clsx from "clsx";

interface Annotation {
  id: string;
  authorId: string;
  authorName: string;
  type: string;
  content: string;
  position: { x: number; y: number }; // flow coordinates
  size?: { w: number; h: number };
  color: string;
  path?: string;
  strokeWidth?: number;
  createdAt: string;
}

interface AnnotationLayerProps {
  mapId: string;
  readOnly?: boolean;
  currentUserId: string;
  currentUserName?: string;
  viewport?: { x: number; y: number; zoom: number };
}

const THICKNESS_OPTIONS = [
  { value: 2, label: "Thin" },
  { value: 4, label: "Medium" },
  { value: 7, label: "Thick" },
  { value: 12, label: "Extra Thick" },
];

const DEFAULT_NOTE_SIZE = { w: 180, h: 100 };
const MIN_NOTE_SIZE = { w: 120, h: 60 };
const MAX_NOTE_SIZE = { w: 400, h: 400 };

type UndoAction =
  | { type: "add"; annotation: Annotation; serverId?: string }
  | { type: "delete"; annotation: Annotation };

export default function AnnotationLayer({
  mapId, readOnly = false, currentUserId,
  viewport = { x: 0, y: 0, zoom: 1 },
}: AnnotationLayerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [addMode, setAddMode] = useState<"note" | "drawing" | "eraser" | null>(null);
  const [newNote, setNewNote] = useState("");
  const [placingAt, setPlacingAt] = useState<{ x: number; y: number } | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const layerRef = useRef<HTMLDivElement>(null);

  // Dragging sticky notes
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Resizing sticky notes
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStart = useRef<{ mouseX: number; mouseY: number; w: number; h: number } | null>(null);

  // Sticky note mousedown placement tracking
  const noteMouseDown = useRef<{ x: number; y: number; time: number } | null>(null);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  const vp = viewport;

  // Convert screen-relative coordinates to flow coordinates
  const screenToFlow = (screenX: number, screenY: number) => ({
    x: (screenX - vp.x) / vp.zoom,
    y: (screenY - vp.y) / vp.zoom,
  });

  const pushUndo = (action: UndoAction) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]);
  };

  // Track when we're actively moving/resizing to suppress polling overwrites
  const suppressFetchUntil = useRef(0);

  const fetchAnnotations = useCallback(async () => {
    // Don't overwrite local state while dragging/resizing or right after
    if (Date.now() < suppressFetchUntil.current) return;
    try {
      const data = await mapsApi.getAnnotations(mapId);
      setAnnotations(data as Annotation[]);
    } catch { /* silent */ }
  }, [mapId]);

  useEffect(() => {
    fetchAnnotations();
    const interval = setInterval(fetchAnnotations, 8000);
    return () => clearInterval(interval);
  }, [fetchAnnotations]);

  // ── Undo ──
  const handleUndo = async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action) return;
    setUndoStack(prev => prev.slice(0, -1));
    if (action.type === "add") {
      const id = action.serverId || action.annotation.id;
      try { await mapsApi.deleteAnnotation(mapId, id); } catch { /* silent */ }
      setAnnotations(prev => prev.filter(a => a.id !== id && a.id !== action.annotation.id));
      setRedoStack(prev => [...prev, { type: "add", annotation: action.annotation, serverId: action.serverId }]);
    } else if (action.type === "delete") {
      try {
        const result = await mapsApi.createAnnotation(mapId, {
          type: action.annotation.type, content: action.annotation.content,
          position: action.annotation.position, color: action.annotation.color,
          path: action.annotation.path,
        });
        const restoredId = (result as { id?: string }).id || `restored-${Date.now()}`;
        const restored = { ...action.annotation, id: restoredId };
        setAnnotations(prev => [...prev, restored]);
        setRedoStack(prev => [...prev, { type: "delete", annotation: restored }]);
      } catch { /* silent */ }
    }
  };

  // ── Redo ──
  const handleRedo = async () => {
    const action = redoStack[redoStack.length - 1];
    if (!action) return;
    setRedoStack(prev => prev.slice(0, -1));
    if (action.type === "add") {
      try {
        const result = await mapsApi.createAnnotation(mapId, {
          type: action.annotation.type, content: action.annotation.content,
          position: action.annotation.position, color: action.annotation.color,
          path: action.annotation.path,
        });
        const newId = (result as { id?: string }).id || `redo-${Date.now()}`;
        const restored = { ...action.annotation, id: newId };
        setAnnotations(prev => [...prev, restored]);
        setUndoStack(prev => [...prev, { type: "add", annotation: restored, serverId: newId }]);
      } catch { /* silent */ }
    } else if (action.type === "delete") {
      try { await mapsApi.deleteAnnotation(mapId, action.annotation.id); } catch { /* silent */ }
      setAnnotations(prev => prev.filter(a => a.id !== action.annotation.id));
      setUndoStack(prev => [...prev, { type: "delete", annotation: action.annotation }]);
    }
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Sticky note: plain click drops the form (simpler & more reliable than mousedown/mouseup tracking) ──
  const handleLayerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode === "drawing") { handleDrawStart(e); return; }
  };

  const handleLayerMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode === "drawing") { handleDrawEnd(); return; }
    if (resizingId) { handleResizeEnd(); return; }
    if (draggingId) { handleDragEnd(); return; }
  };

  const handleLayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode !== "note" || placingAt || readOnly) return;
    // Ignore clicks that bubbled up from an existing sticky note / button
    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest("[data-annotation-child]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const flow = screenToFlow(e.clientX - rect.left, e.clientY - rect.top);
    setPlacingAt(flow);
    setNewNote("");
  };

  const handleLayerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode === "drawing") { handleDrawMove(e); return; }
    if (resizingId) { handleResizeMove(e); return; }
    if (draggingId) { handleDragMove(e); return; }
  };

  const handleLayerMouseLeave = () => {
    if (addMode === "drawing") { handleDrawEnd(); return; }
    if (resizingId) { handleResizeEnd(); return; }
    if (draggingId) { handleDragEnd(); return; }
    noteMouseDown.current = null;
  };

  // Global mouseup listener — fixes sticky note still following cursor
  // when mouse is released outside the layer div or browser loses focus
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingId) {
        if (didDrag.current) {
          const ann = annotations.find(a => a.id === draggingId);
          if (ann) { mapsApi.updateAnnotation(mapId, ann.id, { position: ann.position }).catch(() => {}); }
        }
        setDraggingId(null);
        dragStartPos.current = null;
        suppressFetchUntil.current = Date.now() + 2000;
      }
      if (resizingId) {
        const ann = annotations.find(a => a.id === resizingId);
        if (ann?.size) { mapsApi.updateAnnotation(mapId, ann.id, { size: ann.size }).catch(() => {}); }
        setResizingId(null);
        resizeStart.current = null;
        suppressFetchUntil.current = Date.now() + 2000;
      }
      if (isDrawing) {
        handleDrawEnd();
      }
      noteMouseDown.current = null;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("pointerup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("pointerup", handleGlobalMouseUp);
    };
  });

  const handleConfirmNote = async () => {
    if (!placingAt || !newNote.trim()) return;
    const optimistic: Annotation = {
      id: `temp-${Date.now()}`, authorId: currentUserId, authorName: "",
      type: "note", content: newNote, position: placingAt, size: DEFAULT_NOTE_SIZE,
      color: "#fbbf24", createdAt: new Date().toISOString(),
    };
    try {
      const result = await mapsApi.createAnnotation(mapId, {
        type: "note", content: newNote, position: placingAt, color: "#fbbf24",
      });
      const serverId = (result as { id?: string }).id || optimistic.id;
      optimistic.id = serverId;
      setAnnotations(prev => [...prev, optimistic]);
      pushUndo({ type: "add", annotation: optimistic, serverId });
      setNewNote("");
      setPlacingAt(null);
      setTimeout(fetchAnnotations, 500);
    } catch { /* silent */ }
  };

  // ── Freehand drawing (stored in flow coordinates) ──
  const pointsToSvgPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
  };

  const handleDrawStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (addMode !== "drawing" || readOnly) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const flow = screenToFlow(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setDrawPoints([flow]);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || addMode !== "drawing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const flow = screenToFlow(e.clientX - rect.left, e.clientY - rect.top);
    setDrawPoints(prev => [...prev, flow]);
  };

  const handleDrawEnd = async () => {
    if (!isDrawing || drawPoints.length < 2) { setIsDrawing(false); setDrawPoints([]); return; }
    setIsDrawing(false);
    const path = pointsToSvgPath(drawPoints);
    const xs = drawPoints.map(p => p.x);
    const ys = drawPoints.map(p => p.y);
    const pos = { x: Math.min(...xs), y: Math.min(...ys) };

    const tempId = `pending-${Date.now()}`;
    const temp: Annotation = {
      id: tempId, authorId: currentUserId, authorName: "", type: "drawing",
      content: String(strokeWidth), position: pos, color: "#ef4444",
      path, strokeWidth, createdAt: new Date().toISOString(),
    };
    setAnnotations(prev => [...prev, temp]);
    setDrawPoints([]);

    try {
      const result = await mapsApi.createAnnotation(mapId, {
        type: "drawing", content: String(strokeWidth), position: pos, color: "#ef4444", path,
      });
      const serverId = (result as { id?: string }).id || tempId;
      setAnnotations(prev => prev.map(a => a.id === tempId ? { ...a, id: serverId } : a));
      pushUndo({ type: "add", annotation: { ...temp, id: serverId }, serverId });
      setTimeout(fetchAnnotations, 500);
    } catch {
      setAnnotations(prev => prev.filter(a => a.id !== tempId));
    }
  };

  // ── Eraser ──
  const handleEraserClick = async (ann: Annotation) => {
    if (addMode !== "eraser" || readOnly) return;
    pushUndo({ type: "delete", annotation: ann });
    setAnnotations(prev => prev.filter(a => a.id !== ann.id));
    try { await mapsApi.deleteAnnotation(mapId, ann.id); } catch { /* silent */ }
  };

  // ── Drag sticky notes (in flow coordinates) ──
  const handleDragStart = (e: React.MouseEvent, ann: Annotation) => {
    if (readOnly || ann.authorId !== currentUserId || addMode === "eraser" || resizingId) return;
    e.stopPropagation(); e.preventDefault();
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingId(ann.id);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    suppressFetchUntil.current = Date.now() + 60000; // suppress during drag
    // Offset in screen px between mouse and annotation's screen position
    const annScreenX = ann.position.x * vp.zoom + vp.x;
    const annScreenY = ann.position.y * vp.zoom + vp.y;
    setDragOffset({ x: e.clientX - rect.left - annScreenX, y: e.clientY - rect.top - annScreenY });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx < 3 && dy < 3) return;
      didDrag.current = true;
    }
    const screenX = e.clientX - rect.left - dragOffset.x;
    const screenY = e.clientY - rect.top - dragOffset.y;
    const flow = screenToFlow(screenX, screenY);
    setAnnotations(prev => prev.map(a => a.id === draggingId ? { ...a, position: flow } : a));
  };

  const handleDragEnd = async () => {
    if (!draggingId) return;
    if (didDrag.current) {
      const ann = annotations.find(a => a.id === draggingId);
      if (ann) { try { await mapsApi.updateAnnotation(mapId, ann.id, { position: ann.position }); } catch { /* */ } }
    }
    setDraggingId(null); dragStartPos.current = null;
    // Allow fetching again after server has time to persist
    suppressFetchUntil.current = Date.now() + 2000;
  };

  // ── Resize sticky notes ──
  const handleResizeStart = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation(); e.preventDefault();
    setResizingId(ann.id);
    const sz = ann.size || DEFAULT_NOTE_SIZE;
    resizeStart.current = { mouseX: e.clientX, mouseY: e.clientY, w: sz.w, h: sz.h };
    suppressFetchUntil.current = Date.now() + 60000;
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!resizingId || !resizeStart.current) return;
    // Scale delta by zoom so resize feels natural
    const dw = (e.clientX - resizeStart.current.mouseX) / vp.zoom;
    const dh = (e.clientY - resizeStart.current.mouseY) / vp.zoom;
    const newW = Math.max(MIN_NOTE_SIZE.w, Math.min(MAX_NOTE_SIZE.w, resizeStart.current.w + dw));
    const newH = Math.max(MIN_NOTE_SIZE.h, Math.min(MAX_NOTE_SIZE.h, resizeStart.current.h + dh));
    setAnnotations(prev => prev.map(a => a.id === resizingId ? { ...a, size: { w: newW, h: newH } } : a));
  };

  const handleResizeEnd = async () => {
    if (!resizingId) return;
    const ann = annotations.find(a => a.id === resizingId);
    if (ann?.size) {
      try { await mapsApi.updateAnnotation(mapId, ann.id, { size: ann.size }); } catch { /* */ }
    }
    setResizingId(null); resizeStart.current = null;
    suppressFetchUntil.current = Date.now() + 2000;
  };

  const handleDelete = async (annId: string) => {
    const ann = annotations.find(a => a.id === annId);
    if (ann) pushUndo({ type: "delete", annotation: ann });
    setAnnotations(prev => prev.filter(a => a.id !== annId));
    try { await mapsApi.deleteAnnotation(mapId, annId); } catch { /* silent */ }
  };

  const getStrokeWidth = (ann: Annotation): number => {
    if (ann.strokeWidth) return ann.strokeWidth;
    const parsed = parseInt(ann.content);
    return parsed && parsed >= 1 && parsed <= 20 ? parsed : 4;
  };

  const isEraserMode = addMode === "eraser";
  const btnClass = "flex items-center justify-center w-10 h-10 rounded-xl transition-all";

  return (
    <div
      ref={layerRef}
      className={clsx(
        "absolute inset-0 z-10",
        addMode ? "pointer-events-auto" : "pointer-events-none",
        addMode === "note" && !placingAt && "cursor-crosshair",
        addMode === "drawing" && "cursor-crosshair",
        addMode === "eraser" && "cursor-crosshair",
      )}
      onMouseDown={handleLayerMouseDown}
      onMouseMove={handleLayerMouseMove}
      onMouseUp={handleLayerMouseUp}
      onMouseLeave={handleLayerMouseLeave}
      onClick={handleLayerClick}
    >
      {/* ═══ Viewport-synced content (moves/scales with the map) ═══ */}
      <div
        className="absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}
      >
        {/* SVG drawings */}
        <svg className="absolute overflow-visible pointer-events-none" style={{ zIndex: 1, width: 1, height: 1 }}>
          {annotations.filter(a => a.type === "drawing" && a.path).map(ann => {
            const sw = getStrokeWidth(ann);
            return (
              <g key={ann.id} className={clsx("group", "pointer-events-auto")}>
                <path d={ann.path!} fill="none" stroke="transparent" strokeWidth={sw + 10}
                  className={isEraserMode ? "cursor-pointer" : ""}
                  onClick={isEraserMode ? (e) => { e.stopPropagation(); handleEraserClick(ann); } : undefined}
                />
                <path d={ann.path!} fill="none" stroke={ann.color} strokeWidth={sw}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.8}
                  className={clsx("drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]", isEraserMode && "hover:opacity-30 transition-opacity")}
                  onClick={isEraserMode ? (e) => { e.stopPropagation(); handleEraserClick(ann); } : undefined}
                />
                {!readOnly && !isEraserMode && ann.authorId === currentUserId && (
                  <foreignObject x={ann.position.x - 10} y={ann.position.y - 22} width={20} height={20} className="overflow-visible">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(ann.id); }}
                      className="hidden group-hover:flex w-5 h-5 rounded-full bg-red-600 items-center justify-center shadow-lg">
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </foreignObject>
                )}
              </g>
            );
          })}
          {/* Live drawing preview */}
          {isDrawing && drawPoints.length >= 2 && (
            <path d={pointsToSvgPath(drawPoints)} fill="none" stroke="#ef4444"
              strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
          )}
        </svg>

        {/* Sticky notes */}
        {annotations.filter(a => a.type === "note").map(ann => {
          const noteSize = ann.size || DEFAULT_NOTE_SIZE;
          const isOwner = ann.authorId === currentUserId;
          return (
            <div
              key={ann.id}
              className={clsx(
                "absolute pointer-events-auto group",
                isEraserMode ? "cursor-pointer" : (!readOnly && isOwner && "cursor-grab active:cursor-grabbing"),
                isEraserMode && "hover:opacity-30 transition-opacity",
              )}
              style={{ left: ann.position.x, top: ann.position.y, zIndex: draggingId === ann.id || resizingId === ann.id ? 50 : 2 }}
              data-annotation-child
              onMouseDown={isEraserMode ? undefined : (e) => handleDragStart(e, ann)}
              onClick={isEraserMode ? (e) => { e.stopPropagation(); handleEraserClick(ann); } : (e) => e.stopPropagation()}
            >
              <div className="relative">
                <div className="rounded-md shadow-lg shadow-black/20 dark:shadow-black/40 overflow-hidden"
                  style={{ backgroundColor: "#fbbf24", width: noteSize.w, minHeight: noteSize.h, transform: "rotate(-1deg)" }}>
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-5 bg-white/40 rounded-sm" style={{ transform: "rotate(2deg)" }} />
                  <div className="p-3 pt-4">
                    <p className="text-[10px] font-bold text-amber-900 dark:text-amber-100">{ann.authorName}</p>
                    <p className="text-xs mt-1 break-words leading-relaxed text-amber-950 dark:text-amber-50">{ann.content}</p>
                  </div>
                </div>
                {/* Resize handle */}
                {!readOnly && !isEraserMode && isOwner && (
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onMouseDown={(e) => handleResizeStart(e, ann)}
                    title="Drag to resize"
                  >
                    <GripVertical className="w-3 h-3 text-amber-800/60 dark:text-amber-200/60 rotate-[-45deg]" />
                  </div>
                )}
                {/* Delete button */}
                {!readOnly && !isEraserMode && isOwner && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(ann.id); }}
                    className="absolute -top-2 -right-2 hidden group-hover:flex w-5 h-5 rounded-full bg-red-500 items-center justify-center shadow-lg z-10">
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Note placement form (positioned in flow coordinates) */}
        <AnimatePresence>
          {placingAt && addMode === "note" && (
            <motion.div
              key={`form-${placingAt.x}-${placingAt.y}`}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="absolute pointer-events-auto z-30"
              style={{ left: placingAt.x, top: placingAt.y }}
              onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}
            >
              <div className="w-[200px] rounded-md shadow-xl" style={{ backgroundColor: "#fbbf24" }}>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-5 bg-white/40 rounded-sm" style={{ transform: "rotate(2deg)" }} />
                <div className="p-3 pt-4">
                  <textarea placeholder="Write your note..." value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full bg-amber-300/50 text-sm px-2 py-1.5 rounded border-0 outline-none resize-none text-amber-950 dark:text-amber-50 placeholder:text-amber-800/60 dark:placeholder:text-amber-200/60"
                    rows={3} autoFocus
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConfirmNote(); } }}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={handleConfirmNote} disabled={!newNote.trim()}
                      className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded font-medium disabled:opacity-40 transition-colors">
                      Drop Note
                    </button>
                    <button onClick={() => { setPlacingAt(null); setNewNote(""); }}
                      className="px-2 py-1.5 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ FIXED UI (not affected by viewport zoom/pan) ═══ */}

      {/* Toolbar — bottom right */}
      {!readOnly && (
        <div className="absolute bottom-4 right-4 pointer-events-auto z-30 flex flex-col items-end gap-2">
          {/* Thickness picker */}
          <AnimatePresence>
            {addMode === "drawing" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/90 dark:bg-dark-800/90 backdrop-blur-md border border-gray-200 dark:border-dark-600/40 shadow-lg">
                <Minus className="w-3.5 h-3.5 text-gray-400 dark:text-dark-400" />
                {THICKNESS_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={(e) => { e.stopPropagation(); setStrokeWidth(opt.value); }}
                    className={clsx("flex items-center justify-center w-7 h-7 rounded-lg transition-all",
                      strokeWidth === opt.value ? "bg-red-500/20 ring-1 ring-red-400" : "hover:bg-gray-100 dark:hover:bg-dark-700/60")}
                    title={opt.label}>
                    <div className="rounded-full bg-red-500" style={{ width: opt.value + 2, height: opt.value + 2 }} />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main toolbar row */}
          <div className="flex items-center gap-1.5 px-2 py-2 rounded-2xl bg-white/90 dark:bg-dark-800/90 backdrop-blur-md border border-gray-200 dark:border-dark-600/40 shadow-lg">
            {/* Undo */}
            <button
              onClick={(e) => { e.stopPropagation(); handleUndo(); }}
              disabled={undoStack.length === 0}
              className={clsx(btnClass, "text-gray-500 dark:text-dark-300 disabled:opacity-30 disabled:cursor-not-allowed", undoStack.length > 0 && "hover:bg-gray-100 dark:hover:bg-dark-700/60")}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4.5 h-4.5" />
            </button>

            {/* Redo */}
            <button
              onClick={(e) => { e.stopPropagation(); handleRedo(); }}
              disabled={redoStack.length === 0}
              className={clsx(btnClass, "text-gray-500 dark:text-dark-300 disabled:opacity-30 disabled:cursor-not-allowed", redoStack.length > 0 && "hover:bg-gray-100 dark:hover:bg-dark-700/60")}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4.5 h-4.5" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-300 dark:bg-dark-500/50 mx-0.5" />

            {/* Sticky Note */}
            <button
              onClick={(e) => { e.stopPropagation(); setAddMode(addMode === "note" ? null : "note"); setPlacingAt(null); setNewNote(""); }}
              className={clsx(btnClass, addMode === "note" ? "bg-amber-500/20 ring-2 ring-amber-400 text-amber-500" : "hover:bg-gray-100 dark:hover:bg-dark-700/60 text-gray-500 dark:text-dark-300")}
              title="Sticky Note"
            >
              <StickyNote className="w-4.5 h-4.5" />
            </button>

            {/* Highlight / Draw */}
            <button
              onClick={(e) => { e.stopPropagation(); setAddMode(addMode === "drawing" ? null : "drawing"); setDrawPoints([]); setIsDrawing(false); }}
              className={clsx(btnClass, addMode === "drawing" ? "bg-red-500/20 ring-2 ring-red-400 text-red-400" : "hover:bg-gray-100 dark:hover:bg-dark-700/60 text-gray-500 dark:text-dark-300")}
              title="Highlight / Draw"
            >
              <Pencil className="w-4.5 h-4.5" />
            </button>

            {/* Eraser */}
            <button
              onClick={(e) => { e.stopPropagation(); setAddMode(addMode === "eraser" ? null : "eraser"); }}
              className={clsx(btnClass, addMode === "eraser" ? "bg-purple-500/20 ring-2 ring-purple-400 text-purple-400" : "hover:bg-gray-100 dark:hover:bg-dark-700/60 text-gray-500 dark:text-dark-300")}
              title="Eraser"
            >
              <Eraser className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mode banner */}
      <AnimatePresence>
        {addMode && !placingAt && !isDrawing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-30">
            <div className="px-4 py-2 rounded-xl text-sm font-medium bg-white/90 dark:bg-dark-800/90 backdrop-blur-md text-gray-600 dark:text-dark-200 border border-gray-200 dark:border-dark-600/40 shadow-lg">
              {addMode === "drawing" ? "Click and drag to draw on the map"
                : addMode === "eraser" ? "Click on any annotation to erase it"
                : "Click anywhere to drop a sticky note"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
