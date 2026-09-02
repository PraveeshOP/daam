import { describe, expect, it } from "vitest";
import { mapDatabaseProduct, searchProducts, getCategoryCounts, getStoreCounts, getComparableProducts, supabase } from "@/lib/data";
import type { DatabaseProduct } from "@/lib/data";

describe("searchProducts", () => {
  it("finds products by a case-insensitive partial name", async () => {
    expect(supabase).toBeNull();
    const results = await searchProducts("IPHONE");
    expect(results.map((product) => product.slug)).toContain("apple-iphone-16-128gb");
  });

  it("combines category, store, stock, and price filters", async () => {
    const results = await searchProducts("", {
      category: "smartphones",
      store: "evo-store",
      minPrice: 89000,
      maxPrice: 100000,
      inStock: true,
      sort: "lowest",
    });
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe("apple-iphone-16-128gb");
  });

  it("sorts results by the requested price order", async () => {
    const results = await searchProducts("", { category: "smartphones", sort: "lowest" });
    expect(results[0].lowestPrice).toBeLessThanOrEqual(results[1].lowestPrice);
  });
});

describe("getCategoryCounts", () => {
  it("counts every category across the whole catalog, not just one filtered slice (the live bug this fixes)", async () => {
    const counts = await getCategoryCounts();
    // Both categories the seed data actually has products in should show a real count —
    // this is the exact bug report: viewing one category made every other category read 0.
    expect(counts.smartphones).toBeGreaterThan(0);
    expect(counts.laptops).toBeGreaterThan(0);
  });

  it("narrows counts to match an active search query", async () => {
    const counts = await getCategoryCounts("iphone");
    expect(counts.smartphones).toBeGreaterThan(0);
    expect(counts.laptops ?? 0).toBe(0);
  });

  it("narrows to the active store filter without collapsing to just that store's currently-selected category (the cross-facet bug this fixes)", async () => {
    // ITTI only carries the seed data's MacBook (laptops) and LG TV (televisions) — a store
    // filter should scope category counts to what that store actually sells, not the whole
    // catalog, and should still list every category ITTI sells (not just laptops).
    const counts = await getCategoryCounts("", "itti");
    expect(counts.laptops).toBeGreaterThan(0);
    expect(counts.televisions).toBeGreaterThan(0);
    expect(counts.smartphones ?? 0).toBe(0);
  });
});

describe("getComparableProducts (§multi-store-only, then §no-hardcoding: 'Popular comparisons' is a real live query, not gated on the manually-set `featured` flag)", () => {
  it("never returns a product carried by fewer than 2 stores", async () => {
    const comparable = await getComparableProducts();
    expect(comparable.length).toBeGreaterThan(0);
    for (const product of comparable) expect(product.stores).toBeGreaterThanOrEqual(2);
  });

  it("respects a custom limit", async () => {
    expect((await getComparableProducts(1)).length).toBeLessThanOrEqual(1);
  });
});

describe("getStoreCounts (same fix as getCategoryCounts, so the Store filter's counts don't zero out either)", () => {
  it("counts every store across the whole catalog, keyed by store slug", async () => {
    const counts = await getStoreCounts();
    expect(counts["evo-store"]).toBeGreaterThan(0);
  });

  it("narrows counts to match an active search query", async () => {
    const counts = await getStoreCounts("iphone");
    expect(counts["evo-store"]).toBeGreaterThan(0);
    expect(counts["itti"] ?? 0).toBe(0); // ITTI only carries the seed data's MacBook/TV, not the iPhone
  });

  it("narrows to the active category filter (the cross-facet bug this fixes: a store's count should read 0, not its global total, once a category with no overlap is also selected)", async () => {
    const counts = await getStoreCounts("", "smartphones");
    expect(counts["evo-store"]).toBeGreaterThan(0); // Evo sells the seed data's smartphones
    expect(counts["itti"] ?? 0).toBe(0); // ITTI sells zero smartphones, only a laptop and a TV
  });
});

describe("mapDatabaseProduct", () => {
  it("maps numeric prices and chronological price history safely", () => {
    const row: DatabaseProduct = {
      id: "product-1",
      name: "Test phone",
      slug: "test-phone",
      brand: "Test",
      description: null,
      image_url: null,
      specifications: { Storage: "128GB" },
      featured: false,
      created_at: "2026-01-01T00:00:00.000Z",
      categories: { name: "Smartphones", slug: "smartphones" },
      offers: [{
        id: "offer-1",
        product_id: "product-1",
        store_id: "store-1",
        external_id: null,
        price: "89999",
        previous_price: null,
        availability: "in_stock",
        product_url: "https://example.com/product",
        last_checked: "2026-08-19T00:00:00.000Z",
        stores: { id: "store-1", name: "Example Store", slug: "example-store", logo_url: null, description: null },
      }],
      price_history: [
        { price: "89999", recorded_at: "2026-08-01T00:00:00.000Z" },
        { price: "94999", recorded_at: "2026-07-01T00:00:00.000Z" },
      ],
    };
    const product = mapDatabaseProduct(row);
    expect(product.image).toBe("/product-placeholder.svg");
    expect(product.offers[0].price).toBe(89999);
    expect(product.offerStores?.[0].name).toBe("Example Store");
    expect(product.history.map((point) => point.price)).toEqual([94999, 89999]);
  });
});
