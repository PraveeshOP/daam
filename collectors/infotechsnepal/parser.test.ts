import { describe, expect, it } from "vitest";
import { parseInfotechsProduct, parseInfotechsProducts, type InfotechsProduct } from "@/collectors/infotechsnepal/parser";

/** A trimmed reconstruction of a real Infotechs Nepal Store API entry (Acer Nitro V15), verified
 * live against https://infotechsnepal.com.np/wp-json/wc/store/v1/products?category=291. */
const laptop: InfotechsProduct = {
  id: 70426,
  name: "Acer Nitro V15 Gaming (Intel Core 5 210H | 16GB RAM | 1TB SSD | RTX 5050 8GB | 15.6&#8243; FHD IPS 165Hz Display)",
  permalink: "https://infotechsnepal.com.np/product/acer-nitro-v15-gaming-intel-core-5-210h-series-2-processor-16gb-ram-1tb-ssd-15-inch/",
  sku: "",
  prices: { price: "25000000", sale_price: "18099900", currency_minor_unit: 2 },
  images: [{ src: "https://infotechsnepal.com.np/wp-content/uploads/2026/08/acer-nitro-v15-core-5-front-view-.png" }],
  brands: [],
  categories: [{ id: 1, name: "Laptops" }, { id: 2, name: "Acer Laptops" }, { id: 3, name: "Nitro Series" }],
  is_in_stock: true,
};

describe("parseInfotechsProduct (WooCommerce Store API — sku is blank on every product on this site)", () => {
  it("divides the minor-unit sale price by 10^currency_minor_unit", () => {
    expect(parseInfotechsProduct(laptop)?.price).toBe(180999);
  });

  it("decodes a numeric HTML entity (double-prime) even though this site sometimes ships already-decoded unicode elsewhere", () => {
    expect(parseInfotechsProduct(laptop)?.name).toContain("15.6″ FHD");
  });

  it("extracts RAM/storage from the name, defending against the matcher's RAM-as-storage bug (collectors/core/matcher.ts)", () => {
    expect(parseInfotechsProduct(laptop)).toMatchObject({ ram: "16GB", storage: "1TB" });
  });

  it("derives brand from a known-brand PREFIX in a suffixed category name ('Acer Laptops', not a bare 'Acer'), since brands[] is empty here", () => {
    expect(parseInfotechsProduct(laptop)?.brand).toBe("Acer");
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseInfotechsProduct(laptop)?.externalId).toBe("70426");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseInfotechsProduct({ ...laptop, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseInfotechsProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: InfotechsProduct = { ...laptop, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseInfotechsProducts([zeroPriced, laptop, { ...laptop, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "70426" })]);
  });
});
