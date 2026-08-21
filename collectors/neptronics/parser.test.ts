import { describe, expect, it } from "vitest";
import { parseNeptronicsProduct, parseNeptronicsProducts, type NeptronicsProduct } from "@/collectors/neptronics/parser";

/** Trimmed reconstruction of a real Neptronics Store API entry (xiaomi-redmi-airdots-in-ear-headset),
 * verified live against https://neptronics.com/wp-json/wc/store/v1/products?category=52. */
const product: NeptronicsProduct = {
  id: 5293,
  name: "XIAOMI REDMI AIRDOTS in EAR HEADSET",
  slug: "xiaomi-redmi-airdots-in-ear-headset",
  permalink: "https://neptronics.com/product/xiaomi-redmi-airdots-in-ear-headset/",
  sku: "",
  prices: { price: "190000", currency_minor_unit: 2 },
  images: [{ src: "https://neptronics.com/wp-content/uploads/2021/03/buy-airdots-in-kathmandu-2-1.jpg" }],
  is_in_stock: true,
};

describe("parseNeptronicsProduct (WooCommerce Store API — minor-unit price scaling)", () => {
  it("divides the minor-unit price string by 10^currency_minor_unit rather than using it raw", () => {
    const row = parseNeptronicsProduct(product);
    expect(row?.price).toBe(1900);
  });

  it("uses the slug as external id — this store's own sku field is always empty, never trusted blindly", () => {
    const row = parseNeptronicsProduct(product);
    expect(row?.externalId).toBe("xiaomi-redmi-airdots-in-ear-headset");
  });

  it("guesses a brand from a known prefix in the title when the store has no brand taxonomy", () => {
    const row = parseNeptronicsProduct(product);
    expect(row?.brand).toBe("Xiaomi");
  });

  it("leaves brand undefined rather than guessing wrong when no known prefix matches", () => {
    const row = parseNeptronicsProduct({ ...product, name: "EWA A104 Bluetooth Speaker" });
    expect(row?.brand).toBe("Ewa");
  });

  it("reads is_in_stock directly for availability", () => {
    expect(parseNeptronicsProduct({ ...product, is_in_stock: false })?.availability).toBe("out_of_stock");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseNeptronicsProduct({ ...product, prices: { price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseNeptronicsProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: NeptronicsProduct = { ...product, id: 1, slug: "zero", prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseNeptronicsProducts([zeroPriced, product, { ...product, id: 2, slug: "second" }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "xiaomi-redmi-airdots-in-ear-headset" })]);
  });
});
