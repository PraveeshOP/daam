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
};

export type Offer = {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  previousPrice?: number;
  availability: Availability;
  productUrl: string;
  lastChecked: string;
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
