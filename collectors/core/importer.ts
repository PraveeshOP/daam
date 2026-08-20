import { createClient } from "@supabase/supabase-js";
import { findBestMatch, productSlug } from "@/collectors/core/matcher";
import { isSuspiciousPriceChange } from "@/collectors/core/priceIntegrity";
import type { StoreProduct, CollectionSummary } from "@/collectors/evo/types";
import type { Database } from "@/types/database";
import { evaluateProductPriceAlerts } from "@/lib/alerts/evaluate";
import { recordMatchCandidate } from "@/lib/admin/matches";
import { logError } from "@/lib/logger";

type StoreConfig = { name: string; slug: string; websiteUrl: string; logoUrl?: string; description?: string };
type Client = ReturnType<typeof createClient<Database>>;

export type ExistingProduct = { id: string; name: string; brand: string; specifications: Record<string, unknown> | null };

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

/**
 * `existingProducts` is fetched once per collection run (collectors/core/run.ts), not once per
 * item — §H2 of the phase-9 audit. It's mutated in place (pushed to, below) whenever this run
 * creates a new product, so two near-duplicate listings discovered in the *same* run still match
 * against each other, exactly as they would have when this query ran fresh per item.
 */
export async function importStoreProduct(client: Client, item: StoreProduct, storeId: string, categoryId: string, summary: CollectionSummary, existingProducts: ExistingProduct[]) {
  const { data: externalOffer } = item.externalId ? await client.from("offers").select("id, product_id").eq("store_id", storeId).eq("external_id", item.externalId).maybeSingle() : { data: null };
  const match = externalOffer ? { candidate: { id: externalOffer.product_id } as ExistingProduct, confidence: 100, reasons: ["store external id"] } : findBestMatch(item, existingProducts);
  const highConfidence = Boolean(match.candidate && match.confidence >= 75);
  const mediumConfidence = Boolean(match.candidate && match.confidence >= 55);
  const isUncertain = mediumConfidence && !highConfidence;
  if (isUncertain) summary.uncertainMatches.push({ name: item.name, candidate: match.candidate!.name, confidence: match.confidence });
  let productId = highConfidence ? match.candidate!.id : undefined;
  if (!productId) {
    const { data, error } = await client.from("products").insert({ name: item.name, slug: `${productSlug(item)}-${item.externalId ? item.externalId.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) : Date.now()}`, brand: item.brand || "Unknown", category_id: categoryId, description: item.description || null, image_url: item.imageUrl || null, specifications: item.specifications || {}, featured: false }).select("id").single();
    if (error || !data) throw new Error(`product insert failed: ${error?.message || "missing product id"}`);
    productId = data.id;
    summary.createdProducts += 1;
    existingProducts.push({ id: productId, name: item.name, brand: item.brand || "Unknown", specifications: item.specifications || {} });
    // Phase-6 hook: persist the "this might actually be the same product" signal (previously
    // only logged for the duration of one collection run) so an admin can review it in
    // /admin/matches instead of a duplicate product silently existing forever.
    if (isUncertain && match.candidate) {
      await recordMatchCandidate(client, { newProductId: productId, candidateProductId: match.candidate.id, storeId, confidence: match.confidence, reasons: match.reasons });
    }
  } else {
    const { error } = await client.from("products").update({ image_url: item.imageUrl || undefined, description: item.description || undefined, updated_at: new Date().toISOString() }).eq("id", productId);
    if (error) throw new Error(`product update failed: ${error.message}`);
    summary.matchedProducts += 1;
  }

  // §C2 (phase-9 audit): `price_history` is the source of truth for "did the price actually
  // change", not `offers.price` — and it's written *before* the offers row is touched. If the
  // process dies between the two writes, the history point is never lost (it's already
  // committed), and the next run self-heals the stale offers row: it'll recompute the same
  // "did it change" answer from price_history, skip re-inserting a duplicate point, and still
  // unconditionally rewrite offers.price to the current value below. The old order (offers
  // first, history second) made a mid-write crash permanently lose that history point, because
  // the next run's "old price" came from the just-updated offers row instead.
  const { data: latestHistory } = await client.from("price_history").select("price").eq("product_id", productId).eq("store_id", storeId).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  const recordedPrice = latestHistory ? Number(latestHistory.price) : null;
  const priceChanged = recordedPrice === null || recordedPrice !== item.price;

  if (priceChanged) {
    if (isSuspiciousPriceChange(recordedPrice, item.price)) {
      summary.priceAnomalies.push({ name: item.name, oldPrice: recordedPrice ?? 0, newPrice: item.price });
    }
    const { error } = await client.from("price_history").insert({ product_id: productId, store_id: storeId, price: item.price, recorded_at: new Date().toISOString() });
    if (error) throw new Error(`price history insert failed: ${error.message}`);
    summary.priceChanges += 1;
  }

  const offerPayload = { product_id: productId, store_id: storeId, external_id: item.externalId || null, price: item.price, previous_price: priceChanged && recordedPrice !== null ? recordedPrice : null, currency: "NPR", availability: item.availability === "out_of_stock" ? "out_of_stock" as const : "in_stock" as const, product_url: item.productUrl, last_checked: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (externalOffer?.id) {
    const { error } = await client.from("offers").update(offerPayload).eq("id", externalOffer.id);
    if (error) throw new Error(`offer update failed: ${error.message}`);
    summary.updatedOffers += 1;
  } else {
    const { error } = await client.from("offers").upsert({ ...offerPayload, created_at: new Date().toISOString() }, { onConflict: "product_id,store_id" });
    if (error) throw new Error(`offer insert failed: ${error.message}`);
    summary.createdOffers += 1;
  }

  if (priceChanged) {
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
