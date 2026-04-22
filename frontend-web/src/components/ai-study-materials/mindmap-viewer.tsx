"use client";

import React from "react";

interface MindmapViewerProps {
  content: string;
}

interface Branch {
  label: string;
  children?: string[];
}

interface Tree {
  root?: string;
  branches?: Branch[];
}

export default function MindmapViewer({ content }: MindmapViewerProps) {
  let tree: Tree = {};
  try {
    tree = JSON.parse(content);
  } catch {
    return <pre className="text-sm text-dark-200 whitespace-pre-wrap">{content}</pre>;
  }

  const branches = tree.branches || [];

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-dark-400 mb-1">Central Topic</div>
        <div className="text-lg font-semibold text-accent-blue">{tree.root || "Untitled"}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {branches.map((b, i) => (
          <div key={i} className="glass-card p-4">
            <div className="font-medium text-dark-100 mb-2">{b.label}</div>
            <ul className="space-y-1">
              {(b.children || []).map((c, j) => (
                <li key={j} className="text-sm text-dark-300 flex gap-2">
                  <span className="text-accent-blue/60">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
