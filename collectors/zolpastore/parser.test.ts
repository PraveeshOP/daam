import { describe, expect, it } from "vitest";
import { parseZolpastoreProduct, parseZolpastoreProductUrls, ZOLPASTORE_LAPTOP_CATEGORY } from "@/collectors/zolpastore/parser";

/** A trimmed-down reconstruction of the real page structure verified live on zolpastore.com
 * (lenovo-thinkpad-e14-gen-5) — deliberately includes an empty JSON-LD `image: []` (confirmed
 * always empty on this site, never a sporadic bug) and the `<link rel="preload" as="image">` tag
 * that is the actual reliable image source here, since OG tags on this site are always the
 * site-wide default logo, not the product photo. */
function buildPageHtml(category: string, offers: Record<string, unknown> = {}) {
  return `
<html><head>
<link rel="preload" as="image" href="https://api.zolpastore.com/modules/files/162925190820263QDpBp.jpg" />
<meta property="og:image" content="https://zolpastore.com/images/logo.png" />
</head><body>
<script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Lenovo ThinkPad E14 Core i5 13420H Price in Nepal",
    description: "The Lenovo ThinkPad E14 Gen 5 is a business-focused laptop.",
    image: [],
    category,
    brand: { "@type": "Brand", name: "Lenovo" },
    offers: { "@type": "Offer", url: "https://zolpastore.com/shop/lenovo-thinkpad-e14-gen-5-intel-core-i5-13420h-price-in-nepal", price: "126999.00", priceCurrency: "NPR", availability: "https://schema.org/InStock", ...offers },
  })}</script>
<script type="application/ld+json">${JSON.stringify({ "@type": "BreadcrumbList", itemListElement: [] })}</script>
</body></html>`;
}

describe("Zolpa Store parser (JSON-LD Product — image field is always empty, uses a preload <link> fallback)", () => {
  it("extracts name/brand/price/description and strips the 'Price in Nepal' SEO suffix", () => {
    const [product] = parseZolpastoreProduct(buildPageHtml("Laptop"), "https://zolpastore.com/shop/lenovo-thinkpad-e14-gen-5-intel-core-i5-13420h-price-in-nepal", ZOLPASTORE_LAPTOP_CATEGORY);
    expect(product).toMatchObject({
      externalId: "lenovo-thinkpad-e14-gen-5-intel-core-i5-13420h-price-in-nepal",
      name: "Lenovo ThinkPad E14 Core i5 13420H",
      brand: "Lenovo",
      price: 126999,
      currency: "NPR",
      availability: "in_stock",
      imageUrl: "https://api.zolpastore.com/modules/files/162925190820263QDpBp.jpg",
    });
  });

  it("never uses the always-generic og:image as the product image", () => {
    const [product] = parseZolpastoreProduct(buildPageHtml("Laptop"), "https://zolpastore.com/shop/x", ZOLPASTORE_LAPTOP_CATEGORY);
    expect(product.imageUrl).not.toBe("https://zolpastore.com/images/logo.png");
  });

  it("rejects a page whose category doesn't match, as an expected skip (e.g. a custom PC build)", () => {
    expect(() => parseZolpastoreProduct(buildPageHtml("Custom PC"), "https://zolpastore.com/shop/x", ZOLPASTORE_LAPTOP_CATEGORY)).toThrow("unexpected category");
  });

  it("reflects out-of-stock availability", () => {
    const [product] = parseZolpastoreProduct(buildPageHtml("Laptop", { availability: "https://schema.org/OutOfStock" }), "https://zolpastore.com/shop/x", ZOLPASTORE_LAPTOP_CATEGORY);
    expect(product.availability).toBe("out_of_stock");
  });

  it("rejects a page with no Product JSON-LD at all", () => {
    expect(() => parseZolpastoreProduct("<html><body>nothing here</body></html>", "https://zolpastore.com/shop/x", ZOLPASTORE_LAPTOP_CATEGORY)).toThrow("missing product JSON-LD or name");
  });

  it("uses the URL slug as external id — this site's own sku field is a giant unstable slugified string, never trusted", () => {
    const [product] = parseZolpastoreProduct(buildPageHtml("Laptop"), "https://zolpastore.com/shop/some-other-slug/", ZOLPASTORE_LAPTOP_CATEGORY);
    expect(product.externalId).toBe("some-other-slug");
  });
});

describe("parseZolpastoreProductUrls", () => {
  const sitemap = `
    <urlset>
      <url><loc>https://zolpastore.com/shop/lenovo-thinkpad-e14-gen-5-intel-core-i5-13420h-price-in-nepal</loc></url>
      <url><loc>https://zolpastore.com/shop/apple-iphone-16</loc></url>
      <url><loc>https://zolpastore.com/shop/mikuso-peipah-6-fan-laptop-cooling-pad-best-price-in-nepal</loc></url>
      <url><loc>https://zolpastore.com/shop/build-your-gaming-pc-ryzen-5-5500-price-in-nepal</loc></url>
    </urlset>`;

  it("keeps only laptop-hinted URLs and drops accessory/custom-PC-build false positives", () => {
    expect(parseZolpastoreProductUrls(sitemap, 10)).toEqual(["https://zolpastore.com/shop/lenovo-thinkpad-e14-gen-5-intel-core-i5-13420h-price-in-nepal"]);
  });
});
