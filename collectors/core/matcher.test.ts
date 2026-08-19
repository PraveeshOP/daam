import { describe, expect, it } from "vitest";
import { findBestMatch, normalizeStoreProduct } from "@/collectors/core/matcher";

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
