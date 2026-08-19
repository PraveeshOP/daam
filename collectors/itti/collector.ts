import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { parseIttiProduct, parseIttiProductUrls, type IttiPayload } from "@/collectors/itti/parser";
import { ensureCategory, ensureStore, importStoreProduct } from "@/collectors/core/importer";
import type { CollectionSummary } from "@/collectors/evo/types";
import type { Database } from "@/types/database";

loadEnvConfig(process.cwd());
const STORE = { name: "ITTI", slug: "itti", websiteUrl: "https://itti.com.np", logoUrl: "https://itti.com.np/logo.webp", description: "ITTI Computer World electronics retailer in Nepal." };
const SITEMAP_URL = "https://itti.com.np/sitemap.xml";
const USER_AGENT = "PriceNepalCatalogCollector/0.1 (+manual low-volume catalog import)";
const summary: CollectionSummary = { discovered: 0, imported: 0, updated: 0, skipped: 0, priceChanges: 0, matchedProducts: 0, createdProducts: 0, createdOffers: 0, updatedOffers: 0, uncertainMatches: [], errors: [] };
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchText(url: string) { const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/xml,application/json" }, redirect: "follow" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); }
async function fetchProduct(url: string) { const productPath = new URL(url).pathname.replace(/^\/product\//, "/"); const endpoint = `https://itti.com.np/api-proxy/product-detail${productPath}?compare_session_id=${crypto.randomUUID()}`; return JSON.parse(await fetchText(endpoint)) as { is_product?: boolean; data?: IttiPayload }; }
function printSummary() { console.log(`\nPriceNepal ITTI Collector\n\nProducts discovered: ${summary.discovered}\nNormalized offers: ${summary.createdOffers + summary.updatedOffers}\nMatched existing products: ${summary.matchedProducts}\nNew canonical products: ${summary.createdProducts}\nPotential uncertain matches: ${summary.uncertainMatches.length}\nPrices changed: ${summary.priceChanges}\nErrors: ${summary.errors.length}`); for (const match of summary.uncertainMatches) console.log(`? ${match.name} -> ${match.candidate} (${match.confidence}%)`); for (const error of summary.errors) console.log(`- ${error.url}: ${error.message}`); console.log(summary.errors.length ? "\nCompleted with errors." : "\nCompleted successfully."); }

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const limit = Math.min(Math.max(Number(limitArgument?.split("=")[1] || 10), 1), 50);
  const urls = parseIttiProductUrls(await fetchText(SITEMAP_URL), limit);
  summary.discovered = urls.length;
  if (!urls.length) throw new Error("no smartphone product URLs found in ITTI sitemap");
  const items = [];
  for (const url of urls) {
    try { const product = parseIttiProduct(await fetchProduct(url), url)[0]; items.push(product); console.log(`✓ ${url}`); } catch (error) { summary.errors.push({ url, message: error instanceof Error ? error.message : "unknown error" }); console.log(`✗ ${url}: ${summary.errors.at(-1)?.message}`); }
    await delay(750);
  }
  if (dryRun) { console.log(`\nDry run parsed ${items.length} normalized ITTI offer${items.length === 1 ? "" : "s"}; no database writes performed.`); printSummary(); return; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for writes; use --dry-run to parse without writing.");
  const client = createClient<Database>(url, serviceKey); const storeId = await ensureStore(client, STORE); const categoryId = await ensureCategory(client, "Smartphones", "smartphones");
  for (const product of items) { try { await importStoreProduct(client, product, storeId, categoryId, summary); } catch (error) { summary.errors.push({ url: product.productUrl, message: error instanceof Error ? error.message : "database error" }); } }
  printSummary();
}
main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
