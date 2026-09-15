import type { MarketplaceListing, MarketplaceCondition } from "@/collectors/core/types";

/**
 * HamroBazaar is Nepal's largest C2C classifieds site, not a retailer — every "product" here is
 * one individual's used-goods advert. See collectors/core/marketplace.ts for why these never
 * reach `offers`/`price_history`.
 *
 * robots.txt (fetched and read before writing this collector, 2026-09-14):
 *   Allow: /  /detail/  /category/  /search/product  ...
 *   Disallow: /api/  /profile  /settings  /boost/  /login
 *
 * That Disallow is the constraint that shapes this whole file. Verified live: the /category/ and
 * /search/product pages server-render only their subcategory chrome — the listing grid itself is
 * fetched client-side from `/api/...`, the disallowed prefix (the client bundle contains no
 * absolute API host at all, only relative "/api/products/search/autocomplete"-style paths). So
 * there is no robots-clean way to page through a category.
 *
 * The homepage *is* allowed and does server-render listings: its React Server Component flight
 * payload carries 80 complete listing objects (verified live — 19 distinct categories in one
 * fetch, including Mobile Phone Handsets, Laptops, Televisions and Headphones). That payload is
 * the only compliant source, so this collector reads it and accumulates coverage across runs
 * rather than sweeping a category in one pass.
 */
export const HAMROBAZAAR_ORIGIN = "https://hamrobazaar.com";

/** Verified live across all 80 listings in one homepage fetch: `condition` is a 1-3 enum and its
 * meaning is confirmed by the sibling `badge.text` the site renders next to it. */
const CONDITION_BY_CODE: Record<number, MarketplaceCondition> = { 1: "brand_new", 2: "like_new", 3: "used" };

type RawCreatorInfo = { createdByName?: string; createdByUsername?: string };
type RawListing = {
  id?: string;
  ad_Id?: string;
  name?: string;
  title?: string;
  brandName?: string;
  categoryName?: string;
  condition?: number;
  negotiable?: boolean;
  price?: number;
  image?: string;
  imageUrl?: string;
  createdOn?: string;
  /** Present in the payload and deliberately never read — see stripping note in toListing(). */
  creatorInfo?: RawCreatorInfo;
  description?: string;
};

/**
 * The flight payload is split across ~164 `self.__next_f.push([1,"<json string literal>"])`
 * calls, and a single listing object routinely straddles a chunk boundary. Every chunk must
 * therefore be unescaped and concatenated *before* anything is extracted from it; scanning the
 * raw HTML instead (matching the doubly-escaped `\"price\":` form) silently finds only the
 * subset of listings that happen to fall inside one chunk — that mistake undercounted this same
 * page as 30 listings when it really carries 80.
 */
export function extractFlightPayload(html: string): string {
  let payload = "";
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      payload += JSON.parse(match[1]) as string;
    } catch {
      // A chunk we can't unescape costs us the listings inside it, never the whole page.
    }
  }
  return payload;
}

/**
 * Brace-matches each `"item":{...}` object out of the payload. A regex can't do this: the
 * objects nest (creatorInfo, location, badge, productAttributeValues) and their string values
 * contain braces from seller-written free text, so the scan has to track string/escape state.
 */
export function extractItemObjects(payload: string): string[] {
  const marker = '"item":{';
  const objects: string[] = [];
  let cursor = 0;
  while ((cursor = payload.indexOf(marker, cursor)) !== -1) {
    const start = cursor + marker.length - 1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let index = start; index < payload.length; index++) {
      const character = payload[index];
      if (escaped) { escaped = false; continue; }
      if (character === "\\") { escaped = true; continue; }
      if (character === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (character === "{") depth += 1;
      else if (character === "}") { depth -= 1; if (depth === 0) { end = index; break; } }
    }
    if (end === -1) break; // truncated payload — keep whatever parsed cleanly before it
    objects.push(payload.slice(start, end + 1));
    cursor = end;
  }
  return objects;
}

/** `2026-09-14 15:18:56.3660000` — a space-separated, 7-fractional-digit stamp that `new Date()`
 * rejects outright in Node. Normalized to ISO here; the site serves Nepal time with no offset in
 * the string, so it is read as UTC rather than inventing a +05:45 the payload never states. */
