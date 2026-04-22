"use client";

import { useEffect, useRef, useCallback } from "react";
import { mapsApi } from "@/lib/api";
import type { Node, Edge } from "@xyflow/react";

interface UseCollaborationOptions {
  mapId: string | null;
  currentUserId: string;
  onRemoteUpdate: (nodes: Node[], edges: Edge[]) => void;
}

export function useCollaboration({ mapId, currentUserId, onRemoteUpdate }: UseCollaborationOptions) {
  const lastLocalSaveRef = useRef<string>("");
  const localDirtyRef = useRef(false);

  const setLastLocalSave = useCallback((data: string) => {
    lastLocalSaveRef.current = data;
    // Save completed — clear the dirty flag so polling can resume
    localDirtyRef.current = false;
  }, []);

  // Call this whenever local nodes/edges change to prevent poll from overwriting
  const markDirty = useCallback(() => {
    localDirtyRef.current = true;
  }, []);

  useEffect(() => {
    if (!mapId) return;

    const poll = async () => {
      // Skip remote updates while local changes are pending (not yet saved)
      if (localDirtyRef.current) return;

      try {
        const data = await mapsApi.get(mapId);

        // Skip if this is our own save
        if (data.graph_data === lastLocalSaveRef.current) return;

        // Skip if local edits happened while we were fetching
        if (localDirtyRef.current) return;

        if (data.graph_data) {
          try {
            const parsed = JSON.parse(data.graph_data);
            if (parsed.nodes) {
              onRemoteUpdate(parsed.nodes, parsed.edges || []);
            }
          } catch {
            // Invalid JSON
          }
        }
      } catch {
        // Silent — network error or map not found
      }
    };

    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [mapId, currentUserId, onRemoteUpdate]);

  return { setLastLocalSave, markDirty };
}
