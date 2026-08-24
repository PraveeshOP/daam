import { describe, expect, it } from "vitest";
import { parseTechinnProduct, parseTechinnProducts, type TechinnProduct } from "@/collectors/techinn/parser";

/** A trimmed reconstruction of a real Techinn Store API entry (Lenovo Ideapad Slim 3), verified
 * live against https://techinn.com.np/wp-json/wc/store/v1/products?category=16. */
const laptop: TechinnProduct = {
  id: 3136,
  name: "Lenovo Ideapad Slim 3 2025 (15ARP10) | AMD Ryzen 5 7535HS | 16GB DDR5 RAM | 512GB NVMe SSD | 15.3&#8243; WUXGA IPS Display",
  permalink: "https://techinn.com.np/product/lenovo-ideapad-slim-3-2025-15arp10-amd-ryzen-5-7535hs-price-in-nepal/",
  sku: "",
  prices: { price: "13000000", sale_price: "11200000", currency_minor_unit: 2 },
  images: [{ src: "https://techinn.com.np/wp-content/uploads/2026/08/Lenovo-Ideapad-Slim-3-15ARP10.png" }],
  categories: [{ id: 16, name: "Laptops" }, { id: 21, name: "Lenovo" }],
  is_in_stock: true,
};

describe("parseTechinnProduct (WooCommerce Store API — sku is blank on every product on this site)", () => {
  it("divides the minor-unit sale price by 10^currency_minor_unit", () => {
    expect(parseTechinnProduct(laptop)?.price).toBe(112000);
  });

  it("decodes numeric HTML entities (double-prime) present directly in the raw API JSON", () => {
    expect(parseTechinnProduct(laptop)?.name).toContain('15.3″ WUXGA');
  });

  it("extracts RAM/storage from the name, defending against the matcher's RAM-as-storage bug (collectors/core/matcher.ts)", () => {
    expect(parseTechinnProduct(laptop)).toMatchObject({ ram: "16GB", storage: "512GB" });
  });

  it("derives brand from a known-brand entry in categories[], since this site's API has no brands field at all", () => {
    expect(parseTechinnProduct(laptop)?.brand).toBe("Lenovo");
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseTechinnProduct(laptop)?.externalId).toBe("3136");
  });

  it("reads is_in_stock directly for availability", () => {
    expect(parseTechinnProduct({ ...laptop, is_in_stock: false })?.availability).toBe("out_of_stock");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseTechinnProduct({ ...laptop, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseTechinnProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: TechinnProduct = { ...laptop, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseTechinnProducts([zeroPriced, laptop, { ...laptop, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "3136" })]);
  });
});
