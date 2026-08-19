import { afterEach, describe, expect, it } from "vitest";
import { collectionIntervalMs } from "@/worker/scheduler";

describe("collectionIntervalMs", () => {
  const original = process.env.COLLECTION_INTERVAL_HOURS;
  afterEach(() => {
    if (original === undefined) delete process.env.COLLECTION_INTERVAL_HOURS;
    else process.env.COLLECTION_INTERVAL_HOURS = original;
  });

  it("defaults to a conservative 6 hours when unset", () => {
    delete process.env.COLLECTION_INTERVAL_HOURS;
    expect(collectionIntervalMs()).toBe(6 * 60 * 60 * 1000);
  });

  it("is configurable via COLLECTION_INTERVAL_HOURS without code changes", () => {
    process.env.COLLECTION_INTERVAL_HOURS = "12";
    expect(collectionIntervalMs()).toBe(12 * 60 * 60 * 1000);
    process.env.COLLECTION_INTERVAL_HOURS = "24";
    expect(collectionIntervalMs()).toBe(24 * 60 * 60 * 1000);
  });
});
