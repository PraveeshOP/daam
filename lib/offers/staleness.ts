/**
 * Shared "how old is too old" threshold for a store's collected data — 4x the collection
 * interval. Originally lived only in lib/admin/stores.ts (admin-only); moved here so the public
 * product page can use the exact same rule to show a staleness note per offer (§I1, phase-9
 * audit) instead of admin and public pages silently drifting to two different definitions of
 * "stale." lib/admin/stores.ts re-exports this for existing imports.
 */
export function staleThresholdMs(): number {
  const hours = Number(process.env.COLLECTION_INTERVAL_HOURS || 6);
  return hours * 4 * 60 * 60 * 1000;
}

export function isStale(lastCheckedIso: string | null | undefined): boolean {
  if (!lastCheckedIso) return false;
  const checkedAt = new Date(lastCheckedIso).getTime();
  if (Number.isNaN(checkedAt)) return false;
  return Date.now() - checkedAt > staleThresholdMs();
}
