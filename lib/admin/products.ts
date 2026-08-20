import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  status: string;
  categoryName: string;
  storeCount: number;
  lowestPrice: number | null;
  createdAt: string;
};

export type AdminProductFilters = {
  search?: string;
  category?: string;
  brand?: string;
  status?: string;
};

const PAGE_SIZE = 20;

/** Server-side search/filter/pagination throughout — the admin product list is expected to
 * grow into the thousands (§25/§29), so nothing here loads more than one page at a time. */
export async function listAdminProducts(filters: AdminProductFilters, page: number) {
  const supabase = await createServerSupabaseClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select("id, name, slug, brand, status, created_at, categories(name), offers(price, availability, is_disabled)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("categories.slug", filters.category);
  if (filters.brand) query = query.ilike("brand", filters.brand);
  if (filters.search) {
    const safe = filters.search.replace(/[%,()]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,brand.ilike.%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error || !data) return { items: [] as AdminProductListItem[], total: 0 };

  type Row = {
    id: string;
    name: string;
    slug: string;
    brand: string;
    status: string;
    created_at: string;
    categories: { name: string } | null;
    offers: { price: number | string; availability: string; is_disabled: boolean }[] | null;
  };

  const items = (data as unknown as Row[]).map((row) => {
    const liveOffers = (row.offers || []).filter((offer) => !offer.is_disabled);
    const inStock = liveOffers.filter((offer) => offer.availability === "in_stock");
    const prices = (inStock.length ? inStock : liveOffers).map((offer) => Number(offer.price));
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brand: row.brand,
      status: row.status,
      categoryName: row.categories?.name || "Uncategorized",
      storeCount: liveOffers.length,
      lowestPrice: prices.length ? Math.min(...prices) : null,
      createdAt: row.created_at,
    };
  });

  return { items, total: count ?? items.length, pageSize: PAGE_SIZE };
}

export async function listBrands(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("products").select("brand").limit(2000);
  return [...new Set((data || []).map((row) => row.brand))].sort();
}

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  status: string;
  categoryId: string | null;
  categoryName: string;
  description: string | null;
  imageUrl: string | null;
  specifications: { label: string; value: string }[];
  mergedInto: string | null;
  createdAt: string;
  offers: { id: string; storeId: string; storeName: string; price: number; availability: string; isDisabled: boolean; lastChecked: string; productUrl: string }[];
  priceHistoryCount: number;
  lowestPrice: number | null;
  highestPrice: number | null;
  favoriteCount: number;
  activeAlertCount: number;
  matchCandidates: { id: string; direction: "duplicate-of" | "candidate-for"; otherProductId: string; otherProductName: string; confidence: number; status: string }[];
};

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, brand, status, category_id, description, image_url, specifications, merged_into, created_at, categories(name), offers(id, store_id, price, availability, is_disabled, last_checked, product_url, stores(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string; name: string; slug: string; brand: string; status: string; category_id: string | null;
    description: string | null; image_url: string | null; specifications: Record<string, string> | null;
    merged_into: string | null; created_at: string; categories: { name: string } | null;
    offers: { id: string; store_id: string; price: number | string; availability: string; is_disabled: boolean; last_checked: string; product_url: string; stores: { name: string } | null }[] | null;
  };

  const offers = row.offers || [];
  const prices = offers.map((offer) => Number(offer.price));

  const [{ count: priceHistoryCount }, { count: favoriteCount }, { count: activeAlertCount }, matchCandidates] = await Promise.all([
    supabase.from("price_history").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("price_alerts").select("id", { count: "exact", head: true }).eq("product_id", id).eq("is_active", true),
    supabase
      .from("product_match_candidates")
      .select("id, status, confidence, new_product_id, candidate_product_id, new:products!product_match_candidates_new_product_id_fkey(id, name), candidate:products!product_match_candidates_candidate_product_id_fkey(id, name)")
      .or(`new_product_id.eq.${id},candidate_product_id.eq.${id}`),
  ]);

  type MatchRow = { id: string; status: string; confidence: number; new_product_id: string; candidate_product_id: string; new: { id: string; name: string } | null; candidate: { id: string; name: string } | null };
  const matches = ((matchCandidates.data || []) as unknown as MatchRow[]).map((row2) => {
    const isNew = row2.new_product_id === id;
    return {
      id: row2.id,
      direction: (isNew ? "duplicate-of" : "candidate-for") as "duplicate-of" | "candidate-for",
      otherProductId: isNew ? row2.candidate_product_id : row2.new_product_id,
      otherProductName: (isNew ? row2.candidate?.name : row2.new?.name) || "Unknown product",
      confidence: Number(row2.confidence),
      status: row2.status,
    };
  });

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    status: row.status,
    categoryId: row.category_id,
    categoryName: row.categories?.name || "Uncategorized",
    description: row.description,
    imageUrl: row.image_url,
    specifications: Object.entries(row.specifications || {}).map(([label, value]) => ({ label, value: String(value) })),
    mergedInto: row.merged_into,
    createdAt: row.created_at,
    offers: offers.map((offer) => ({
      id: offer.id,
      storeId: offer.store_id,
      storeName: offer.stores?.name || "Unknown store",
      price: Number(offer.price),
      availability: offer.availability,
      isDisabled: offer.is_disabled,
      lastChecked: offer.last_checked,
      productUrl: offer.product_url,
    })),
    priceHistoryCount: priceHistoryCount ?? 0,
    lowestPrice: prices.length ? Math.min(...prices) : null,
    highestPrice: prices.length ? Math.max(...prices) : null,
    favoriteCount: favoriteCount ?? 0,
    activeAlertCount: activeAlertCount ?? 0,
    matchCandidates: matches,
  };
}
