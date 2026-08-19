import { createServerSupabaseClient } from "@/lib/supabase/server";

/** The set of product ids the given user has favorited — used to render the ♥/♡ state on
 * cards without an extra round trip per card. Empty set (not an error) if nothing is saved. */
export async function getFavoriteProductIds(userId: string): Promise<Set<string>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("favorites").select("product_id").eq("user_id", userId);
  if (error || !data) return new Set();
  return new Set(data.map((row) => row.product_id));
}

export type FavoriteProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  lowestPrice: number;
  storeCount: number;
  savedAt: string;
};

type FavoriteRow = {
  created_at: string;
  products: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    image_url: string | null;
    offers: { price: number | string; availability: string }[] | null;
  } | null;
};

/** Favorites for the /favorites page: joins straight to each product's offers so the lowest
 * current price and store count can be shown without a second query per item. */
export async function getFavoriteProducts(userId: string): Promise<FavoriteProduct[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("created_at, products(id, slug, name, brand, image_url, offers(price, availability))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as unknown as FavoriteRow[])
    .filter((row): row is FavoriteRow & { products: NonNullable<FavoriteRow["products"]> } => Boolean(row.products))
    .map((row) => {
      const offers = row.products.offers || [];
      const inStock = offers.filter((offer) => offer.availability === "in_stock");
      const prices = (inStock.length ? inStock : offers).map((offer) => Number(offer.price));
      return {
        id: row.products.id,
        slug: row.products.slug,
        name: row.products.name,
        brand: row.products.brand,
        image: row.products.image_url || "/product-placeholder.svg",
        lowestPrice: prices.length ? Math.min(...prices) : 0,
        storeCount: offers.length,
        savedAt: row.created_at,
      };
    });
}
