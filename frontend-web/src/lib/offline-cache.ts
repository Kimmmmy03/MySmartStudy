import { get, set, del, keys } from "idb-keyval";

const PREFIX = "mss_map_";

export interface CachedMapData {
  mapId: string;
  title: string;
  graphData: string;
  nodesText: string;
  thumbnail: string;
  savedAt: number;
  synced: boolean;
}

export async function cacheMap(mapId: string, data: Omit<CachedMapData, "mapId" | "savedAt" | "synced">): Promise<void> {
  await set(`${PREFIX}${mapId}`, {
    mapId,
    ...data,
    savedAt: Date.now(),
    synced: false,
  } as CachedMapData);
}

export async function getCachedMap(mapId: string): Promise<CachedMapData | undefined> {
  return get<CachedMapData>(`${PREFIX}${mapId}`);
}

export async function markSynced(mapId: string): Promise<void> {
  const cached = await get<CachedMapData>(`${PREFIX}${mapId}`);
  if (cached) {
    await set(`${PREFIX}${mapId}`, { ...cached, synced: true });
  }
}

export async function getUnsyncedMaps(): Promise<CachedMapData[]> {
  const allKeys = await keys();
  const mapKeys = allKeys.filter((k) => String(k).startsWith(PREFIX));
  const results: CachedMapData[] = [];
  for (const k of mapKeys) {
    const data = await get<CachedMapData>(k);
    if (data && !data.synced) {
      results.push(data);
    }
  }
  return results;
}

export async function removeCachedMap(mapId: string): Promise<void> {
  await del(`${PREFIX}${mapId}`);
}
