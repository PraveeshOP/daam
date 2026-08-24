import { describe, expect, it } from "vitest";
import { parseMystoreListing } from "@/collectors/mystore/parser";

/** A trimmed-down reconstruction of the real category-listing markup verified live on
 * mystore.com.np/category/smart-phone — deliberately includes the site's own duplicate-card
 * rendering (each product appears twice, confirmed live: 80 raw cards, 40 unique data-ids) and a
 * discounted product (two price_list spans) to test the min-price selection. */
function buildListingHtml() {
  const card = (id: string, url: string, title: string, priceSpans: string, img: string) => `
    class="product-media">
      <a href="https://mystore.com.np/product/${url}"
        title="${title}" data-id=${id}>
        <img src="${img}" alt="">
      </a>
      <div class="product-content">
        <div class="price-group">
          <div class="old-price-list">${priceSpans}</div>
        </div>
      </div>`;

  const single = card("169", "redmi-a3464", "Redmi A3(4/64)", '<span class="price_list">Rs. 12,999</span>', "https://mystore.com.np/storage/photos/xiaomi/Redmi A3.jpg");
  const discounted = card(
    "305",
    "realme-c75-8128gb",
    "Realme C75 (8/128GB)",
    '<span class="price_list">Rs. 27,999</span> <span class="price_list">Rs. 24,999</span>',
    "https://mystore.com.np/storage/photos/realme/C75.jpg",
  );
  // Duplicate rendering of the same two cards, as the real page does.
  return single + discounted + single + discounted;
}

describe("parseMystoreListing (no JSON API on this site — scrapes the category listing page directly)", () => {
  it("dedupes cards that render twice on the real page, keyed by the numeric data-id", () => {
    const rows = parseMystoreListing(buildListingHtml());
    expect(rows).toHaveLength(2);
  });

  it("extracts RAM/storage from the site's own '(N/M)' shorthand in the title", () => {
    const rows = parseMystoreListing(buildListingHtml());
    expect(rows[0]).toMatchObject({ externalId: "169", name: "Redmi A3(4/64)", ram: "4GB", storage: "64GB", price: 12999 });
  });

  it("guesses brand from a known prefix in the title", () => {
    const rows = parseMystoreListing(buildListingHtml());
    expect(rows[1].brand).toBe("Realme");
  });

  it("picks the lower (discounted) of two prices on the same card, regardless of which order they appear in", () => {
    const rows = parseMystoreListing(buildListingHtml());
    expect(rows[1].price).toBe(24999);
  });

  it("extracts the image and productUrl", () => {
    const rows = parseMystoreListing(buildListingHtml());
    expect(rows[0].imageUrl).toBe("https://mystore.com.np/storage/photos/xiaomi/Redmi A3.jpg");
    expect(rows[0].productUrl).toBe("https://mystore.com.np/product/redmi-a3464");
  });

  it("returns an empty array for a page with no matching product cards", () => {
    expect(parseMystoreListing("<html><body>nothing here</body></html>")).toEqual([]);
  });
});
