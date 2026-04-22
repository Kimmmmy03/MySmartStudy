"use client";

import React from "react";
import { motion } from "framer-motion";

interface SummaryViewerProps {
  content: string;
}

export default function SummaryViewer({ content }: SummaryViewerProps) {
  // Basic markdown-like formatting
  const renderContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Section headers (## or bold lines)
      if (line.startsWith("## ")) {
        return (
          <h2 key={i} className="text-lg font-bold text-white mt-6 mb-2">
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={i} className="text-base font-semibold text-dark-100 mt-4 mb-1.5">
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h1 key={i} className="text-xl font-bold text-white mt-6 mb-3">
            {line.replace("# ", "")}
          </h1>
        );
      }

      // Bullet points
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const bullet = line.trim().replace(/^[-*]\s/, "");
        return (
          <div key={i} className="flex items-start gap-2 ml-4 my-1">
            <span className="text-accent-blue mt-1.5 text-xs">&#9679;</span>
            <span className="text-dark-200 text-sm leading-relaxed">{renderInline(bullet)}</span>
          </div>
        );
      }

      // Numbered lists
      const numberedMatch = line.trim().match(/^(\d+)\.\s(.+)/);
      if (numberedMatch) {
        return (
          <div key={i} className="flex items-start gap-2 ml-4 my-1">
            <span className="text-accent-blue text-sm font-semibold min-w-[1.25rem]">{numberedMatch[1]}.</span>
            <span className="text-dark-200 text-sm leading-relaxed">{renderInline(numberedMatch[2])}</span>
          </div>
        );
      }

      // Empty line
      if (line.trim() === "") {
        return <div key={i} className="h-2" />;
      }

      // Regular paragraph
      return (
        <p key={i} className="text-dark-200 text-sm leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    });
  };

  // Inline formatting: **bold** and *italic* and `code`
  const renderInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Code `text`
      const codeMatch = remaining.match(/`(.+?)`/);

      let firstMatch: { index: number; length: number; type: "bold" | "code"; content: string } | null = null;

      if (boldMatch && boldMatch.index !== undefined) {
        firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: "bold", content: boldMatch[1] };
      }
      if (codeMatch && codeMatch.index !== undefined) {
        if (!firstMatch || codeMatch.index < firstMatch.index) {
          firstMatch = { index: codeMatch.index, length: codeMatch[0].length, type: "code", content: codeMatch[1] };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      if (firstMatch.index > 0) {
        parts.push(remaining.slice(0, firstMatch.index));
      }

      if (firstMatch.type === "bold") {
        parts.push(
          <span key={keyIdx++} className="font-semibold text-white">{firstMatch.content}</span>
        );
      } else {
        parts.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-white/10 text-accent-cyan text-xs font-mono">{firstMatch.content}</code>
        );
      }

      remaining = remaining.slice(firstMatch.index + firstMatch.length);
    }

    return <>{parts}</>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 max-h-[65vh] overflow-y-auto custom-scrollbar"
    >
      <div className="prose prose-invert max-w-none">
        {renderContent(content)}
      </div>
    </motion.div>
  );
}
