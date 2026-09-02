import { describe, expect, it } from "vitest";
import { parseTronixspaceProduct, parseTronixspaceProducts, type TronixspaceProduct } from "@/collectors/tronixspace/parser";

/** A trimmed reconstruction of the real Sony PS5 entry, verified live against
 * https://tronixspace.com/wp-json/wc/store/v1/products?category=78 — the only console listing on
 * this site (the rest of the category is 2 controllers and a headset). */
const ps5: TronixspaceProduct = {
  id: 964,
  name: "Sony PlayStation 5 Slim Disc Edition (1TB SSD, 4K Gaming Console) | PS5",
  permalink: "https://tronixspace.com/product/sony-playstation-5-price-in-nepal/",
  sku: "",
  prices: { price: "13500000", sale_price: "12399900", currency_minor_unit: 2 },
  images: [{ src: "https://tronixspace.com/wp-content/uploads/ps5-slim.png" }],
  brands: [{ name: "Sony" }],
  is_in_stock: true,
};

describe("parseTronixspaceProduct (WooCommerce Store API — brands[] is reliable here, unlike the laptop-focused sites this session)", () => {
  it("divides the minor-unit sale price by 10^currency_minor_unit", () => {
    expect(parseTronixspaceProduct(ps5)?.price).toBe(123999);
  });

  it("reads brand directly from brands[]", () => {
    expect(parseTronixspaceProduct(ps5)?.brand).toBe("Sony");
  });

  it("uses the numeric id as external id, never the sku (blank on this site's only console listing)", () => {
    expect(parseTronixspaceProduct(ps5)?.externalId).toBe("964");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseTronixspaceProduct({ ...ps5, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseTronixspaceProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: TronixspaceProduct = { ...ps5, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseTronixspaceProducts([zeroPriced, ps5, { ...ps5, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "964" })]);
  });
});
