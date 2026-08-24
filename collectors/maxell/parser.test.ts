import { describe, expect, it } from "vitest";
import { parseMaxellProduct, parseMaxellProductUrls, MAXELL_LAPTOP_CATEGORY } from "@/collectors/maxell/parser";

/** A trimmed-down reconstruction of a real Maxell Computer product page's JSON-LD, verified live
 * against https://maxell.com.np/product/acer-nitro-5-10th-gen-.... */
function buildPageHtml(category: string, availability = "https://schema.org/InStock") {
  return `
<html><body>
<script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Acer NITRO 5 10th Gen i5-10300H, 8GB RAM, 256GB SSD 15.6&quot; FULL HD 60hz, GTX 1650 4GB Gaming Laptop",
    sku: "ACE-000001",
    brand: { "@type": "Brand", name: "Acer" },
    image: ["https://api.maxell.com.np/storage/products/1/01-98e9c7d2fd07.png"],
    category,
    offers: { "@type": "Offer", price: 92000, priceCurrency: "NPR", availability, url: "https://maxell.com.np/product/acer-nitro-5-10th-gen-i5-10300h-8gb-ram-256gb-ssd-156-full-hd-60hz-gtx-1650-4gb-gaming-laptop" },
  })}</script>
</body></html>`;
}

describe("Maxell Computer parser (JSON-LD — public API was retired, 410 Gone)", () => {
  it("uses the URL slug as external id — this site's sku formats are wildly inconsistent, never trusted, and the real numeric id is only in a fragile RSC parse this collector avoids", () => {
    const [product] = parseMaxellProduct(buildPageHtml("Laptops"), "https://maxell.com.np/product/acer-nitro-5-10th-gen-i5-10300h-8gb-ram-256gb-ssd-156-full-hd-60hz-gtx-1650-4gb-gaming-laptop", MAXELL_LAPTOP_CATEGORY);
    expect(product.externalId).toBe("acer-nitro-5-10th-gen-i5-10300h-8gb-ram-256gb-ssd-156-full-hd-60hz-gtx-1650-4gb-gaming-laptop");
  });

  it("reads brand directly from JSON-LD, which is reliable on this site (unlike Computer Planet's sub-series brand field)", () => {
    const [product] = parseMaxellProduct(buildPageHtml("Laptops"), "https://maxell.com.np/product/x", MAXELL_LAPTOP_CATEGORY);
    expect(product.brand).toBe("Acer");
  });

  it("never sets imageUrl — api.maxell.com.np's image CDN has hotlink protection requiring a Referer matching maxell.com.np's own domain, which even a direct fetch from our own app's origin fails (verified live, 403), not something next/image's proxy can work around without spoofing the Referer", () => {
    const [product] = parseMaxellProduct(buildPageHtml("Laptops"), "https://maxell.com.np/product/x", MAXELL_LAPTOP_CATEGORY);
    expect(product.imageUrl).toBeUndefined();
  });

  it("extracts RAM/storage from the name, defending against the matcher's RAM-as-storage bug (collectors/core/matcher.ts)", () => {
    const [product] = parseMaxellProduct(buildPageHtml("Laptops"), "https://maxell.com.np/product/x", MAXELL_LAPTOP_CATEGORY);
    expect(product).toMatchObject({ ram: "8GB", storage: "256GB", price: 92000 });
  });

  it("reflects out-of-stock availability", () => {
    const [product] = parseMaxellProduct(buildPageHtml("Laptops", "https://schema.org/OutOfStock"), "https://maxell.com.np/product/x", MAXELL_LAPTOP_CATEGORY);
    expect(product.availability).toBe("out_of_stock");
  });

  it("rejects a page whose category doesn't match, as an expected skip", () => {
    expect(() => parseMaxellProduct(buildPageHtml("Desktops"), "https://maxell.com.np/product/x", MAXELL_LAPTOP_CATEGORY)).toThrow("unexpected category");
  });

  it("rejects a page with no Product JSON-LD at all", () => {
    expect(() => parseMaxellProduct("<html><body>nothing here</body></html>", "https://maxell.com.np/product/x", MAXELL_LAPTOP_CATEGORY)).toThrow("missing product JSON-LD or name");
  });
});

describe("parseMaxellProductUrls", () => {
  const sitemap = `
    <urlset>
      <url><loc>https://maxell.com.np/product/acer-nitro-5-10th-gen-i5-10300h-gaming-laptop</loc></url>
      <url><loc>https://maxell.com.np/product/some-random-mouse</loc></url>
      <url><loc>https://maxell.com.np/product/laptop-cooling-pad-rgb</loc></url>
    </urlset>`;

  it("keeps only laptop-hinted URLs and drops accessory false positives", () => {
    expect(parseMaxellProductUrls(sitemap, 10)).toEqual(["https://maxell.com.np/product/acer-nitro-5-10th-gen-i5-10300h-gaming-laptop"]);
  });
});
