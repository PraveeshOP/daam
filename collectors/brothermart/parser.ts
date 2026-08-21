import type { StoreProduct } from "@/collectors/evo/types";

type ShopifyVariant = {
  id: number;
  title: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price: string;
  available?: boolean;
  featured_image?: { src?: string } | null;
};
type ShopifyImage = { src?: string };
type ShopifyOption = { name: string; position: number };
export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  variants: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: ShopifyOption[];
};
export type ShopifyProductsResponse = { products: ShopifyProduct[] };

/**
 * Which of `variant.option1`/`option2`/`option3` holds the color vs. the storage isn't fixed —
 * verified live across real Brother Mart smartphones: most list Color first then Storage, but at
 * least one ("Samsung Galaxy Z Fold8 Ultra 5G") lists Storage first. `product.options[]` names
 * each slot, so read by name rather than assuming a position.
 */
function optionValue(product: ShopifyProduct, variant: ShopifyVariant, namePattern: RegExp): string | undefined {
  const position = product.options?.find((option) => namePattern.test(option.name))?.position;
  if (!position) return undefined;
  const value = variant[`option${position}` as "option1" | "option2" | "option3"];
  return value && value !== "Default Title" ? value : undefined;
}

/** "4GB+128GB"-style storage option → {ram: "4GB", storage: "128GB"} — Brother Mart's own combined
 * shorthand, distinct from Mobilemandu's "(8/256)" and Hukut's "4/128GB" formats (each store's own
 * convention, none reusable verbatim — see collectors/mobilemandu/parser.ts and
 * collectors/hukut/parser.ts). Falls back to the raw value when it doesn't match (some non-phone
 * categories on this site use plain "256GB" with no combined RAM figure). */
function extractRamStorage(value?: string): { ram?: string; storage?: string } {
  if (!value) return {};
  const combined = value.match(/(\d+\s*[gt]b)\s*\+\s*(\d+\s*[gt]b)/i);
  if (combined) return { ram: combined[1].replace(/\s+/g, "").toUpperCase(), storage: combined[2].replace(/\s+/g, "").toUpperCase() };
  return /\d+\s*[gt]b/i.test(value) ? { storage: value } : {};
}

const toPrice = (value: string) => {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
};

/**
 * Never key on Shopify's own `sku` field — verified live on Brother Mart it is inconsistently
 * blank, reused, or (on some products) literally the variant id restated as a string, across
 * every product sampled. The variant's own numeric `id` is the one field confirmed stable and
 * unique per purchasable option (color × storage combo) — same lesson this codebase has already
 * learned from Evo, ITTI, and the shared matcher's slug-suffix fix.
 *
 * Only one color per distinct storage option is kept — verified live that same-storage variants
 * of different colors (e.g. Honor X5d's Black and Blue, both "4GB+64GB") share an identical
 * price. Neither Evo's nor ITTI's phone collectors explode by color (this codebase's established
 * convention is one row per distinct storage config, not per color — see the identical fix in
 * collectors/itechstore/parser.ts's `dedupeVariantsByTitle`), so exploding every color here would
 * just add price-identical near-duplicate rows.
 */
export function parseBrothermartProducts(response: ShopifyProductsResponse, limit: number): StoreProduct[] {
  const rows: StoreProduct[] = [];
  for (const product of response.products) {
    const fallbackImage = product.images?.[0]?.src;
    const seenStorageOptions = new Set<string | undefined>();
    for (const variant of product.variants) {
      const storageOption = optionValue(product, variant, /storage|variant/i);
      if (seenStorageOptions.has(storageOption)) continue;
      seenStorageOptions.add(storageOption);

      const price = toPrice(variant.price);
      if (!price) continue;
      const color = optionValue(product, variant, /color/i);
      const { ram, storage } = extractRamStorage(storageOption);
      const name = storageOption ? `${product.title} ${storageOption}` : product.title;
      rows.push({
        externalId: String(variant.id),
        name,
        brand: product.vendor,
        color,
        ram,
        storage: storage || storageOption,
        price,
        currency: "NPR",
        imageUrl: variant.featured_image?.src || fallbackImage,
        productUrl: `https://brother-mart.com/products/${product.handle}?variant=${variant.id}`,
        availability: variant.available === undefined ? "unknown" : variant.available ? "in_stock" : "out_of_stock",
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}
