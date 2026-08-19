import { createClient } from "@supabase/supabase-js";
import { categories, products, stores } from "@/lib/seed-data";
import type { Product, ProductWithOffers } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const enrich = (product: Product): ProductWithOffers => {
  const prices = product.offers.map((offer) => offer.price);
  return { ...product, stores: product.offers.length, lowestPrice: Math.min(...prices), highestPrice: Math.max(...prices), savings: Math.max(...prices) - Math.min(...prices) };
};

export async function getFeaturedProducts() {
  if (!supabase) return products.filter((product) => product.featured).map(enrich);
  const { data } = await supabase.from("products").select("*, offers(*), categories(name, slug)").eq("featured", true).limit(8);
  return data?.length ? (data as unknown as Product[]).map(enrich) : products.filter((product) => product.featured).map(enrich);
}

export async function searchProducts(query = "", category?: string) {
  if (!supabase) {
    const normalized = query.toLowerCase().trim();
    return products.filter((product) => (!normalized || `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(normalized)) && (!category || product.categorySlug === category)).map(enrich);
  }
  let request = supabase.from("products").select("*, offers(*), categories(name, slug)");
  if (query) request = request.or(`name.ilike.%${query}%,brand.ilike.%${query}%`);
  if (category) request = request.eq("categories.slug", category);
  const { data } = await request;
  return data?.length ? (data as unknown as Product[]).map(enrich) : [];
}

export async function getProduct(slug: string) {
  if (!supabase) return products.find((product) => product.slug === slug) ? enrich(products.find((product) => product.slug === slug)!) : null;
  const { data } = await supabase.from("products").select("*, offers(*), categories(name, slug)").eq("slug", slug).single();
  return data ? enrich(data as unknown as Product) : null;
}

export { categories, stores };
