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

  it("§RAM-mislabeled-as-storage (found live importing DealAyo): distinguishes two variants that share the same RAM but differ only in storage, when the name reads '<RAM>GB RAM <storage>GB Storage' — a real product pair (Vivo V60 5G 12GB/512GB vs 12GB/256GB) that silently merged into one product/offer, overwriting one variant's price, before this fix", () => {
    const variant512 = normalizeStoreProduct({ name: "Vivo V60 5G 12GB RAM 512GB Storage Mobile Phone", brand: "Vivo", price: 74999, currency: "NPR", productUrl: "https://example.com/a" });
    const variant256 = normalizeStoreProduct({ name: "Vivo V60 5G 12GB RAM 256GB Storage Mobile Phone", brand: "Vivo", price: 70999, currency: "NPR", productUrl: "https://example.com/b" });
    expect(variant512.ram).toBe(variant256.ram); // same RAM, as in the real pair
    expect(variant512.storage).not.toBe(variant256.storage); // but genuinely different storage
    expect(variant512.storage).toContain("512");
    expect(variant256.storage).toContain("256");

    const result = findBestMatch(
      { name: "Vivo V60 5G 12GB RAM 512GB Storage Mobile Phone", brand: "Vivo", price: 74999, currency: "NPR", productUrl: "https://example.com/a" },
      [{ id: "the-256gb-variant", name: "Vivo V60 5G 12GB RAM 256GB Storage Mobile Phone", brand: "Vivo", specifications: {} }],
    );
    expect(result.confidence).toBeLessThan(75); // must NOT be treated as a high-confidence match
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
