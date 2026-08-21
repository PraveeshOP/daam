import { describe, expect, it } from "vitest";
import { parseNeostoreProduct, parseNeostoreProductLinks } from "@/collectors/neostore/parser";

/**
 * A trimmed-down reconstruction of the real markup structure verified live on
 * neostore.com.np — deliberately includes the nav-menu "Shop By Brands" link (appearing before
 * the real breadcrumb) and a second, unrelated product block, since those are exactly what made
 * a naive whole-document search unreliable when this was first reverse-engineered.
 */
const page = `
<html><body>
<nav><a href="/product-category/shop-by-brands">Shop By Brands</a> <a href="/product-category/shop-by-brands">Shop By Brands</a></nav>
<div class="product type-product post-99999 instock product_cat-mobile-brands"><span>unrelated related product</span></div>
<nav class="woocommerce-breadcrumb"><a href="/">Home</a><span class="delimiter">/</span> <a href="/product-category/shop-by-brands">Shop By Brands</a><span class="delimiter">/</span> <a href="/product-category/ezviz">EZVIZ</a></nav>
<h1 class="product_title entry-title">EZVIZ H3c 2MP Outdoor WiFi Camera | CS-H3c-R100-1K2WFL</h1>
<div class="summary entry-summary">
  <p class="price">
    <span class="electro-price"><ins>
      <span class="woocommerce-Price-amount amount price-first"><bdi>
        <span class="woocommerce-Price-currencySymbol">Rs.</span>&nbsp;6,517
      </bdi></span>
    </ins> <del><span class="woocommerce-Price-amount amount"><bdi>Rs.&nbsp;7,999</bdi></span></del></span>
  </p>
  <div class="cart">
    <button type="submit" id="btn_variation" name="add-to-cart" value="16804" class="single_add_to_cart_button button alt">Buy Now</button>
  </div>
</div>
</body></html>
`;

const outOfStockPage = page.replace('class="single_add_to_cart_button button alt"', 'class="single_add_to_cart_button button alt disabled"');
const noButtonPage = page.replace(/<button[^>]*single_add_to_cart_button[^>]*>Buy Now<\/button>/, "");

describe("Neostore parser (raw-HTML scraper — no JSON-LD/API on this site)", () => {
  it("extracts title/brand/price scoped to the real product, ignoring repeated nav-menu text and unrelated product blocks earlier on the page", () => {
    const [product] = parseNeostoreProduct(page, "https://www.neostore.com.np/product/ezviz-h3c-2mp-outdoor-wifi-camera-cs-h3c-r100-1k2wfl");
    expect(product).toMatchObject({
      name: "EZVIZ H3c 2MP Outdoor WiFi Camera | CS-H3c-R100-1K2WFL",
      brand: "EZVIZ",
      price: 6517,
      currency: "NPR",
      availability: "in_stock",
      externalId: "ezviz-h3c-2mp-outdoor-wifi-camera-cs-h3c-r100-1k2wfl",
    });
  });

  it("prefers the sale price (inside <ins>) over the original (inside <del>)", () => {
    const [product] = parseNeostoreProduct(page, "https://www.neostore.com.np/product/x");
    expect(product.price).toBe(6517);
    expect(product.price).not.toBe(7999);
  });

  it("treats a disabled add-to-cart button as out of stock", () => {
    const [product] = parseNeostoreProduct(outOfStockPage, "https://www.neostore.com.np/product/x");
    expect(product.availability).toBe("out_of_stock");
  });

  it("treats a missing add-to-cart button as out of stock too", () => {
    const [product] = parseNeostoreProduct(noButtonPage, "https://www.neostore.com.np/product/x");
    expect(product.availability).toBe("out_of_stock");
  });

  it("rejects a page with no product title", () => {
    expect(() => parseNeostoreProduct("<html><body>nothing here</body></html>", "https://www.neostore.com.np/product/x")).toThrow("missing product title");
  });

  it("uses the URL path as externalId rather than trusting an unreliable/absent sku", () => {
    const [product] = parseNeostoreProduct(page, "https://www.neostore.com.np/product/some-other-slug/");
    expect(product.externalId).toBe("some-other-slug");
  });
});

describe("parseNeostoreProductLinks", () => {
  it("extracts and dedupes product links from a category page", () => {
    const categoryHtml = `
      <a href="https://www.neostore.com.np/product/ezviz-h3c-2mp-outdoor-wifi-camera-cs-h3c-r100-1k2wfl">Camera 1</a>
      <a href="https://www.neostore.com.np/product/ezviz-h3c-2mp-outdoor-wifi-camera-cs-h3c-r100-1k2wfl">Camera 1 (duplicate link, e.g. image + title)</a>
      <a href="https://www.neostore.com.np/product/hikvision-2-mp-fixed-mini-bullet-camera-ds-2ce16d0t-exipf">Camera 2</a>
      <a href="https://www.neostore.com.np/product-category/ezviz">Not a product link</a>
    `;
    expect(parseNeostoreProductLinks(categoryHtml, 10)).toEqual([
      "https://www.neostore.com.np/product/ezviz-h3c-2mp-outdoor-wifi-camera-cs-h3c-r100-1k2wfl",
      "https://www.neostore.com.np/product/hikvision-2-mp-fixed-mini-bullet-camera-ds-2ce16d0t-exipf",
    ]);
  });

  it("respects the limit", () => {
    const categoryHtml = `
      <a href="https://www.neostore.com.np/product/a">A</a>
      <a href="https://www.neostore.com.np/product/b">B</a>
      <a href="https://www.neostore.com.np/product/c">C</a>
    `;
    expect(parseNeostoreProductLinks(categoryHtml, 2)).toEqual(["https://www.neostore.com.np/product/a", "https://www.neostore.com.np/product/b"]);
  });
});
