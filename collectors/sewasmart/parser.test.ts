import { describe, expect, it } from "vitest";
import { parseSewasmartProduct, parseSewasmartProducts, type SewasmartProduct } from "@/collectors/sewasmart/parser";

/** A trimmed reconstruction of a real SewasMart Store API entry (Whirlpool 1 Ton AC), verified
 * live against https://sewasmart.com/wp-json/wc/store/v1/products?category=78. Note
 * currency_minor_unit is 0 on this site — different from most other WooCommerce sites this
 * session, which use 2. */
const ac: SewasmartProduct = {
  id: 33638,
  name: "Whirlpool 1 Ton Hot and Cold Split Air Conditioner",
  permalink: "https://sewasmart.com/product/whirlpool-1-ton-hot-and-cold-split-air-conditioner/",
  sku: "",
  prices: { price: "70000", sale_price: "65000", currency_minor_unit: 0 },
  images: [{ src: "https://sewasmart.com/wp-content/uploads/whirlpool-ac.png" }],
  brands: [{ name: "Whirlpool" }],
  is_in_stock: true,
};

describe("parseSewasmartProduct (WooCommerce Store API — currency_minor_unit is 0 here, unlike most other sites this session)", () => {
  it("does NOT divide the price when currency_minor_unit is 0", () => {
    expect(parseSewasmartProduct(ac)?.price).toBe(65000);
  });

  it("still divides correctly if minor_unit were 2, proving the divisor is read per-response, not hardcoded", () => {
    expect(parseSewasmartProduct({ ...ac, prices: { price: "7000000", sale_price: "6500000", currency_minor_unit: 2 } })?.price).toBe(65000);
  });

  it("reads brand directly from brands[], which is reliable on this site", () => {
    expect(parseSewasmartProduct(ac)?.brand).toBe("Whirlpool");
  });

  it("uses the numeric id as external id — sku is blank on 72% of this category's products", () => {
    expect(parseSewasmartProduct(ac)?.externalId).toBe("33638");
  });

  it("drops a zero-price 'contact for price' stub listing — verified live, 3 of 61 real products in this category have price 0", () => {
    expect(parseSewasmartProduct({ ...ac, prices: { price: "0", sale_price: "0", currency_minor_unit: 0 } })).toBeNull();
  });
});

describe("parseSewasmartProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: SewasmartProduct = { ...ac, id: 1, prices: { price: "0", currency_minor_unit: 0 } };
    const rows = parseSewasmartProducts([zeroPriced, ac, { ...ac, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "33638" })]);
  });
});
