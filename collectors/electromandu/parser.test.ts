import { describe, expect, it } from "vitest";
import { parseElectromanduProduct, parseElectromanduProducts, type ElectromanduProduct } from "@/collectors/electromandu/parser";

/** A trimmed reconstruction of a real Electromandu Store API entry (LG double-door refrigerator),
 * verified live against https://electromandu.com/wp-json/wc/store/v1/products?category=68. */
const fridge: ElectromanduProduct = {
  id: 18543,
  name: "LG GLB262PPMB.ASEQ 287 Liter Double Door Refrigerator &#8211; Frost Free",
  permalink: "https://electromandu.com/product/lg-glb262ppmb-aseq-287-liter-double-door-refrigerator/",
  sku: "",
  prices: { price: "8139000", sale_price: "6869000", currency_minor_unit: 2 },
  images: [{ src: "https://electromandu.com/wp-content/uploads/2026/05/vUiw2M_1755171094-GLB262PPMB.ASEQ-1.jpg" }],
  brands: [],
  is_in_stock: true,
};

describe("parseElectromanduProduct (WooCommerce Store API — sku is blank on every product on this site)", () => {
  it("uses the numeric id as external id, since sku is always blank here", () => {
    expect(parseElectromanduProduct(fridge)?.externalId).toBe("18543");
  });

  it("divides the minor-unit sale price by 10^currency_minor_unit", () => {
    expect(parseElectromanduProduct(fridge)?.price).toBe(68690);
  });

  it("falls back to the list price when there's no sale price", () => {
    expect(parseElectromanduProduct({ ...fridge, prices: { price: "8139000", currency_minor_unit: 2 } })?.price).toBe(81390);
  });

  it("decodes numeric HTML entities (en-dash) in the name", () => {
    expect(parseElectromanduProduct(fridge)?.name).toBe("LG GLB262PPMB.ASEQ 287 Liter Double Door Refrigerator – Frost Free");
  });

  it("guesses brand from a known manufacturer prefix, since brands[] is always empty on this site", () => {
    expect(parseElectromanduProduct(fridge)?.brand).toBe("LG");
  });

  it("reads is_in_stock directly for availability", () => {
    expect(parseElectromanduProduct({ ...fridge, is_in_stock: false })?.availability).toBe("out_of_stock");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseElectromanduProduct({ ...fridge, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseElectromanduProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: ElectromanduProduct = { ...fridge, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseElectromanduProducts([zeroPriced, fridge, { ...fridge, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "18543" })]);
  });
});
