import { getStore } from '@netlify/blobs';

export interface StoredPoint {
  t: string;
  pm25: number;
}

const STORE_NAME = 'air-quality-trend';
const KEY = 'points';
const RETENTION_HOURS = 24;
const MIN_GAP_MINUTES = 4;

function store() {
  return getStore(STORE_NAME);
}

export async function appendPoint(point: StoredPoint): Promise<void> {
  const s = store();
  const existing = ((await s.get(KEY, { type: 'json' })) as StoredPoint[] | null) ?? [];

  const last = existing[existing.length - 1];
  if (last && new Date(point.t).getTime() - new Date(last.t).getTime() < MIN_GAP_MINUTES * 60 * 1000) {
    return;
  }

  const cutoff = Date.now() - RETENTION_HOURS * 3600 * 1000;
  const pruned = existing.filter((p) => new Date(p.t).getTime() >= cutoff);
  pruned.push(point);
  pruned.sort((a, b) => a.t.localeCompare(b.t));

  await s.setJSON(KEY, pruned);
}

export async function getRecentPoints(hours: number): Promise<StoredPoint[]> {
  const s = store();
  const existing = ((await s.get(KEY, { type: 'json' })) as StoredPoint[] | null) ?? [];
  const cutoff = Date.now() - hours * 3600 * 1000;
  return existing.filter((p) => new Date(p.t).getTime() >= cutoff).sort((a, b) => a.t.localeCompare(b.t));
}
