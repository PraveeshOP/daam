import { describe, expect, it } from "vitest";
import { parseMaxProduct, parseMaxProducts, type MaxProduct } from "@/collectors/maxinternational/parser";

/** A trimmed reconstruction of a real Max International Store API entry (ASUS Vivobook Go 15),
 * verified live against https://maxnepal.com.np/wp-json/wc/store/v1/products?category=276. */
const laptop: MaxProduct = {
  id: 33608,
  name: "ASUS Vivobook Go 15 E1504FA | AMD Ryzen 5 | 8GB RAM | 512GB SSD | 15.6&#8243; FHD Display",
  permalink: "https://maxnepal.com.np/product/asus-vivobook-go-15-e1504fa/",
  sku: "",
  prices: { price: "9750000", currency_minor_unit: 2 },
  images: [{ src: "https://maxnepal.com.np/wp-content/uploads/2026/08/vivobook-go-15.png" }],
  categories: [{ id: 1, name: "8 GB RAM Laptop" }, { id: 2, name: "Asus Laptops" }, { id: 3, name: "Asus Vivobook" }],
  is_in_stock: true,
};

describe("parseMaxProduct (WooCommerce Store API — brand categories are suffixed, e.g. 'Asus Laptops' not bare 'Asus')", () => {
  it("divides the minor-unit price by 10^currency_minor_unit", () => {
    expect(parseMaxProduct(laptop)?.price).toBe(97500);
  });

  it("decodes a numeric HTML entity (double-prime) in the name", () => {
    expect(parseMaxProduct(laptop)?.name).toContain("15.6″ FHD");
  });

  it("extracts RAM/storage from the name via the shared helper", () => {
    expect(parseMaxProduct(laptop)).toMatchObject({ ram: "8GB", storage: "512GB" });
  });

  it("derives brand from a known-brand PREFIX in a suffixed category name ('Asus Laptops', not a bare 'Asus')", () => {
    expect(parseMaxProduct(laptop)?.brand).toBe("Asus");
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseMaxProduct(laptop)?.externalId).toBe("33608");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseMaxProduct({ ...laptop, prices: { price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseMaxProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: MaxProduct = { ...laptop, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseMaxProducts([zeroPriced, laptop, { ...laptop, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "33608" })]);
  });
});
