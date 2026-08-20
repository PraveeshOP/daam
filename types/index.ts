export type Availability = "in_stock" | "out_of_stock";

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  accent: string;
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  delivery: string;
  /** Optional so the local seed-data fallback (no Supabase configured) doesn't need to specify
   * them — absent means "no affiliate program", the correct default either way. */
  affiliateEnabled?: boolean;
  partnershipStatus?: string;
};

export type Offer = {
  id: string;
  productId: string;
  storeId: string;
  externalId?: string;
  price: number;
  previousPrice?: number;
  availability: Availability;
  productUrl: string;
  affiliateUrl?: string;
  lastChecked: string;
  /** Raw ISO timestamp, kept alongside the display-formatted `lastChecked` string above (which
   * isn't reliably parseable — the seed-data fallback uses values like "Today"/"Yesterday") so a
   * staleness check has something real to compare against. Optional for the same reason:
   * absent (seed-data fallback) just means "skip the staleness check", the correct default. */
  lastCheckedAt?: string;
};

export type PricePoint = { label: string; price: number };

export type Product = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  categorySlug: string;
  description: string;
  image: string;
  specs: { label: string; value: string }[];
  offers: Offer[];
  offerStores?: Store[];
  history: PricePoint[];
  rating: number;
  reviewCount: number;
  featured?: boolean;
  createdAt?: string;
};

export type ProductWithOffers = Product & {
  stores: number;
  lowestPrice: number;
  highestPrice: number;
  savings: number;
};
