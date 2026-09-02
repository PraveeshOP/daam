import { describe, expect, it } from "vitest";
import { parseExortstoreProduct, parseExortstoreProductUrls } from "@/collectors/exortstore/parser";

/** A trimmed-down reconstruction of the real page structure verified live on
 * exortstore.com/product/boat-smart-watch-xtend-sport-fq9om — the Product entry lives inside a
 * `@graph` array alongside unrelated WebSite/Organization blocks, sku/mpn are always blank, and
 * brand.name carries stray whitespace on every real product. */
function buildPageHtml(availability = "http://schema.org/InStock") {
  return `
<html><body>
<script type="application/ld+json">${JSON.stringify({ "@context": "http://schema.org", "@type": "WebSite", url: "https://exortstore.com" })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "Product",
      name: "BoAt Smart Watch Xtend Sport",
      image: ["https://exortstore.com/uploads/products/thumbnails/qsihie6lgx6oelf.jpeg"],
      sku: "",
      mpn: "",
      offers: [{ "@type": "Offer", price: "5500", priceCurrency: "NPR", availability }],
      brand: { "@type": "Organization", name: " BoAt " },
    }],
  })}</script>
<form><input type="hidden" name="product_id" value="187"></form>
</body></html>`;
}

describe("Exort Store parser (Product JSON-LD nested in a @graph array — not WooCommerce, no Store API)", () => {
  it("finds the Product entry inside @graph, ignoring unrelated WebSite/Organization JSON-LD blocks", () => {
    const [product] = parseExortstoreProduct(buildPageHtml(), "https://exortstore.com/product/boat-smart-watch-xtend-sport-fq9om");
    expect(product.name).toBe("BoAt Smart Watch Xtend Sport");
    expect(product.price).toBe(5500);
  });

  it("trims stray whitespace from brand.name (' BoAt ' -> 'BoAt'), present on every real product sampled", () => {
    const [product] = parseExortstoreProduct(buildPageHtml(), "https://exortstore.com/product/x");
    expect(product.brand).toBe("BoAt");
  });

  it("uses the hidden product_id form field as external id, since sku/mpn are always blank in JSON-LD", () => {
    const [product] = parseExortstoreProduct(buildPageHtml(), "https://exortstore.com/product/x");
    expect(product.externalId).toBe("187");
  });

  it("reflects out-of-stock availability", () => {
    const [product] = parseExortstoreProduct(buildPageHtml("http://schema.org/OutOfStock"), "https://exortstore.com/product/x");
    expect(product.availability).toBe("out_of_stock");
  });

  it("rejects a page with no product_id hidden field", () => {
    const html = buildPageHtml().replace(/<form>[\s\S]*?<\/form>/, "");
    expect(() => parseExortstoreProduct(html, "https://exortstore.com/product/x")).toThrow("missing product_id hidden field");
  });

  it("rejects a page with no Product JSON-LD at all", () => {
    expect(() => parseExortstoreProduct("<html><body>nothing here</body></html>", "https://exortstore.com/product/x")).toThrow("missing product JSON-LD or name");
  });
});

describe("parseExortstoreProductUrls", () => {
  it("extracts and dedupes product links from the category page", () => {
    const categoryHtml = `
      <a href="https://exortstore.com/product/boat-smart-watch-xtend-sport-fq9om">BoAt Smart Watch</a>
      <a href="https://exortstore.com/product/boat-smart-watch-xtend-sport-fq9om">BoAt Smart Watch (image link)</a>
      <a href="https://exortstore.com/product/alewa-moon-amoled-smartwatch-bt-call-3atm-dual-strap-sxfus">Alewa Moon</a>
      <a href="https://exortstore.com/category/smart-watch">Not a product link</a>
    `;
    expect(parseExortstoreProductUrls(categoryHtml, 10)).toEqual([
      "https://exortstore.com/product/boat-smart-watch-xtend-sport-fq9om",
      "https://exortstore.com/product/alewa-moon-amoled-smartwatch-bt-call-3atm-dual-strap-sxfus",
    ]);
  });

  it("respects the limit", () => {
    const categoryHtml = `
      <a href="https://exortstore.com/product/a">A</a>
      <a href="https://exortstore.com/product/b">B</a>
      <a href="https://exortstore.com/product/c">C</a>
    `;
    expect(parseExortstoreProductUrls(categoryHtml, 2)).toEqual(["https://exortstore.com/product/a", "https://exortstore.com/product/b"]);
  });
});
