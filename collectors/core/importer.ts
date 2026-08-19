import { createClient } from "@supabase/supabase-js";
import { findBestMatch, productSlug } from "@/collectors/core/matcher";
import type { StoreProduct, CollectionSummary } from "@/collectors/evo/types";
import type { Database } from "@/types/database";
import { evaluateProductPriceAlerts } from "@/lib/alerts/evaluate";
import { logError } from "@/lib/logger";

type StoreConfig = { name: string; slug: string; websiteUrl: string; logoUrl?: string; description?: string };
type Client = ReturnType<typeof createClient<Database>>;

type ExistingProduct = { id: string; name: string; brand: string; specifications: Record<string, unknown> | null };

export async function ensureStore(client: Client, store: StoreConfig) {
  const { data, error } = await client.from("stores").upsert({ name: store.name, slug: store.slug, website_url: store.websiteUrl, logo_url: store.logoUrl || null, description: store.description || null }, { onConflict: "slug" }).select("id").single();
  if (error || !data) throw new Error(`store setup failed: ${error?.message || "missing store id"}`);
  return data.id;
}

export async function ensureCategory(client: Client, name: string, slug: string) {
  const { data, error } = await client.from("categories").upsert({ name, slug }, { onConflict: "slug" }).select("id").single();
  if (error || !data) throw new Error(`category setup failed: ${error?.message || "missing category id"}`);
  return data.id;
}

export async function importStoreProduct(client: Client, item: StoreProduct, storeId: string, categoryId: string, summary: CollectionSummary) {
  const { data: externalOffer } = item.externalId ? await client.from("offers").select("id, product_id, price").eq("store_id", storeId).eq("external_id", item.externalId).maybeSingle() : { data: null };
  const { data: existingRows, error: candidateError } = await client.from("products").select("id, name, brand, specifications").limit(1000);
  if (candidateError) throw new Error(`candidate lookup failed: ${candidateError.message}`);
  const match = externalOffer ? { candidate: { id: externalOffer.product_id } as ExistingProduct, confidence: 100, reasons: ["store external id"] } : findBestMatch(item, (existingRows || []) as ExistingProduct[]);
  const highConfidence = Boolean(match.candidate && match.confidence >= 75);
  const mediumConfidence = Boolean(match.candidate && match.confidence >= 55);
  if (mediumConfidence && !highConfidence) summary.uncertainMatches.push({ name: item.name, candidate: match.candidate!.name, confidence: match.confidence });
  let productId = highConfidence ? match.candidate!.id : undefined;
  if (!productId) {
    const { data, error } = await client.from("products").insert({ name: item.name, slug: `${productSlug(item)}-${item.externalId ? item.externalId.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) : Date.now()}`, brand: item.brand || "Unknown", category_id: categoryId, description: item.description || null, image_url: item.imageUrl || null, specifications: item.specifications || {}, featured: false }).select("id").single();
    if (error || !data) throw new Error(`product insert failed: ${error?.message || "missing product id"}`);
    productId = data.id;
    summary.createdProducts += 1;
  } else {
    const { error } = await client.from("products").update({ image_url: item.imageUrl || undefined, description: item.description || undefined, updated_at: new Date().toISOString() }).eq("id", productId);
    if (error) throw new Error(`product update failed: ${error.message}`);
    summary.matchedProducts += 1;
  }
  const oldPrice = externalOffer?.price === undefined ? null : Number(externalOffer.price);
  const offerPayload = { product_id: productId, store_id: storeId, external_id: item.externalId || null, price: item.price, previous_price: oldPrice !== null && oldPrice !== item.price ? oldPrice : null, currency: "NPR", availability: item.availability === "out_of_stock" ? "out_of_stock" as const : "in_stock" as const, product_url: item.productUrl, last_checked: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (externalOffer?.id) {
    const { error } = await client.from("offers").update(offerPayload).eq("id", externalOffer.id);
    if (error) throw new Error(`offer update failed: ${error.message}`);
    summary.updatedOffers += 1;
  } else {
    const { error } = await client.from("offers").upsert({ ...offerPayload, created_at: new Date().toISOString() }, { onConflict: "product_id,store_id" });
    if (error) throw new Error(`offer insert failed: ${error.message}`);
    summary.createdOffers += 1;
  }
  if (oldPrice === null || oldPrice !== item.price) {
    const { data: latest } = await client.from("price_history").select("price").eq("product_id", productId).eq("store_id", storeId).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
    if (!latest || Number(latest.price) !== item.price) {
      const { error } = await client.from("price_history").insert({ product_id: productId, store_id: storeId, price: item.price, recorded_at: new Date().toISOString() });
      if (error) throw new Error(`price history insert failed: ${error.message}`);
      summary.priceChanges += 1;
      // Phase-5 hook: a genuine price change just landed, so re-check whether any user's price
      // alert for this product is now met. Never allowed to fail the collection job (section 19
      // of the phase-5 spec) — a Redis/DB hiccup here just means the alert is picked up on the
      // next price change instead.
      try {
        await evaluateProductPriceAlerts(client, productId);
      } catch (alertError) {
        logError("alerts", `evaluation failed for product ${productId}: ${alertError instanceof Error ? alertError.message : alertError}`);
      }
    }
  }
}
