import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UserAlert = {
  id: string;
  productId: string;
  targetPrice: number;
  currency: string;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
};

/** The signed-in user's alert for one product, if they have one — used to prefill the
 * product-page alert form in "edit" mode instead of "create" mode. */
export async function getUserAlertForProduct(userId: string, productId: string): Promise<UserAlert | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, product_id, target_price, currency, is_active, triggered_at, created_at")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    productId: data.product_id,
    targetPrice: Number(data.target_price),
    currency: data.currency,
    isActive: data.is_active,
    triggeredAt: data.triggered_at,
    createdAt: data.created_at,
  };
}

export type UserAlertWithProduct = UserAlert & {
  productName: string;
  productSlug: string;
  productImage: string;
  currentLowestPrice: number;
};

/** All of the signed-in user's alerts for the /alerts page, joined with just enough product
 * info to render the list without a query per row. */
export async function getUserAlerts(userId: string): Promise<UserAlertWithProduct[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, product_id, target_price, currency, is_active, triggered_at, created_at, products(name, slug, image_url, offers(price, availability))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type Row = {
    id: string;
    product_id: string;
    target_price: number;
    currency: string;
    is_active: boolean;
    triggered_at: string | null;
    created_at: string;
    products: { name: string; slug: string; image_url: string | null; offers: { price: number | string; availability: string }[] | null } | null;
  };

  return (data as unknown as Row[])
    .filter((row): row is Row & { products: NonNullable<Row["products"]> } => Boolean(row.products))
    .map((row) => {
      const offers = row.products.offers || [];
      const inStock = offers.filter((offer) => offer.availability === "in_stock");
      const prices = (inStock.length ? inStock : offers).map((offer) => Number(offer.price));
      return {
        id: row.id,
        productId: row.product_id,
        targetPrice: Number(row.target_price),
        currency: row.currency,
        isActive: row.is_active,
        triggeredAt: row.triggered_at,
        createdAt: row.created_at,
        productName: row.products.name,
        productSlug: row.products.slug,
        productImage: row.products.image_url || "/product-placeholder.svg",
        currentLowestPrice: prices.length ? Math.min(...prices) : 0,
      };
    });
}
