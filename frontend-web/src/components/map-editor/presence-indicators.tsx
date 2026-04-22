"use client";

import { useState, useEffect, useCallback } from "react";
import { mapsApi } from "@/lib/api";
import { resolveBackendUrl } from "@/lib/utils";

interface PresenceUser {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  lockedNodeId: string | null;
}

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

interface PresenceIndicatorsProps {
  mapId: string | null;
  currentUserId: string;
  lockedNodeId?: string | null;
}

export default function PresenceIndicators({ mapId, currentUserId, lockedNodeId }: PresenceIndicatorsProps) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  const sendHeartbeat = useCallback(async () => {
    if (!mapId) return;
    try {
      await mapsApi.updatePresence(mapId, { locked_node_id: lockedNodeId || null });
    } catch { /* silent */ }
  }, [mapId, lockedNodeId]);

  const fetchPresence = useCallback(async () => {
    if (!mapId) return;
    try {
      const data = await mapsApi.getPresence(mapId);
      setUsers(data.filter((u) => u.userId !== currentUserId));
    } catch { /* silent */ }
  }, [mapId, currentUserId]);

  useEffect(() => {
    sendHeartbeat();
    fetchPresence();
    const heartbeat = setInterval(sendHeartbeat, 5000);
    const presence = setInterval(fetchPresence, 5000);
    return () => {
      clearInterval(heartbeat);
      clearInterval(presence);
    };
  }, [sendHeartbeat, fetchPresence]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {users.map((u, i) => (
        <div
          key={u.userId}
          className="relative group"
          title={u.displayName}
        >
          <img
            src={resolveBackendUrl(u.photoURL) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=${COLORS[i % COLORS.length].slice(1)}&color=fff&size=28`}
            alt={u.displayName}
            className="w-7 h-7 rounded-full ring-2"
            style={{ ["--tw-ring-color" as string]: COLORS[i % COLORS.length] }}
          />
          {/* Animated online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-dark-800 bg-emerald-400" />
          </span>
          {/* Tooltip */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap px-2 py-1 rounded-md bg-dark-700 text-[10px] text-white z-10">
            {u.displayName}
            {u.lockedNodeId && <span className="text-accent-amber"> (editing)</span>}
          </div>
        </div>
      ))}
      {/* Collaborator count badge */}
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        {users.length} online
      </span>
    </div>
  );
}

export function useLockedNodes(mapId: string | null, currentUserId: string) {
  const [lockedNodes, setLockedNodes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!mapId) return;
    const poll = async () => {
      try {
        const data = await mapsApi.getPresence(mapId);
        const locks = new Map<string, string>();
        for (const u of data) {
          if (u.lockedNodeId && u.userId !== currentUserId) {
            locks.set(u.lockedNodeId, u.displayName);
          }
        }
        setLockedNodes(locks);
      } catch { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [mapId, currentUserId]);

  return lockedNodes;
}
