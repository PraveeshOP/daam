import { describe, expect, it } from "vitest";
import { parseOnlineItProduct, parseOnlineItProducts, type OnlineItProduct } from "@/collectors/onlineit/parser";

/** A trimmed reconstruction of a real Online IT Store API entry (Acer Nitro V16), verified live
 * against https://onlineit.com.np/wp-json/wc/store/v1/products?category=108. */
const laptop: OnlineItProduct = {
  id: 30829,
  name: "Acer Nitro V16 AI R7BQ | AMD Ryzen 5 240 Processor | 16GB RAM | 512GB SSD | 16&#8243;WUXGA (1920 x 1200) 180Hz Display",
  permalink: "https://onlineit.com.np/acer-nitro-v16-ai-r7bq/",
  sku: "",
  prices: { price: "25100000", sale_price: "23100000", currency_minor_unit: 2 },
  images: [{ src: "https://onlineit.com.np/wp-content/uploads/2026/08/acer-nitro-v16.png" }],
  categories: [{ id: 1, name: "16 gb ram laptop" }, { id: 2, name: "Acer" }, { id: 3, name: "Gaming Laptops" }],
  is_in_stock: true,
};

describe("parseOnlineItProduct (WooCommerce Store API — a real product on this site had price 0 across the board)", () => {
  it("divides the minor-unit sale price by 10^currency_minor_unit", () => {
    expect(parseOnlineItProduct(laptop)?.price).toBe(231000);
  });

  it("decodes a numeric HTML entity (double-prime) in the name", () => {
    expect(parseOnlineItProduct(laptop)?.name).toContain("16″WUXGA");
  });

  it("extracts RAM/storage from the name, using the shared helper fixed for the RAM-as-storage cross-match bug (collectors/core/specs.ts)", () => {
    expect(parseOnlineItProduct(laptop)).toMatchObject({ ram: "16GB", storage: "512GB" });
  });

  it("derives brand from a bare known-brand entry in categories[], since brands[] is always empty on this site", () => {
    expect(parseOnlineItProduct(laptop)?.brand).toBe("Acer");
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseOnlineItProduct(laptop)?.externalId).toBe("30829");
  });

  it("drops a product with price 0 across the board — a real, broken/unpublished listing verified live (a Microsoft Surface entry), not a genuinely free laptop", () => {
    expect(parseOnlineItProduct({ ...laptop, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseOnlineItProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: OnlineItProduct = { ...laptop, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseOnlineItProducts([zeroPriced, laptop, { ...laptop, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "30829" })]);
  });
});
