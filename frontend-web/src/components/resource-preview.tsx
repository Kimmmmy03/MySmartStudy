"use client";

import { useState, useRef, useEffect } from "react";
import { ModuleItemOut } from "@/lib/api";
import { X, ExternalLink, FileText, Video, Link as LinkIcon, File, Globe, AlertCircle, Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

const GEN_OPTS = [
  { type: "summary" as const, label: "Summary Notes" },
  { type: "flashcards" as const, label: "Flashcards" },
  { type: "quiz" as const, label: "Practice Quiz" },
];

interface ResourcePreviewProps {
  item: ModuleItemOut | null;
  onClose: () => void;
  onGenerate?: (itemId: string, type: "summary" | "flashcards" | "quiz") => void;
  generatingId?: string | null;
  canGenerate?: boolean;
}

/** Generate an embed URL for a resource based on its type and URL */
function getEmbedUrl(item: ModuleItemOut): string | null {
  if (item.embed_url) return item.embed_url;

  const url = item.url || "";
  const urlLower = url.toLowerCase();

  if (item.file_path) {
    return `${API_BASE}/${item.file_path}`;
  }

  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false`;
  }

  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return `https://docs.google.com/document/d/${docsMatch[1]}/pub?embedded=true`;
  }

  const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetsMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/pubhtml?widget=true`;
  }

  const formsMatch = url.match(/docs\.google\.com\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (formsMatch) {
    return `https://docs.google.com/forms/d/${formsMatch[1]}/viewform?embedded=true`;
  }

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  if (urlLower.endsWith(".pdf")) {
    return url;
  }

  return null;
}

function getTypeLabel(item: ModuleItemOut): string {
  const ftype = item.file_type || item.type;
  const labels: Record<string, string> = {
    pdf: "PDF Document", video: "Video", link: "External Link", doc: "Document",
    slides: "Google Slides", google_slides: "Google Slides", document: "Document",
    google_doc: "Google Document", form: "Google Form", google_form: "Google Form",
    spreadsheet: "Spreadsheet", google_sheets: "Google Sheets", youtube: "YouTube Video",
    content: "Text Content", image: "Image", drive_file: "Google Drive File",
    drive_folder: "Google Drive Folder", padlet: "Padlet", canva: "Canva Design",
    kahoot: "Kahoot", quizizz: "Quizizz", mentimeter: "Mentimeter",
  };
  return labels[ftype] || ftype || "Resource";
}

function getTypeIcon(item: ModuleItemOut) {
  const ftype = item.file_type || item.type;
  if (["video", "youtube"].includes(ftype)) return Video;
  if (["link", "padlet", "canva", "kahoot", "quizizz", "mentimeter"].includes(ftype)) return Globe;
  if (ftype === "content") return FileText;
  return File;
}

export default function ResourcePreview({ item, onClose, onGenerate, generatingId, canGenerate }: ResourcePreviewProps) {
  const [showGenMenu, setShowGenMenu] = useState(false);
  const genRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (genRef.current && !genRef.current.contains(e.target as Node)) {
        setShowGenMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!item) return null;

  const embedUrl = getEmbedUrl(item);
  const hasUrl = item.url && item.url.trim() !== "" && !item.url.includes("sites.google.com");
  const Icon = getTypeIcon(item);
  const isGenerating = generatingId === item.id;

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <div className="relative w-full h-full bg-dark-900 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-dark-800/50 shrink-0">
              <Icon className="w-5 h-5 text-accent-purple shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-dark-100 truncate">{item.title}</h3>
                <p className="text-xs text-dark-400">{getTypeLabel(item)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Generate button */}
                {canGenerate && onGenerate && (
                  <div className="relative" ref={genRef}>
                    {isGenerating ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      <button
                        onClick={() => setShowGenMenu(!showGenMenu)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                    {showGenMenu && (
                      <div className="absolute top-full right-0 mt-1 w-44 rounded-xl glass-card py-1 shadow-xl z-50 border border-white/10">
                        {GEN_OPTS.map(opt => (
                          <button
                            key={opt.type}
                            onClick={() => {
                              setShowGenMenu(false);
                              onGenerate(item.id, opt.type);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-dark-200 hover:bg-white/5 hover:text-dark-100 transition-colors"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {hasUrl && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-purple/10 text-accent-purple border border-accent-purple/20 hover:bg-accent-purple/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Original
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-lg text-dark-400 hover:text-dark-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                  title={item.title}
                />
              ) : item.type === "content" && item.description ? (
                <div className="p-6 overflow-auto h-full">
                  <div className="prose prose-invert max-w-none">
                    <div className="text-dark-200 whitespace-pre-wrap leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                </div>
              ) : hasUrl ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-accent-purple" />
                  </div>
                  <p className="text-dark-200 text-center max-w-md">
                    This resource cannot be previewed inline. Click the button below to open it in a new tab.
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gradient relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </span>
                  </a>
                  <p className="text-xs text-dark-500 mt-2 break-all max-w-md text-center">{item.url}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-dark-200 text-center max-w-md">
                    This is a content-only item with no external link.
                  </p>
                  {item.description && (
                    <div className="mt-4 p-4 bg-white/5 rounded-xl max-w-lg w-full">
                      <p className="text-sm text-dark-300 whitespace-pre-wrap">{item.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer with URL */}
            {hasUrl && (
              <div className="px-6 py-3 border-t border-white/10 bg-dark-800/50 shrink-0">
                <p className="text-xs text-dark-500 truncate" title={item.url}>
                  {item.url}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
