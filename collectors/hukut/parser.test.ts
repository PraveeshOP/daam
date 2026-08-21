import { describe, expect, it } from "vitest";
import { parseHukutProduct, parseHukutProductUrls, HUKUT_LAPTOP_URL_HINT, HUKUT_LAPTOP_URL_EXCLUDE, HUKUT_LAPTOP_CATEGORY, PHONE_CATEGORY } from "@/collectors/hukut/parser";

/** A trimmed-down reconstruction of a real Hukut LAPTOP page (acer-aspire-7-a715-59g-76rm) —
 * verified live to use separate named "RAM"/"SSD" additionalProperty entries (not the phones'
 * combined "4/128GB" shorthand) and a `brand` field that names the marketing SERIES ("Aspire
 * Series"), not the manufacturer ("Acer") — both real bugs caught live-testing against this exact
 * shape before this fixture existed. */
function buildLaptopHtml(category: string, descriptionExtra = "") {
  return `
<html><body>
<script type="application/ld+json">${JSON.stringify({ "@type": "BreadcrumbList", itemListElement: [] })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@type": "ProductGroup",
    name: "Acer Aspire 7 A715-59G-76RM 2026",
    description: `<h1>Acer Aspire 7 Price in Nepal</h1><p>Gaming laptop with RTX 3050.</p>${descriptionExtra}`,
    image: ["https://cdn.hukut.com/Acer%20Aspire%207%20A715-59G-76RM%2020.png1786879915534"],
    brand: { "@type": "Brand", name: "Aspire Series" },
    category,
    hasVariant: [
      {
        "@type": "Product",
        name: "Acer Aspire 7 A715-59G-76RM 2026 (Intel Core 7 240H| RTX 3050 Graphics) – Obsidian Black, 1 Year Warranty, 16GB, 512GB",
        sku: "nr5xFoH7MyU3NVGU",
        brand: { "@type": "Brand", name: "Aspire Series" },
        color: "Obsidian Black",
        additionalProperty: [{ name: "Color Option", value: "Obsidian Black" }, { name: "Warranty ", value: "1 Year Warranty" }, { name: "RAM", value: "16GB" }, { name: "SSD", value: "512GB" }],
        offers: { "@type": "Offer", url: "https://hukut.com/acer-aspire-7-a715-59g-76rm-price-in-nepal", priceCurrency: "NPR", price: 157000, availability: "https://schema.org/InStock" },
      },
      {
        "@type": "Product",
        name: "Acer Aspire 7 A715-59G-76RM 2026 (Intel Core 7 240H| RTX 3050 Graphics)\r\n\r\n  – Obsidian Black, 1 Year Warranty, 32GB, 1TB",
        sku: "kfvNWrT9h4ScaZ8Q",
        brand: { "@type": "Brand", name: "Aspire Series" },
        color: "Obsidian Black",
        additionalProperty: [{ name: "RAM", value: "32GB" }, { name: "SSD", value: "1TB" }],
        offers: { "@type": "Offer", url: "https://hukut.com/acer-aspire-7-a715-59g-76rm-price-in-nepal", priceCurrency: "NPR", price: 189000, availability: "https://schema.org/OutOfStock" },
      },
    ],
  })}</script>
</body></html>`;
}

/** A trimmed-down reconstruction of a real Hukut PHONE page (redmi-17-5g) — additionalProperty
 * uses a single combined "Variant": "4/128GB" shorthand here, a genuinely different shape from
 * laptops' separate RAM/SSD fields, and `brand` correctly names the real manufacturer. */
function buildPhoneHtml(category: string) {
  return `
<html><body>
<script type="application/ld+json">${JSON.stringify({
    "@type": "ProductGroup",
    name: "Redmi 17 5G",
    image: ["https://cdn.hukut.com/Redmi%2017%205G.png1787035309053"],
    brand: { "@type": "Brand", name: "Xiaomi" },
    category,
    hasVariant: [{
      "@type": "Product",
      name: "Redmi 17 5G – Black, 4/128GB",
      sku: "7Pznn8Z7axqNTxBN",
      brand: { "@type": "Brand", name: "Xiaomi" },
      color: "Black",
      additionalProperty: [{ name: "Colors", value: "Black" }, { name: "Variant", value: "4/128GB" }],
      offers: { "@type": "Offer", url: "https://hukut.com/redmi-17-5g", priceCurrency: "NPR", price: 33999, availability: "https://schema.org/InStock" },
    }],
  })}</script>
</body></html>`;
}

