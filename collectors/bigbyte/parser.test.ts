import { describe, expect, it } from "vitest";
import { parseBigbyteProduct, parseBigbyteProducts, type BigbyteProduct } from "@/collectors/bigbyte/parser";

/** Trimmed reconstructions of real Bigbyte Store API entries, verified live against
 * https://bigbyte.com.np/wp-json/wc/store/v1/products?category=13546. */
const camera: BigbyteProduct = {
  id: 255743,
  name: "Digicom 4MP IP Dome CCTV Camera 3.6mm (DG-I304D)",
  permalink: "https://bigbyte.com.np/digicom-4mp-ip-dome-cctv-camera-3-6mm-dg-i304d/",
  sku: "DG-I304D",
  prices: { price: "850000", currency_minor_unit: 2 },
  images: [{ src: "https://bigbyte.com.np/wp-content/uploads/digicom-dome.jpg" }],
  brands: [],
  is_in_stock: true,
};
const nvr: BigbyteProduct = { ...camera, id: 255744, name: "Digicom 4-Port NVR (DG-UN404)" };
const uniview: BigbyteProduct = { ...camera, id: 255745, name: "UNV 2MP HD IR Fixed Dome Camera" };
const univiewSpelledOut: BigbyteProduct = { ...camera, id: 255746, name: "UNIVIEW 4MP Bullet Camera" };

describe("parseBigbyteProduct (WooCommerce Store API — this category also carries non-camera NVR listings)", () => {
  it("divides the minor-unit price by 10^currency_minor_unit", () => {
    expect(parseBigbyteProduct(camera)?.price).toBe(8500);
  });

  it("excludes an NVR/DVR/XVR listing even though it's tagged under this camera category", () => {
    expect(parseBigbyteProduct(nvr)).toBeNull();
  });

  it("guesses brand from the name's first word, since brands[] is always empty on this site", () => {
    expect(parseBigbyteProduct(camera)?.brand).toBe("Digicom");
  });

  it("normalizes 'UNV' and 'UNIVIEW' to the same canonical brand name, since real listings use both spellings for the same manufacturer", () => {
    expect(parseBigbyteProduct(uniview)?.brand).toBe("Uniview");
    expect(parseBigbyteProduct(univiewSpelledOut)?.brand).toBe("Uniview");
  });

  it("uses the numeric id as external id, never the sku (even though sku looks superficially reliable here)", () => {
    expect(parseBigbyteProduct(camera)?.externalId).toBe("255743");
  });

  it("drops a product with no usable positive price", () => {
    expect(parseBigbyteProduct({ ...camera, prices: { price: "0", currency_minor_unit: 2 } })).toBeNull();
  });
});

describe("parseBigbyteProducts", () => {
  it("respects the limit and skips excluded/unpriced products without counting them against it", () => {
    const rows = parseBigbyteProducts([nvr, camera, uniview], 1);
    expect(rows).toEqual([expect.objectContaining({ externalId: "255743" })]);
  });
});
