export type Availability = "in_stock" | "out_of_stock" | "unknown";

export type StoreProduct = {
  externalId?: string;
  name: string;
  brand?: string;
  model?: string;
  storage?: string;
  ram?: string;
  color?: string;
  price: number;
  currency: "NPR";
  imageUrl?: string;
  productUrl: string;
  availability?: Availability;
  description?: string;
  specifications?: Record<string, string>;
};

export type CollectionSummary = {
  discovered: number;
  priceChanges: number;
  matchedProducts: number;
  createdProducts: number;
  createdOffers: number;
  updatedOffers: number;
  uncertainMatches: { name: string; candidate: string; confidence: number }[];
  errors: { url: string; message: string }[];
  /** §H1 (phase-9): genuine price changes that swung >5x or <0.2x from the last recorded price —
   * still written (never silently dropped), just flagged for admin review. */
  priceAnomalies: { name: string; oldPrice: number; newPrice: number }[];
};
