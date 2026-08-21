import { describe, expect, it } from "vitest";
import { mapDatabaseProduct, searchProducts, getCategoryCounts, supabase } from "@/lib/data";
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
