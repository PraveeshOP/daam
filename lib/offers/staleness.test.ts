import { describe, expect, it } from "vitest";
import { isStale } from "@/lib/offers/staleness";

describe("isStale", () => {
  it("is false when there is no timestamp at all", () => {
    expect(isStale(null)).toBe(false);
    expect(isStale(undefined)).toBe(false);
  });

  it("is false for an unparseable timestamp rather than throwing", () => {
    expect(isStale("not a date")).toBe(false);
  });

  it("is false for a recent timestamp", () => {
    expect(isStale(new Date().toISOString())).toBe(false);
  });

  it("is true for a timestamp well past the default (6h x 4) threshold", () => {
    const longAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    expect(isStale(longAgo)).toBe(true);
  });
});
