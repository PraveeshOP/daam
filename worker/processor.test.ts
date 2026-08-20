import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Redis } from "ioredis";
import type { Job } from "bullmq";

/** Same minimal in-memory stand-in used by worker/lock.test.ts, duplicated locally to keep this
 * test self-contained. */
function createFakeRedis(): Redis {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const get = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) { store.delete(key); return null; }
    return entry.value;
  };
  return {
    async set(key: string, value: string, ...flags: unknown[]) {
      const pxIndex = flags.indexOf("PX");
      const ttlMs = pxIndex >= 0 ? Number(flags[pxIndex + 1]) : Infinity;
      const nx = flags.includes("NX");
      if (nx && get(key) !== null) return null;
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return "OK";
    },
    async eval(_script: string, _numKeys: number, key: string, token: string) {
      if (get(key) === token) { store.delete(key); return 1; }
      return 0;
    },
  } as unknown as Redis;
}

let resolveCollection: () => void;

vi.mock("@/collectors/registry", () => ({
  getCollector: () => ({ storeId: "fake-store", store: { name: "Fake Store" }, category: { name: "Test", slug: "test" }, collect: async () => ({ discovered: 0, products: [], errors: [] }) }),
}));

vi.mock("@/collectors/core/run", () => ({
  runStoreCollection: () =>
    new Promise((resolve) => {
      resolveCollection = () => resolve({ summary: { discovered: 0, priceChanges: 0, matchedProducts: 0, createdProducts: 0, createdOffers: 0, updatedOffers: 0, uncertainMatches: [], errors: [], priceAnomalies: [] }, durationMs: 1 });
    }),
  formatSummary: () => "",
}));

describe("processPriceCollectionJob — store lock vs. job timeout (§C1, phase-9 audit)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.COLLECTION_JOB_TIMEOUT_MS = "30";
  });
  afterEach(() => {
    delete process.env.COLLECTION_JOB_TIMEOUT_MS;
  });

  it("keeps the store lock held after a timeout, and only releases it once the abandoned work actually finishes", async () => {
    const { processPriceCollectionJob } = await import("@/worker/processor");
    const { acquireStoreLock } = await import("@/worker/lock");
    const redis = createFakeRedis();
    const job = { data: { storeId: "fake-store" }, id: "job-1" } as unknown as Job<{ storeId: string }>;

    const jobPromise = processPriceCollectionJob(job, redis);
    await expect(jobPromise).rejects.toThrow(/timed out/);

    // The mocked runStoreCollection is still "running" (its promise hasn't been resolved yet) —
    // a second collection for the same store must NOT be able to start.
    const secondAttempt = await acquireStoreLock(redis, "fake-store", 60_000);
    expect(secondAttempt).toBeNull();

    // Now let the abandoned work actually finish...
    resolveCollection();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // ...and only now should the lock be free again.
    const thirdAttempt = await acquireStoreLock(redis, "fake-store", 60_000);
    expect(thirdAttempt).not.toBeNull();
  });
});
