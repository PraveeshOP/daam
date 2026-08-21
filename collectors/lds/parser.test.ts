import { describe, expect, it } from "vitest";
import { parseLdsProduct, parseLdsProducts, type LdsProduct } from "@/collectors/lds/parser";

/** A trimmed reconstruction of a real LDS Store API entry (Lenovo LOQ 15IRX9), verified live
 * against https://lds.com.np/wp-json/wc/store/v1/products?category=15. */
const laptop: LdsProduct = {
  id: 6696,
  // Verified live: this API returns real unicode symbols (®) inline, not HTML entities for them —
  // but DOES use literal numeric entities for other characters in the same string, e.g. &#8243;
  // for the screen-size double-prime and &#038; for a literal "&" (caught only by checking an
  // actually-imported row, not by inspecting sampled JSON snippets ahead of time).
  name: "Lenovo LOQ 15IRX9 Gaming i5-13450HX/24GB RAM/512GB SSD/15.6&#8243; Full HD IPS 144Hz/NVIDIA® GeForce® RTX 3050 6GB, Silver &#038; Black",
  permalink: "https://lds.com.np/lenovo-loq-15irx9-gaming-i5-13450hx-13th-gen-24gb-ram-ddr5-512gb-ssd-15-6-full-hd-ips-144hz-nvidia-geforce-rtx-3050-6gb-backlit-keyboard-luna-grey/",
  sku: "lenovo-131",
  prices: { price: "18499000", sale_price: "16499000", currency_minor_unit: 2 },
  images: [{ src: "https://lds.com.np/wp-content/uploads/2024/08/LOQ-15AHP9-16.jpg" }],
  brands: [{ name: "Lenovo" }],
  is_in_stock: true,
};

describe("parseLdsProduct (WooCommerce Store API — minor-unit price scaling, sale price preferred)", () => {
  it("divides the minor-unit sale price by 10^currency_minor_unit rather than using it raw", () => {
    const product = parseLdsProduct(laptop);
    expect(product?.price).toBe(164990);
  });

  it("falls back to the list price when there's no sale price", () => {
    const product = parseLdsProduct({ ...laptop, prices: { price: "18499000", sale_price: undefined, currency_minor_unit: 2 } });
    expect(product?.price).toBe(184990);
  });

  it("uses the numeric id as external id, never the free-text sku", () => {
    const product = parseLdsProduct(laptop);
    expect(product?.externalId).toBe("6696");
  });

  it("decodes both numeric HTML entities (screen-size double-prime, ampersand) and passes real unicode symbols through unchanged", () => {
    const product = parseLdsProduct(laptop);
    // &#8243; is U+2033 DOUBLE PRIME (″) — the character this site's own data actually uses for
    // screen sizes, not an ASCII straight double-quote, even though the two look near-identical.
    expect(product?.name).toBe("Lenovo LOQ 15IRX9 Gaming i5-13450HX/24GB RAM/512GB SSD/15.6″ Full HD IPS 144Hz/NVIDIA® GeForce® RTX 3050 6GB, Silver & Black");
  });

  it("reads brand from the brands[] array", () => {
    expect(parseLdsProduct(laptop)?.brand).toBe("Lenovo");
  });

  it("reads is_in_stock directly for availability", () => {
    expect(parseLdsProduct({ ...laptop, is_in_stock: false })?.availability).toBe("out_of_stock");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseLdsProduct({ ...laptop, prices: { price: "0", sale_price: "0", currency_minor_unit: 2 } })).toBeNull();
  });

  it("excludes a mislabeled/counterfeit 'MacBook' listing running an iPhone chip (verified live: LDS's own product id 4182, 'Apple MacBook Neo A18 Pro Chip .../Mac OS' — no real Mac has ever used an A-series chip)", () => {
    const fakeMacbook: LdsProduct = { ...laptop, id: 4182, name: "Apple MacBook Neo A18 Pro Chip/8GB RAM/256GB SSD/13&#8243; 2.4K/Mac OS (Silver, Blush &#038; Indigo)", brands: [{ name: "Apple" }] };
    expect(parseLdsProduct(fakeMacbook)).toBeNull();
  });
});

describe("parseLdsProducts", () => {
  it("respects the limit and skips unpriced products without counting them against it", () => {
    const zeroPriced: LdsProduct = { ...laptop, id: 1, prices: { price: "0", currency_minor_unit: 2 } };
    const rows = parseLdsProducts([zeroPriced, laptop, { ...laptop, id: 2 }], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "6696" })]);
  });
});
