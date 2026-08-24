import { describe, expect, it } from "vitest";
import { parseNepomartProduct, parseNepomartProductUrls } from "@/collectors/nepomart/parser";

/** A trimmed-down reconstruction of the real page structure verified live on
 * nepomart.com/product/t800-smart-iwatch-ultra-... — the JSON-LD `brand.name` is a hardcoded
 * literal "0" (a confirmed platform bug, not a real brand), price only exists as a hidden form
 * input (no offers/price in JSON-LD at all), and the real numeric id only exists in a
 * `_BROTERMID` script property, not in JSON-LD or sku. */
function buildPageHtml(price = "699", brotermId = "11") {
  return `
<html><body>
<script type="application/ld+json" bro-js-escape>${JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    name: "NEPOmart – The House of Gadgets | Best Online Gadget Store in Nepal || T800 Smart iWatch Ultra",
    image: "https://drive.brodox.com/uploads/83/23/07/64b02df6391a31307231689267702.jpg",
    brand: { "@type": "Brand", name: "0" },
    sku: "NPM-369",
  })}</script>
<span class="starlight-product-price me-3" brodox-target="brodox-product-display-price"> Rs ${price}.00 </span>
<input type="hidden" value="${price}" brodox-target="brodox-product-hidden-display-price"/>
<script>
Object.defineProperty(window, '_BROTERMID', {value: ${brotermId} ,writable: false,configurable: false});
</script>
</body></html>`;
}

describe("Nepomart parser (Brodox platform — no JSON-LD price/offers at all, brand field is a hardcoded platform bug)", () => {
  it("strips the site-wide tagline prefix from the JSON-LD name (this product uses a '||' separator)", () => {
    const [product] = parseNepomartProduct(buildPageHtml(), "https://www.nepomart.com/product/t800-smart-iwatch-ultra");
    expect(product.name).toBe("T800 Smart iWatch Ultra");
  });

  it("§inconsistent-separator regression: also strips the tagline when a product uses a single '|' instead of '||' — found live on a real product ('M10 Wireless TWS Bluetooth Earbuds') where a naive split on '||' left the whole tagline attached to the name", () => {
    const html = buildPageHtml().replace(
      '"NEPOmart – The House of Gadgets | Best Online Gadget Store in Nepal || T800 Smart iWatch Ultra"',
      '"NEPOmart – The House of Gadgets | Best Online Gadget Store in Nepal | M10 Wireless TWS Bluetooth Earbuds"',
    );
    const [product] = parseNepomartProduct(html, "https://www.nepomart.com/product/m10-earbuds");
    expect(product.name).toBe("M10 Wireless TWS Bluetooth Earbuds");
  });

  it("reads price from the hidden form input, since JSON-LD has no offers/price field at all", () => {
    const [product] = parseNepomartProduct(buildPageHtml("699"), "https://www.nepomart.com/product/x");
    expect(product.price).toBe(699);
  });

  it("uses the _BROTERMID numeric id as external id, never the free-text sku", () => {
    const [product] = parseNepomartProduct(buildPageHtml("699", "11"), "https://www.nepomart.com/product/x");
    expect(product.externalId).toBe("11");
  });

  it("never trusts JSON-LD brand.name, which is a hardcoded '0' platform bug — leaves brand undefined for a generic clone model with no real manufacturer prefix", () => {
    const [product] = parseNepomartProduct(buildPageHtml(), "https://www.nepomart.com/product/x");
    expect(product.brand).toBeUndefined();
  });

  it("rejects a page with no _BROTERMID id present", () => {
    const html = buildPageHtml().replace(/_BROTERMID.*?\);/, "");
    expect(() => parseNepomartProduct(html, "https://www.nepomart.com/product/x")).toThrow("missing _BROTERMID product id");
  });

  it("rejects a page with no usable price", () => {
    const html = buildPageHtml().replace(/<input type="hidden" value="699"[^/]*\/>/, "");
    expect(() => parseNepomartProduct(html, "https://www.nepomart.com/product/x")).toThrow("missing or invalid price");
  });

  it("rejects a page with no Product JSON-LD at all", () => {
    expect(() => parseNepomartProduct("<html><body>nothing here</body></html>", "https://www.nepomart.com/product/x")).toThrow("missing product JSON-LD or name");
  });
});

describe("parseNepomartProductUrls", () => {
  const sitemap = `
    <urlset>
      <url><loc>https://www.nepomart.com/product/t800-smart-iwatch-ultra-bluetooth-calling-smartwatch</loc></url>
      <url><loc>https://www.nepomart.com/product/s8-ultra-smartwatch-bluetooth-calling</loc></url>
      <url><loc>https://www.nepomart.com/product/t800-smart-iwatch-ultra-bluetooth-calling-smartwatch</loc></url>
      <url><loc>https://www.nepomart.com/product/boat-nirvana-earbuds</loc></url>
      <url><loc>https://www.nepomart.com/product/classic-analog-wrist-watch-for-men</loc></url>
      <url><loc>https://www.nepomart.com/product/hair-clipper-trimmer-kit</loc></url>
    </urlset>`;

  it("keeps only smartwatch/earbuds-hinted URLs, dedupes exact-duplicate sitemap entries, and drops false positives (analog watches, unrelated categories)", () => {
    expect(parseNepomartProductUrls(sitemap, 10)).toEqual([
      "https://www.nepomart.com/product/t800-smart-iwatch-ultra-bluetooth-calling-smartwatch",
      "https://www.nepomart.com/product/s8-ultra-smartwatch-bluetooth-calling",
      "https://www.nepomart.com/product/boat-nirvana-earbuds",
    ]);
  });
});