describe("Hukut parser — laptops (RAM/SSD are separate named additionalProperty entries, not a combined shorthand)", () => {
  it("reads RAM and SSD from their own named properties, never conflating the two", () => {
    const products = parseHukutProduct(buildLaptopHtml("Gaming Laptops"), "https://hukut.com/acer-aspire-7-a715-59g-76rm-price-in-nepal", HUKUT_LAPTOP_CATEGORY);
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({ externalId: "nr5xFoH7MyU3NVGU", ram: "16GB", storage: "512GB", price: 157000, availability: "in_stock" });
    expect(products[1]).toMatchObject({ externalId: "kfvNWrT9h4ScaZ8Q", ram: "32GB", storage: "1TB", price: 189000, availability: "out_of_stock" });
  });

  it("derives the real manufacturer from the product name instead of Hukut's own brand field, which names a marketing series (e.g. 'Aspire Series') rather than the manufacturer", () => {
    const [product] = parseHukutProduct(buildLaptopHtml("Gaming Laptops"), "https://hukut.com/x", HUKUT_LAPTOP_CATEGORY);
    expect(product.brand).toBe("Acer");
  });

  it("collapses a literal CRLF glued into a variant name into a single space", () => {
    const products = parseHukutProduct(buildLaptopHtml("Gaming Laptops"), "https://hukut.com/x", HUKUT_LAPTOP_CATEGORY);
    expect(products[1].name).not.toMatch(/[\r\n]/);
    expect(products[1].name).toContain("RTX 3050 Graphics) – Obsidian Black");
  });

  it("cuts a description before any leaked chat-assistant-UI markup instead of storing it verbatim", () => {
    const leaked = ' [&:has([data-writing-block])>*]:pointer-events-auto R6Vx5W_threadScrollVars scroll-mb-[calc(var(--x,0px))]" dir="auto" data-turn-id="request-abc" data-testid="conversation-turn-254" data-turn="assistant">';
    const [product] = parseHukutProduct(buildLaptopHtml("Gaming Laptops", leaked), "https://hukut.com/x", HUKUT_LAPTOP_CATEGORY);
    expect(product.description).toContain("Acer Aspire 7 Price in Nepal Gaming laptop with RTX 3050.");
    expect(product.description).not.toContain("data-writing-block");
    expect(product.description).not.toContain("threadScrollVars");
    expect(product.description).not.toContain("conversation-turn");
  });

  it("matches a granular category string against a broader RegExp (e.g. 'Gaming Laptops' against /laptop/i)", () => {
    expect(() => parseHukutProduct(buildLaptopHtml("Gaming Laptops"), "https://hukut.com/x", HUKUT_LAPTOP_CATEGORY)).not.toThrow();
  });

  it("rejects a page whose category does not match the expected RegExp, as an expected skip not a parse failure", () => {
    expect(() => parseHukutProduct(buildPhoneHtml("Mobile Phones"), "https://hukut.com/x", HUKUT_LAPTOP_CATEGORY)).toThrow("unexpected category");
  });

  it("rejects a page with no ProductGroup/hasVariant JSON-LD at all", () => {
    expect(() => parseHukutProduct("<html><body>nothing here</body></html>", "https://hukut.com/x", HUKUT_LAPTOP_CATEGORY)).toThrow("missing product JSON-LD or variants");
  });
});

describe("Hukut parser — phones (additionalProperty 'Variant' shorthand fallback, kept for other Hukut categories reusing this parser)", () => {
  it("falls back to the combined 'N/MGB' shorthand when there's no separate RAM/SSD property", () => {
    const [product] = parseHukutProduct(buildPhoneHtml("Mobile Phones"), "https://hukut.com/redmi-17-5g", PHONE_CATEGORY);
    expect(product).toMatchObject({ externalId: "7Pznn8Z7axqNTxBN", brand: "Xiaomi", ram: "4GB", storage: "128GB", price: 33999 });
  });

  it("PHONE_CATEGORY matches the real 'Mobile Phones' category string", () => {
    expect(PHONE_CATEGORY.test("Mobile Phones")).toBe(true);
    expect(PHONE_CATEGORY.test("Gaming Laptops")).toBe(false);
  });
});

describe("parseHukutProductUrls", () => {
  const sitemap = `
    <urlset>
      <url><loc>https://hukut.com/lenovo-ideapad-slim-3-15arp10-ryzen-7-170-radeon-680m</loc></url>
      <url><loc>https://hukut.com/redmi-17-5g</loc></url>
      <url><loc>https://hukut.com/laptop-cooling-pad-rgb</loc></url>
    </urlset>`;

  it("keeps only laptop-hinted URLs and drops accessory false positives (blog-article false positives are filtered upstream by fetching products.xml, never pages.xml — see parseHukutProductUrls' docstring)", () => {
    const urls = parseHukutProductUrls(sitemap, HUKUT_LAPTOP_URL_HINT, HUKUT_LAPTOP_URL_EXCLUDE, 10);
    expect(urls).toEqual(["https://hukut.com/lenovo-ideapad-slim-3-15arp10-ryzen-7-170-radeon-680m"]);
  });

  it("respects the limit", () => {
    const bigSitemap = `<urlset>${["lenovo-legion-5", "asus-rog-strix", "acer-nitro-5"].map((slug) => `<url><loc>https://hukut.com/${slug}</loc></url>`).join("")}</urlset>`;
    expect(parseHukutProductUrls(bigSitemap, HUKUT_LAPTOP_URL_HINT, HUKUT_LAPTOP_URL_EXCLUDE, 2)).toHaveLength(2);
  });
});