export function parseListingTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(" ", "T").replace(/(\.\d{3})\d+$/, "$1");
  const parsed = new Date(`${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Verified live: the bare `/detail/{guid}` form returns HTTP 200 with the correct listing title
 * server-rendered. The site's own canonical is the longer
 * `/detail/{category}/{title}-in-{location}/{guid}`, but reproducing it would mean
 * reimplementing their slugifier (stop-word removal, length caps, a masked-location suffix) for
 * no gain — the short form is stable and resolves to the same page.
 */
export const listingUrl = (id: string) => `${HAMROBAZAAR_ORIGIN}/detail/${id}`;

/**
 * `brandName` is empty on every listing this site serves (verified across all 80 in one fetch),
 * which is why linking listings to canonical products was impossible before this existed: with no
 * brand the matcher's brand signal (+20) never fires, capping a true match at model (+40) +
 * storage (+25) = 65, under the >=75 bar — while a bare storage agreement still scored 25, so
 * "SanDisk Ultra Fit 128GB" ranked against "iPhone 16 128 GB".
 *
 * These are explicit token -> brand rules, not fuzzy inference. A title that matches nothing keeps
 * `brand` undefined rather than being assigned a guess, because a wrong brand is worse than none:
 * it manufactures the +20 that pushes a wrong candidate over the threshold. Measured on the real
 * catalogue, this links "Iphone 17 256gb" -> "iPhone 17 256 GB" at 85% while still correctly
 * rejecting SanDisk->iPhone (25%) and MacBook->iPhone 17 Pro (45%, brand agrees but model does not).
 *
 * Ordering matters: the first match wins, so a more specific token must precede a broader one.
 */
const BRAND_PATTERNS: [RegExp, string][] = [
  [/\b(iphone|macbook|ipad|airpods|imac|mac\s?mini|apple)\b/i, "Apple"],
  [/\b(galaxy|samsung)\b/i, "Samsung"],
  // Resellers write Samsung flagships as just "S26 Ultra" / "S25+" with no brand word at all.
  // Anchored to an S-series number followed by a Samsung tier marker, so it cannot fire on an
  // unrelated "s26" inside some other model code ("Bose S26 speaker" stays unbranded).
  // Two patterns because a trailing "\b" cannot follow the literal "+" in "S25+" — "+" and the
  // space after it are both non-word characters, so there is no boundary there to match.
  [/\bs\d{2}\s*(ultra|plus|fe)\b/i, "Samsung"],
  [/\bs\d{2}\s*\+/i, "Samsung"],
  [/\b(sandisk|cruzer)\b/i, "SanDisk"],
  [/\bseagate\b/i, "Seagate"],
  [/\b(wd|western\s?digital)\b/i, "Western Digital"],
  [/\bkingston\b/i, "Kingston"],
  [/\bugreen\b/i, "UGREEN"],
  [/\bjbl\b/i, "JBL"],
  [/\b(redmi|poco|xiaomi)\b/i, "Xiaomi"],
  [/\boneplus\b/i, "OnePlus"],
  [/\brealme\b/i, "Realme"],
  [/\bvivo\b/i, "Vivo"],
  [/\boppo\b/i, "Oppo"],
  [/\b(nothing\sphone|nothing\sear)\b/i, "Nothing"],
  [/\bhuawei\b/i, "Huawei"],
  [/\bhonor\b/i, "Honor"],
  [/\btecno\b/i, "Tecno"],
  [/\binfinix\b/i, "Infinix"],
  [/\bdell\b/i, "Dell"],
  [/\blenovo\b/i, "Lenovo"],
  [/\b(thinkpad|ideapad)\b/i, "Lenovo"],
  [/\basus\b/i, "Asus"],
  [/\bacer\b/i, "Acer"],
  [/\bmsi\b/i, "MSI"],
  [/\bhp\b/i, "HP"],
  [/\bsony\b/i, "Sony"],
  [/\bboat\b/i, "boAt"],
  [/\banker\b/i, "Anker"],
  [/\blogitech\b/i, "Logitech"],
  [/\bcanon\b/i, "Canon"],
  [/\bnikon\b/i, "Nikon"],
  [/\blg\b/i, "LG"],
];

/** Returns undefined when no rule matches — see BRAND_PATTERNS on why a guess is worse. */
export function inferBrandFromTitle(title: string): string | undefined {
  return BRAND_PATTERNS.find(([pattern]) => pattern.test(title))?.[1];
}

/**
 * Resellers pad titles with the same phrase repeated behind `>>` separators, verified live on 5 of
 * 12 collected listings — e.g. `"Iphone 17 256gb>>Iphone 17 256gb>>Iphone 17 256gb>"` and
 * `"Macbook Pro m5 pro 24/1TB>>Macbook pro m5 pro 1TB>"`. The text before the first `>>` is the
 * real title in every case sampled.
 *
 * The trigger is `>>` specifically, not a single `>`: a lone `>` plausibly appears in a genuine
 * title ("Type-C > HDMI"), so splitting on that would truncate real names. A trailing `>` is
 * trimmed either way since it never carries meaning.
 */
export function cleanListingTitle(title: string): string {
  const [firstSegment] = title.split(">>");
  return (firstSegment ?? title).replace(/[>\s]+$/, "").trim() || title.trim();
}

function toListing(raw: RawListing): MarketplaceListing | undefined {
  const externalId = raw.id?.trim();
  const rawTitle = (raw.name || raw.title)?.trim();
  if (!externalId || !rawTitle) return undefined;
  const title = cleanListingTitle(rawTitle);
  // Sellers price cars in lakhs here ("Honda WR-V ... 28.5", "Mahindra XUV500 ... 31.5" —
  // both real, both meaning lakh), so a low figure is a unit convention, not a typo. Nothing is
  // rescaled: guessing which listings meant lakh would corrupt the honest ones. Only a
  // non-positive or non-finite price is rejected outright.
  const price = Number(raw.price);
  if (!Number.isFinite(price) || price <= 0) return undefined;

  // Seller identity is deliberately dropped, not merely unused. Each raw listing carries
  // `creatorInfo.createdByName` (a real person's name) and `createdByUsername` (their phone
  // number), and seller-written `description` text routinely embeds a contact number too. None
  // of it is needed to compare prices, so none of it is returned from this parser and there is
  // no column for it in `marketplace_listings`.
  return {
    externalId,
    title,
    // `brandName` was empty on all 80 listings sampled, so in practice this always falls through
    // to the title rules; the field is still read first in case the site ever populates it.
    brand: raw.brandName?.trim() || inferBrandFromTitle(title),
    sourceCategory: raw.categoryName?.trim() || undefined,
    price,
    currency: "NPR",
    condition: CONDITION_BY_CODE[Number(raw.condition)] ?? "unknown",
    negotiable: Boolean(raw.negotiable),
    listingUrl: listingUrl(externalId),
    imageUrl: raw.image || raw.imageUrl || undefined,
    postedAt: parseListingTimestamp(raw.createdOn),
  };
}

export type ParseListingsResult = { listings: MarketplaceListing[]; skipped: number };

/**
 * The homepage feed is chronological across every category, so one fetch is dominated by
 * whatever was posted in the last few minutes (30 of the 80 sampled were Cars). `categories`
 * filters by the site's own `categoryName`, case-insensitively; `conditions` filters by the
 * mapped condition. Omit either to keep everything.
 *
 * Both are filters, not failures: a listing excluded by one is not counted in `skipped`, which
 * stays a signal that the payload shape has drifted rather than a count of things we chose to
 * ignore.
 */
export function parseHamrobazaarListings(html: string, options: { categories?: string[]; conditions?: MarketplaceCondition[] } = {}): ParseListingsResult {
  const wanted = options.categories?.map((category) => category.toLowerCase());
  const wantedConditions = options.conditions?.length ? new Set(options.conditions) : undefined;
  const byId = new Map<string, MarketplaceListing>();
  let skipped = 0;
  for (const raw of extractItemObjects(extractFlightPayload(html))) {
    let parsed: RawListing;
    try {
      parsed = JSON.parse(raw) as RawListing;
    } catch {
      skipped += 1;
      continue;
    }
    const listing = toListing(parsed);
    if (!listing) { skipped += 1; continue; }
    if (wanted && !wanted.includes((listing.sourceCategory || "").toLowerCase())) continue;
    if (wantedConditions && !wantedConditions.has(listing.condition)) continue;
    // The same advert can appear twice in one payload (a "featured"/boosted slot plus its
    // ordinary position in the feed), so the id is what de-duplicates, not position.
    byId.set(listing.externalId, listing);
  }
  return { listings: [...byId.values()], skipped };
}
