export type Availability = "in_stock" | "out_of_stock" | "unknown";

export type StoreProduct = {
  externalId?: string;
  name: string;
  brand?: string;
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
  imported: number;
  updated: number;
  skipped: number;
  priceChanges: number;
  errors: { url: string; message: string }[];
};
