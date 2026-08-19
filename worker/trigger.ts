import { loadEnvConfig } from "@next/env";
import { STORE_IDS, getCollector } from "@/collectors/registry";
import { closeRedisConnection, getSharedRedisConnection } from "@/lib/queue/redis";
import { getPriceCollectionQueue } from "@/worker/queue";

loadEnvConfig(process.cwd());

/**
 * Manual trigger for development/testing: enqueues one job the same way the scheduler does,
 * so it runs through the exact same worker code path (`npm run queue:evo-store`). This requires
 * a running worker (`npm run worker:dev`) to actually pick the job up; for a no-Redis manual run
 * use `npm run collect:evo` / `npm run collect:itti` instead.
 */
async function main() {
  const storeId = process.argv[2];
  if (!storeId) throw new Error(`usage: tsx worker/trigger.ts <storeId>\nknown stores: ${STORE_IDS.join(", ")}`);
  getCollector(storeId); // throws a clear error for an unknown storeId before touching Redis
  const queue = getPriceCollectionQueue();
  const job = await queue.add("collect", { storeId }, { jobId: `manual-${storeId}-${Date.now()}` });
  console.log(`Queued manual collection for "${storeId}" (job ${job.id}). Make sure the worker is running: npm run worker:dev`);
  await queue.close();
  await closeRedisConnection(getSharedRedisConnection());
}

main().catch((error) => {
  console.error(`Failed to queue job: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
