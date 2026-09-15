import { describe, expect, it } from "vitest";
import { findBestMatch, normalizeStoreProduct, externalIdSlugSuffix, scoreModelSimilarity } from "@/collectors/core/matcher";

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

/**
 * The gates matter more than the scoring: loosening model comparison is only safe if it still
 * refuses genuinely different variants. Each case here is a pair that exists in the real
 * catalogue or arrived from a real store feed.
 */
describe("scoreModelSimilarity", () => {
  it("gives full credit for an identical model", () => {
    expect(scoreModelSimilarity("iphone 17", "iphone 17")).toBe(40);
  });

  it("refuses a variant-word mismatch — iPhone 17 is not iPhone 17 Pro", () => {
    expect(scoreModelSimilarity("iphone 17", "iphone 17 pro")).toBe(0);
    expect(scoreModelSimilarity("galaxy s26", "galaxy s26 ultra")).toBe(0);
    expect(scoreModelSimilarity("macbook air", "macbook air")).toBe(40);
  });

  it("refuses conflicting numbers — generation, size and chip all discriminate", () => {
    expect(scoreModelSimilarity("iphone 17", "iphone 16")).toBe(0);
    expect(scoreModelSimilarity("macbook pro m5 24", "macbook pro 14 m5 pro")).toBe(0);
    expect(scoreModelSimilarity("nitro v16", "nitro v15")).toBe(0);
  });

  it("matches a terse name against a verbose retail name for the same product", () => {
    // The real HamroBazaar case: listing title vs the catalogue's marketing blob.
    expect(
      scoreModelSimilarity("s26 ultra", "galaxy s26 ultra 5g with 200mp camera and privacy display"),
    ).toBeGreaterThanOrEqual(32);
  });

  it("refuses two products that merely share a capacity", () => {
    // Why a SanDisk flash drive used to rank against an iPhone.
    expect(scoreModelSimilarity("sandisk ultra fit usb 3 2 flash drive", "iphone 16")).toBe(0);
  });

  it("refuses low overlap outright rather than scoring it a little", () => {
    expect(scoreModelSimilarity("thinkpad x1 carbon", "ideapad slim")).toBe(0);
  });

  it("handles a missing model on either side", () => {
    expect(scoreModelSimilarity(undefined, "iphone 17")).toBe(0);
    expect(scoreModelSimilarity("iphone 17", undefined)).toBe(0);
    expect(scoreModelSimilarity("", "")).toBe(0);
  });

  it("never reaches the 75 auto-merge bar on model similarity alone", () => {
    // 40 (model) + 25 (storage) = 65. A brand agreement is still required to merge.
    expect(scoreModelSimilarity("iphone 17", "iphone 17")).toBeLessThan(75);
  });
});

describe("scoreModelSimilarity — variant multiplicity", () => {
  /**
   * Regression for a real false positive: a plain-M5 HamroBazaar listing scored 85% against an
   * M5 *Pro* catalogue row, because a Set collapsed the candidate's two "pro" tokens ("MacBook
   * Pro" + "M5 Pro") into one and the chip tier stopped discriminating.
   */
  it("keeps M5 apart from M5 Pro", () => {
    expect(scoreModelSimilarity("macbook pro m5 16", "macbook pro m5 pro 16")).toBe(0);
  });

  it("still matches when both sides carry the same variant words", () => {
    expect(scoreModelSimilarity("macbook pro m5 pro 16", "macbook pro m5 pro 16")).toBe(40);
  });
});
