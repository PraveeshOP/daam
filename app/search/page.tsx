import { searchProducts } from "@/lib/data";
import { FilterSidebar, SearchResults, type SearchViewFilters } from "@/components/SearchResults";
import { getCurrentUser } from "@/lib/supabase/server";
import { getFavoriteProductIds } from "@/lib/favorites";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const numberParam = (value: string | undefined) => value && /^\d+$/.test(value) ? Number(value) : undefined;

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
  const [products, user] = await Promise.all([
    searchProducts(query, { category: category || undefined, store: store || undefined, minPrice: numberParam(minPrice), maxPrice: numberParam(maxPrice), inStock, sort: selectedSort }),
    getCurrentUser(),
  ]);
  const favoriteIds = user ? await getFavoriteProductIds(user.id) : new Set<string>();
  return <main className="container py-10 sm:py-14"><div className="mb-10"><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0c8b67]">Search results</p><h1 className="text-4xl font-bold sm:text-5xl">{query ? <>Results for <span className="text-[#0c8b67]">“{query}”</span></> : "All products"}</h1><p className="mt-3 text-[#66736e]">Compare products from trusted stores across Nepal.</p></div><div className="grid gap-8 lg:grid-cols-[220px_1fr]"><FilterSidebar filters={filters} products={products} /><section><SearchResults products={products} filters={filters} favoritedProductIds={[...favoriteIds]} isAuthenticated={Boolean(user)} /></section></div></main>;
}
