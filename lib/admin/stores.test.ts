import { afterEach, describe, expect, it } from "vitest";
import { deriveHealth, staleThresholdMs } from "@/lib/admin/stores";
import type { CollectionJobView } from "@/lib/admin/collections";

const job = (overrides: Partial<CollectionJobView>): CollectionJobView => ({
  id: "job-1",
  storeId: "evo-store",
  storeName: "Evo Store",
  status: "completed",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 1000,
  discovered: 10,
  createdProducts: 0,
  matchedProducts: 10,
  createdOffers: 0,
  updatedOffers: 10,
  priceChanges: 2,
  errorCount: 0,
  failedReason: null,
  ...overrides,
});

describe("staleThresholdMs", () => {
  const original = process.env.COLLECTION_INTERVAL_HOURS;
  afterEach(() => {
    if (original === undefined) delete process.env.COLLECTION_INTERVAL_HOURS;
    else process.env.COLLECTION_INTERVAL_HOURS = original;
  });

  it("defaults to 4x a 6-hour collection interval (24h)", () => {
    delete process.env.COLLECTION_INTERVAL_HOURS;
    expect(staleThresholdMs()).toBe(24 * 60 * 60 * 1000);
  });

  it("scales with a configured interval", () => {
    process.env.COLLECTION_INTERVAL_HOURS = "12";
    expect(staleThresholdMs()).toBe(48 * 60 * 60 * 1000);
  });
});

describe("deriveHealth", () => {
  it("is unknown when a store has no job history at all", () => {
    expect(deriveHealth(undefined).health).toBe("unknown");
  });

  it("is healthy when the most recent job completed recently with no errors", () => {
    const result = deriveHealth([job({ status: "completed", completedAt: new Date().toISOString(), errorCount: 0 })]);
    expect(result.health).toBe("healthy");
  });

  it("stays healthy for a small per-product error count on an otherwise successful run", () => {
    const result = deriveHealth([job({ status: "completed", completedAt: new Date().toISOString(), errorCount: 2 })]);
    expect(result.health).toBe("healthy");
    expect(result.errorCount).toBe(2);
  });

  it("is failing when the most recent job outright failed", () => {
    const result = deriveHealth([job({ status: "failed", failedReason: "Request timeout", completedAt: null, startedAt: new Date().toISOString() })]);
    expect(result.health).toBe("failing");
    expect(result.lastError).toBe("Request timeout");
  });

  it("is failing when the last successful collection is older than the stale threshold", () => {
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const result = deriveHealth([job({ status: "completed", completedAt: staleDate })]);
    expect(result.health).toBe("failing");
  });
});
