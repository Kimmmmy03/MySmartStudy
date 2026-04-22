"use client";

import { motion } from "framer-motion";
import { Map, Pencil, Trash2, Users } from "lucide-react";

interface MapCardProps {
  title: string;
  thumbnail?: string;
  lastModified: string;
  collaborators?: string[];
  ownerEmail?: string;
  onClick?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export default function MapCard({ title, thumbnail, lastModified, collaborators, ownerEmail, onClick, onRename, onDelete, showActions = false }: MapCardProps) {
  const hasCollaborators = collaborators && collaborators.length > 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group glass-card overflow-hidden cursor-pointer"
    >
      <div className="h-[150px] bg-dark-700 flex items-center justify-center overflow-hidden relative">
        {thumbnail && thumbnail !== "" ? (
          <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Map className="w-10 h-10 text-dark-400" />
          </div>
        )}
        {/* Collaboration badge */}
        {hasCollaborators && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-purple/80 backdrop-blur-sm text-white text-[10px] font-medium shadow-sm">
            <Users className="w-3 h-3" />
            <span>Collaboration</span>
          </div>
        )}
        {showActions && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onRename && (
              <button
                onClick={e => { e.stopPropagation(); onRename(); }}
                className="w-8 h-8 rounded-lg bg-dark-800/80 backdrop-blur-sm flex items-center justify-center text-dark-200 hover:text-accent-blue hover:bg-dark-700 transition-colors"
                title="Rename"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="w-8 h-8 rounded-lg bg-dark-800/80 backdrop-blur-sm flex items-center justify-center text-dark-200 hover:text-red-400 hover:bg-dark-700 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="p-3">
        <h4 className="font-medium text-dark-100 text-sm truncate">{title}</h4>
        {ownerEmail && (
          <p className="text-[10px] text-dark-400 mt-0.5 truncate">
            Owner: <span className="text-dark-300">{ownerEmail}</span>
          </p>
        )}
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-dark-400">{lastModified}</p>
          {hasCollaborators && (
            <span className="text-[10px] text-accent-purple flex items-center gap-1">
              <Users className="w-3 h-3" /> Shared
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
