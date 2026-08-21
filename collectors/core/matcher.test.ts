import { describe, expect, it } from "vitest";
import { findBestMatch, normalizeStoreProduct, externalIdSlugSuffix } from "@/collectors/core/matcher";

describe("canonical product matcher", () => {
  it("matches equivalent names with the same storage", () => {
    const result = findBestMatch({ name: "Apple iPhone 16 128 GB", brand: "Apple", price: 1, currency: "NPR", productUrl: "https://example.com" }, [{ id: "one", name: "iPhone 16 128GB", brand: "Apple", specifications: {} }]);
    expect(result.candidate?.id).toBe("one");
    expect(result.confidence).toBeGreaterThanOrEqual(75);
  });
  it("does not match different storage variants", () => {
    const source = normalizeStoreProduct({ name: "Apple iPhone 16 128GB", brand: "Apple", price: 1, currency: "NPR", productUrl: "https://example.com" });
    const candidate = normalizeStoreProduct({ name: "Apple iPhone 16 256GB", brand: "Apple", price: 1, currency: "NPR", productUrl: "https://example.com" });
    expect(source.storage).not.toBe(candidate.storage);
  });
});

describe("externalIdSlugSuffix (§slug-collision, found adding a second Evo category)", () => {
  it("never collides for two ids sharing a long common prefix — the bug a naive truncate-to-24-chars had", () => {
    const a = externalIdSlugSuffix("macbook-air-13-inch-m5-16gb-512gb-8c-gpu");
    const b = externalIdSlugSuffix("macbook-air-13-inch-m5-16gb-1tb-10c-gpu");
    expect(a).not.toBe(b);
  });
  it("is deterministic for the same id", () => {
    expect(externalIdSlugSuffix("same-id")).toBe(externalIdSlugSuffix("same-id"));
  });
  it("falls back to something usable when there is no externalId, without throwing", () => {
    expect(() => externalIdSlugSuffix(undefined)).not.toThrow();
    expect(() => externalIdSlugSuffix(null)).not.toThrow();
  });
});
