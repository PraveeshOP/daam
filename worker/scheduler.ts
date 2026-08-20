import { STORE_IDS } from "@/collectors/registry";
import { log } from "@/lib/logger";
import { getPriceCollectionQueue } from "@/lib/queue/priceCollection";

/** 6h by default (conservative, per spec section 9). Change with COLLECTION_INTERVAL_HOURS —
 * no worker code changes needed to go from 6h to 12h/24h. */
export function collectionIntervalMs() {
  const hours = Number(process.env.COLLECTION_INTERVAL_HOURS || 6);
  return Math.max(hours, 0.05) * 60 * 60 * 1000;
}

/**
 * Registers one repeatable job per store using BullMQ's job scheduler API. `upsertJobScheduler`
 * is idempotent by schedulerId: calling it again on every worker start updates the existing
 * schedule instead of creating a second recurring job, so restarts never duplicate jobs
 * (spec section 10).
 */
export async function scheduleRecurringCollections() {
  const queue = getPriceCollectionQueue();
  const every = collectionIntervalMs();
  for (const storeId of STORE_IDS) {
    await queue.upsertJobScheduler(`schedule:${storeId}`, { every }, { name: "collect", data: { storeId } });
    log("scheduler", `${storeId} scheduled every ${Math.round(every / 60_000)}m`);
  }
}
