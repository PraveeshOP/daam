import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { parseProductPage, parseProductUrls } from "@/collectors/evo/parser";
import type { CollectionSummary, StoreProduct } from "@/collectors/evo/types";
import type { Database } from "@/types/database";

loadEnvConfig(process.cwd());

const STORE = { name: "Evo Store", slug: "evo-store", websiteUrl: "https://evostore.com.np", logoUrl: "https://evostore.com.np/catalog/view/theme/evostore/assets/img/logo/evo-logo-black.svg", description: "Apple Authorized Reseller and Nepal electronics retailer." };
const SITEMAP_URL = "https://evostore.com.np/sitemap.xml";
const USER_AGENT = "PriceNepalCatalogCollector/0.1 (+manual low-volume catalog import)";
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 100);
const summary: CollectionSummary = { discovered: 0, imported: 0, updated: 0, skipped: 0, priceChanges: 0, matchedProducts: 0, createdProducts: 0, createdOffers: 0, updatedOffers: 0, uncertainMatches: [], errors: [] };

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" }, redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function printSummary() {
  console.log(`\nPriceNepal Evo Store Collector\n\nProducts discovered: ${summary.discovered}\nProducts imported: ${summary.imported}\nProducts updated: ${summary.updated}\nProducts skipped: ${summary.skipped}\nPrices changed: ${summary.priceChanges}\nErrors: ${summary.errors.length}`);
  for (const error of summary.errors) console.log(`- ${error.url}: ${error.message}`);
  console.log(summary.errors.length ? "\nCompleted with errors." : "\nCompleted successfully.");
}

async function ensureStore(client: ReturnType<typeof createClient<Database>>) {
  const { data, error } = await client.from("stores").upsert({ name: STORE.name, slug: STORE.slug, website_url: STORE.websiteUrl, logo_url: STORE.logoUrl, description: STORE.description }, { onConflict: "slug" }).select("id").single();
  if (error || !data) throw new Error(`store setup failed: ${error?.message || "missing store id"}`);
  return data.id;
}

async function ensureCategory(client: ReturnType<typeof createClient<Database>>) {
  const { data, error } = await client.from("categories").upsert({ name: "Smartphones", slug: "smartphones" }, { onConflict: "slug" }).select("id").single();
  if (error || !data) throw new Error(`category setup failed: ${error?.message || "missing category id"}`);
  return data.id;
}

async function persistProduct(client: ReturnType<typeof createClient<Database>>, item: StoreProduct, storeId: string, categoryId: string) {
  const productSlug = slugify(item.name);
  const { data: matchingOffer } = item.externalId ? await client.from("offers").select("id, product_id, price").eq("store_id", storeId).eq("external_id", item.externalId).maybeSingle() : { data: null };
  const { data: matchingProduct } = matchingOffer ? { data: null } : await client.from("products").select("id").eq("slug", productSlug).maybeSingle();
  let productId = matchingOffer?.product_id || matchingProduct?.id;
  if (!productId) {
    const { data, error } = await client.from("products").insert({ name: item.name, slug: productSlug, brand: item.brand || "Unknown", category_id: categoryId, description: item.description || null, image_url: item.imageUrl || null, specifications: item.specifications || {}, featured: false }).select("id").single();
    if (error || !data) throw new Error(`product insert failed: ${error?.message || "missing product id"}`);
    productId = data.id;
    summary.imported += 1;
  } else {
    const { error } = await client.from("products").update({ name: item.name, brand: item.brand || "Unknown", category_id: categoryId, description: item.description || null, image_url: item.imageUrl || null, specifications: item.specifications || {}, updated_at: new Date().toISOString() }).eq("id", productId);
    if (error) throw new Error(`product update failed: ${error.message}`);
    summary.updated += 1;
  }
  const oldPrice = matchingOffer?.price === undefined ? null : Number(matchingOffer.price);
  const availability = item.availability === "out_of_stock" ? "out_of_stock" : "in_stock";
  const offerPayload = { product_id: productId, store_id: storeId, external_id: item.externalId || null, price: item.price, previous_price: oldPrice !== null && oldPrice !== item.price ? oldPrice : null, currency: "NPR", availability, product_url: item.productUrl, last_checked: new Date().toISOString(), updated_at: new Date().toISOString() };
  let offerId = matchingOffer?.id;
  if (offerId) {
    const { error } = await client.from("offers").update(offerPayload).eq("id", offerId);
    if (error) throw new Error(`offer update failed: ${error.message}`);
  } else {
    const { data, error } = await client.from("offers").upsert({ ...offerPayload, created_at: new Date().toISOString() }, { onConflict: "product_id,store_id" }).select("id").single();
    if (error || !data) throw new Error(`offer insert failed: ${error?.message || "missing offer id"}`);
    offerId = data.id;
  }
  if (oldPrice === null || oldPrice !== item.price) {
    const { data: latest } = await client.from("price_history").select("price").eq("product_id", productId).eq("store_id", storeId).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
    if (!latest || Number(latest.price) !== item.price) {
      const { error } = await client.from("price_history").insert({ product_id: productId, store_id: storeId, price: item.price, recorded_at: new Date().toISOString() });
      if (error) throw new Error(`price history insert failed: ${error.message}`);
      summary.priceChanges += 1;
    }
  }
  return offerId;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const limit = Math.min(Math.max(Number(limitArgument?.split("=")[1] || 20), 1), 50);
  const sitemap = await fetchText(SITEMAP_URL);
  const urls = parseProductUrls(sitemap, limit);
  summary.discovered = urls.length;
  if (!urls.length) throw new Error("no smartphone URLs found in Evo sitemap");
  const items: { url: string; product: StoreProduct }[] = [];
  for (const url of urls) {
    try {
      const products = parseProductPage(await fetchText(url), url);
      if (!products.length) summary.skipped += 1;
      for (const product of products) items.push({ url, product });
      console.log(`✓ ${url} (${products.length} offer${products.length === 1 ? "" : "s"})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      if (message.startsWith("missing product JSON-LD")) {
        summary.skipped += 1;
        console.log(`- ${url}: skipped non-product page`);
      } else {
        summary.errors.push({ url, message });
        console.log(`✗ ${url}: ${message}`);
      }
    }
    await delay(750);
  }
  if (dryRun) { console.log(`\nDry run parsed ${items.length} normalized offer${items.length === 1 ? "" : "s"}; no database writes performed.`); printSummary(); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for writes; use --dry-run to parse without writing.");
  const client = createClient<Database>(url, serviceKey);
  const storeId = await ensureStore(client);
  const categoryId = await ensureCategory(client);
  for (const item of items) {
    try { await persistProduct(client, item.product, storeId, categoryId); } catch (error) { summary.errors.push({ url: item.url, message: error instanceof Error ? error.message : "database error" }); }
  }
  printSummary();
}

main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
