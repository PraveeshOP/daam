import { describe, expect, it } from "vitest";
import { parseRapidotechProduct, parseRapidotechProducts, type RapidotechProduct } from "@/collectors/rapidotech/parser";

/** A trimmed reconstruction of a real Rapido Tech Nepal Store API entry (Redragon speaker),
 * verified live against https://rapidotechnepal.com/wp-json/wc/store/v1/products?category=935.
 * Note currency_minor_unit is 0 on this site, same as SewasMart, different from most others. */
const speaker: RapidotechProduct = {
  id: 35093,
  name: "Redragon WALTZ GS510 Speaker",
  permalink: "https://rapidotechnepal.com/product/redragon-waltz-gs510-speaker/",
  sku: "",
  type: "simple",
  prices: { price: "2999", sale_price: "2349", currency_minor_unit: 0 },
  images: [{ src: "https://rapidotechnepal.com/wp-content/uploads/redragon-gs510.jpg" }],
  brands: [{ name: "Redragon" }],
  is_in_stock: true,
};

describe("parseRapidotechProduct (WooCommerce Store API — currency_minor_unit is 0 here, like SewasMart)", () => {
  it("does NOT divide the price when currency_minor_unit is 0", () => {
    expect(parseRapidotechProduct(speaker)?.price).toBe(2349);
  });

  it("reads brand directly from brands[], which is reliable on this site", () => {
    expect(parseRapidotechProduct(speaker)?.brand).toBe("Redragon");
  });

  it("uses the numeric id as external id, never the sku", () => {
    expect(parseRapidotechProduct(speaker)?.externalId).toBe("35093");
  });

  it("uses a variable product's base price as-is (verified live it already reflects the lowest real variant price)", () => {
    const variable: RapidotechProduct = { ...speaker, id: 33750, type: "variable", prices: { price: "4499", currency_minor_unit: 0 } };
    expect(parseRapidotechProduct(variable)?.price).toBe(4499);
  });

  it("drops a product with no usable positive price", () => {
    expect(parseRapidotechProduct({ ...speaker, prices: { price: "0", sale_price: "0", currency_minor_unit: 0 } })).toBeNull();
  });
});

describe("parseRapidotechProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: RapidotechProduct = { ...speaker, id: 1, prices: { price: "0", currency_minor_unit: 0 } };
    const rows = parseRapidotechProducts([zeroPriced, speaker, { ...speaker, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "35093" })]);
  });
});
