import { describe, expect, it } from "vitest";
import { mapDatabaseProduct, searchProducts, getCategoryCounts, getStoreCounts, getComparableProducts, supabase, marketplaceStore, isMarketplaceStoreSlug, MARKETPLACE_STORE_PREFIX } from "@/lib/data";
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

/**
 * A linked C2C listing is modelled as an `Offer` carrying a `marketplace` marker, which is what
 * lets it rank against real shop offers everywhere at once. These pin the parts of that decision
 * that are easy to regress: it must reach the comparison, and it must stay out of the paths that
 * would mislead a shopper.
 */
describe("marketplace listings in the comparison", () => {
  const row = (overrides: Partial<DatabaseProduct> = {}): DatabaseProduct => ({
    id: "p1",
    name: "iPhone 17 256 GB",
    slug: "iphone-17-256-gb",
    brand: "Apple",
    description: null,
    image_url: null,
    specifications: null,
    featured: false,
    created_at: new Date().toISOString(),
    categories: { name: "Smartphones", slug: "smartphones" },
    offers: [{
      id: "o1", product_id: "p1", store_id: "s1", external_id: null, price: 165499,
      previous_price: null, availability: "in_stock", product_url: "https://shop.example/x",
      last_checked: new Date().toISOString(),
      stores: { id: "s1", name: "ITTI", slug: "itti", logo_url: null, description: null },
    }],
    marketplace_listings: [{
      id: "m1", source: "hamrobazaar", external_id: "ABC", product_id: "p1",
      title: "Iphone 17 256gb", price: 149999, condition: "brand_new", negotiable: true,
      listing_url: "https://hamrobazaar.com/detail/ABC",
      last_seen_at: new Date().toISOString(),
    }],
    ...overrides,
  } as DatabaseProduct);

  it("adds a linked listing to the product's offers so it takes part in ranking", () => {
    const product = mapDatabaseProduct(row());
    expect(product.offers).toHaveLength(2);
    const listing = product.offers.find((offer) => offer.marketplace);
    expect(listing?.price).toBe(149999);
    expect(listing?.marketplace?.sourceName).toBe("HamroBazaar");
    expect(listing?.marketplace?.negotiable).toBe(true);
  });

  it("links straight to the listing, not through /go/[offerId] — there is no offers row to resolve", () => {
    const listing = mapDatabaseProduct(row()).offers.find((offer) => offer.marketplace);
    expect(listing?.productUrl).toBe("https://hamrobazaar.com/detail/ABC");
    expect(listing?.id.startsWith("marketplace:")).toBe(true);
  });

  it("gives the source a synthetic store with no affiliate relationship", () => {
    const store = mapDatabaseProduct(row()).offerStores?.find((item) => item.id === "marketplace:hamrobazaar");
    expect(store?.name).toBe("HamroBazaar");
    expect(store?.affiliateEnabled).toBe(false);
    expect(store?.partnershipStatus).toBe("none");
  });

  it("marks a listing in stock, so it is not dropped from the in-stock price set", () => {
    const listing = mapDatabaseProduct(row()).offers.find((offer) => offer.marketplace);
    expect(listing?.availability).toBe("in_stock");
  });

  it("never contributes a price-history point — history comes from price_history alone", () => {
    expect(mapDatabaseProduct(row()).history).toEqual([]);
  });

  it("leaves a product with no linked listings completely unchanged", () => {
    const product = mapDatabaseProduct(row({ marketplace_listings: [] }));
    expect(product.offers).toHaveLength(1);
    expect(product.offers[0].marketplace).toBeUndefined();
    expect(product.offerStores?.every((store) => !store.id.startsWith("marketplace:"))).toBe(true);
  });

  it("tolerates the field being absent entirely (list selects that do not ask for it)", () => {
    const { marketplace_listings: _omitted, ...withoutField } = row();
    expect(mapDatabaseProduct(withoutField as DatabaseProduct).offers).toHaveLength(1);
  });
});

describe("marketplace sources in the store filter", () => {
  it("gives a source a prefixed slug the query paths can route on", () => {
    const store = marketplaceStore("hamrobazaar");
    expect(store.slug).toBe(`${MARKETPLACE_STORE_PREFIX}hamrobazaar`);
    expect(store.name).toBe("HamroBazaar");
    expect(isMarketplaceStoreSlug(store.slug)).toBe(true);
  });

  /**
   * The routing this prefix drives is not cosmetic: a marketplace source has no `offers` rows, so
   * sending its slug down the normal offers->stores lookup returns nothing and the filter silently
   * shows an empty page. A real shop slug must never be mistaken for one.
   */
  it("does not mistake a real shop slug for a marketplace source", () => {
    for (const slug of ["itti", "evo-store", "mobilemandu", "smartdoko"]) {
      expect(isMarketplaceStoreSlug(slug)).toBe(false);
    }
  });

  it("marks the synthetic store as having no affiliate relationship", () => {
    const store = marketplaceStore("hamrobazaar");
    expect(store.affiliateEnabled).toBe(false);
    expect(store.partnershipStatus).toBe("none");
  });
});

describe("getComparableProducts ordering (seed-data fallback)", () => {
  it("returns the widest price gaps first, not an arbitrary set", async () => {
    expect(supabase).toBeNull();
    const results = await getComparableProducts(8);
    const savings = results.map((product) => product.savings);
    expect(savings).toEqual([...savings].sort((first, second) => second - first));
  });

  it("only includes products actually sold by two or more stores", async () => {
    for (const product of await getComparableProducts(8)) expect(product.stores).toBeGreaterThanOrEqual(2);
  });

  it("is stable across calls, so the homepage does not reshuffle between requests", async () => {
    const first = (await getComparableProducts(8)).map((product) => product.id);
    const second = (await getComparableProducts(8)).map((product) => product.id);
    expect(first).toEqual(second);
  });
});
