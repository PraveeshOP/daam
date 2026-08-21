import { describe, expect, it } from "vitest";
import { parseBrothermartProducts, type ShopifyProductsResponse } from "@/collectors/brothermart/parser";

/** Trimmed reconstructions of real Brother Mart products.json entries verified live — one with
 * Color-then-Storage option order (the common case) and one with Storage-then-Color (verified on
 * "Samsung Galaxy Z Fold8 Ultra 5G" — option order is not fixed across products). */
const response: ShopifyProductsResponse = {
  products: [
    {
      id: 9774017872113,
      title: "Honor X5d Smartphone with 90Hz Eye-Comfort Display",
      handle: "honor-x5d-smartphone-price-in-nepal",
      vendor: "Honor",
      options: [{ name: "Color", position: 1 }, { name: "Storage", position: 2 }],
      images: [{ src: "https://cdn.shopify.com/s/files/1/0258/7862/6349/files/fallback.png" }],
      variants: [
        { id: 48607436669169, title: "Black / 4GB+64GB", option1: "Black", option2: "4GB+64GB", price: "25499.00", available: true, featured_image: { src: "https://cdn.shopify.com/s/files/1/0258/7862/6349/files/black.png" } },
        { id: 48607436701937, title: "Blue / 4GB+64GB", option1: "Blue", option2: "4GB+64GB", price: "25499.00", available: false, featured_image: { src: "https://cdn.shopify.com/s/files/1/0258/7862/6349/files/blue.png" } },
      ],
    },
    {
      id: 9200000000001,
      title: "Samsung Galaxy Z Fold8 Ultra 5G",
      handle: "samsung-galaxy-z-fold8-ultra-5g",
      vendor: "Samsung",
      options: [{ name: "Storage", position: 1 }, { name: "Color", position: 2 }],
      variants: [
        { id: 48699999999991, title: "12GB+256GB / Graphite", option1: "12GB+256GB", option2: "Graphite", price: "274999.00", available: true, featured_image: null },
        { id: 0, title: "0-priced placeholder", option1: "0GB+0GB", option2: "N/A", price: "0.00", available: true, featured_image: null },
      ],
    },
  ],
};

describe("parseBrothermartProducts (Shopify products.json — never trusts the free-text sku field)", () => {
  it("keeps only the first color per distinct storage option — Honor X5d's Black and Blue share the exact same '4GB+64GB' storage and price, so the second color is a near-duplicate row, not a real second product", () => {
    const rows = parseBrothermartProducts(response, 50);
    expect(rows.find((row) => row.externalId === "48607436701937")).toBeUndefined();
    expect(rows).toHaveLength(2); // Honor Black (Blue deduped) + Samsung Fold Ultra (0-priced placeholder dropped)
    expect(rows[0]).toMatchObject({ externalId: "48607436669169", name: "Honor X5d Smartphone with 90Hz Eye-Comfort Display 4GB+64GB", brand: "Honor", color: "Black", ram: "4GB", storage: "64GB", price: 25499, currency: "NPR", availability: "in_stock", productUrl: "https://brother-mart.com/products/honor-x5d-smartphone-price-in-nepal?variant=48607436669169" });
  });

  it("does NOT dedupe two variants that genuinely differ in storage, even under the same product", () => {
    const twoStorageTiers: ShopifyProductsResponse = {
      products: [{
        id: 1,
        title: "Redmi 17 5G",
        handle: "redmi-17-5g",
        vendor: "Xiaomi",
        options: [{ name: "Color", position: 1 }, { name: "Storage", position: 2 }],
        variants: [
          { id: 100, title: "Black / 4GB+128GB", option1: "Black", option2: "4GB+128GB", price: "33999.00", available: true },
          { id: 101, title: "Black / 6GB+256GB", option1: "Black", option2: "6GB+256GB", price: "39999.00", available: true },
        ],
      }],
    };
    expect(parseBrothermartProducts(twoStorageTiers, 50)).toHaveLength(2);
  });

  it("falls back to the product's first image when a variant has no featured_image of its own", () => {
    const rows = parseBrothermartProducts(response, 50);
    expect(rows[0].imageUrl).toBe("https://cdn.shopify.com/s/files/1/0258/7862/6349/files/black.png");
  });

  it("reads color/storage by the option NAME, not a fixed option1/option2 position, since option order varies across products", () => {
    const rows = parseBrothermartProducts(response, 50);
    const foldUltra = rows.find((row) => row.externalId === "48699999999991");
    expect(foldUltra).toMatchObject({ color: "Graphite", ram: "12GB", storage: "256GB" });
  });

  it("drops a variant with no usable positive price rather than inventing one", () => {
    const rows = parseBrothermartProducts(response, 50);
    expect(rows.find((row) => row.externalId === "0")).toBeUndefined();
  });

  it("respects the row limit across the whole flattened product×variant set, not per product", () => {
    expect(parseBrothermartProducts(response, 1)).toHaveLength(1);
  });
});
