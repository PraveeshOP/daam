"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, AdminAuthError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { getPriceCollectionQueue } from "@/lib/queue/priceCollection";
import { getCollector } from "@/collectors/registry";

export type TriggerCollectionResult = { ok: true; message: string } | { error: string };

/**
 * §8: queues a job through the existing BullMQ queue — never runs the collector inside this
 * request. Checks for an already-queued/active job for the same store first, so clicking the
 * button twice (or while the schedule is also about to run it) can't pile up duplicate jobs;
 * the worker's own per-store lock (worker/lock.ts) is the second line of defense if a race
 * still gets two jobs enqueued.
 */
export async function triggerCollectionAction(storeId: string): Promise<TriggerCollectionResult> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (error) {
    return { error: error instanceof AdminAuthError ? error.message : "Not authorized." };
  }

  try {
    getCollector(storeId);
  } catch {
    return { error: "Unknown store." };
  }

  const queue = getPriceCollectionQueue();
  const [waiting, active, delayed] = await Promise.all([queue.getJobs(["waiting"]), queue.getJobs(["active"]), queue.getJobs(["delayed"])]);
  // "delayed" always contains the scheduler's own next-occurrence placeholder for every store
  // (repeatJobKey set) — that's not a duplicate to guard against, it's the schedule doing its
  // job. A delayed job WITHOUT a repeatJobKey is a genuine pending retry (failed attempt
  // awaiting backoff), which should still count.
  const genuinelyPendingDelayed = delayed.filter((job) => !job.repeatJobKey);
  const alreadyQueued = [...waiting, ...active, ...genuinelyPendingDelayed].some((job) => job.data.storeId === storeId);
  if (alreadyQueued) return { error: "A collection is already queued or running for this store." };

  await queue.add("collect", { storeId }, { jobId: `manual-${storeId}-${Date.now()}` });
  await logAdminAction(admin, "collection.trigger", "store", null, { storeId });
  revalidatePath("/admin/stores");
  revalidatePath("/admin/collections");
  revalidatePath("/admin");

  return { ok: true, message: "Collection queued." };
}
