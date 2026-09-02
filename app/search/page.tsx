import { after } from "next/server";
import { searchProducts, getCategoryCounts, getStores, getStoreCounts } from "@/lib/data";
import { FilterSidebar, SearchResults, type SearchViewFilters } from "@/components/SearchResults";
import { Pagination } from "@/components/admin/Pagination";
import { getCurrentUser } from "@/lib/supabase/server";
import { getFavoriteProductIds } from "@/lib/favorites";
import { trackEvent } from "@/lib/analytics/track";
import { getTrackingIdentity } from "@/lib/analytics/identity";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const numberParam = (value: string | undefined) => value && /^\d+$/.test(value) ? Number(value) : undefined;
const PAGE_SIZE = 12;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q) || "";
  const category = first(params.category) || "";
  const store = first(params.store) || "";
  const minPrice = first(params.min) || "";
  const maxPrice = first(params.max) || "";
  const inStock = first(params.stock) === "true";
  const sort = first(params.sort);
  const selectedSort: SearchViewFilters["sort"] = sort === "lowest" || sort === "highest" || sort === "discount" || sort === "recent" ? sort : "relevance";
  const filters: SearchViewFilters = { category, store, minPrice, maxPrice, inStock, sort: selectedSort };
  const page = Math.max(1, Number(first(params.page)) || 1);
  const [allProducts, categoryCounts, liveStores, storeCounts, user] = await Promise.all([
    searchProducts(query, { category: category || undefined, store: store || undefined, minPrice: numberParam(minPrice), maxPrice: numberParam(maxPrice), inStock, sort: selectedSort }),
    getCategoryCounts(query),
    getStores(),
    getStoreCounts(query),
    getCurrentUser(),
  ]);
  const favoriteIds = user ? await getFavoriteProductIds(user.id) : new Set<string>();

  // §pagination (live request): searchProducts already returns the whole matching set (capped
  // at 200 — see its own comment for why real cursor-based pagination is a bigger, deliberate
  // follow-up, not a same-patch fix); at today's catalog size that cap is never actually hit, so
  // slicing the already-fetched, already-filtered-and-sorted array here is correct, not a
  // shortcut that risks the wrong page's items — it's simply displaying 20 of the already-known
  // full result at a time.
  const products = allProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // §7: only a real search (a typed query) is meaningful here — "browse all" page views aren't
  // a "search" in the sense the zero-result-search metric cares about. Identity is read now
  // (a Request-time API) and passed into `after()` by closure — `after()` runs once the response
  // has already been sent, so it can't call cookies()/read the session itself (§25: never make
  // the page wait for analytics).
  if (query) {
    const { userId, anonymousId } = await getTrackingIdentity();
    const resultCount = allProducts.length;
    after(() => trackEvent({ eventName: "search", userId, anonymousId, properties: { query, result_count: resultCount } }));
  }

  // Every active filter/sort choice carries over across page links, so "Next" doesn't drop them.
  const paginationParams: Record<string, string | undefined> = { q: query || undefined, category: category || undefined, store: store || undefined, min: minPrice || undefined, max: maxPrice || undefined, stock: inStock ? "true" : undefined, sort: selectedSort === "relevance" ? undefined : selectedSort };

  return <main className="container py-10 sm:py-14"><div className="mb-10"><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0c8b67]">Search results</p><h1 className="text-4xl font-bold sm:text-5xl">{query ? <>Results for <span className="text-[#0c8b67]">“{query}”</span></> : "All products"}</h1><p className="mt-3 text-[#66736e]">Compare products from trusted stores across Nepal.</p></div><div className="grid gap-8 lg:grid-cols-[220px_1fr]"><FilterSidebar filters={filters} categoryCounts={categoryCounts} stores={liveStores} storeCounts={storeCounts} /><section><SearchResults products={products} total={allProducts.length} filters={filters} categoryCounts={categoryCounts} stores={liveStores} storeCounts={storeCounts} favoritedProductIds={[...favoriteIds]} isAuthenticated={Boolean(user)} /><Pagination page={page} pageSize={PAGE_SIZE} total={allProducts.length} basePath="/search" searchParams={paginationParams} /></section></div></main>;
}
