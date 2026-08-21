"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ProductWithOffers, Store } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/lib/seed-data";

export type SearchViewFilters = {
  category: string;
  store: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  sort: "relevance" | "lowest" | "highest" | "discount" | "recent";
};

type FilterProps = {
  filters: SearchViewFilters;
  /** Per-category counts across the *whole* catalog (ignoring the category filter itself, so
   * switching categories doesn't zero out every other one) — see lib/data.ts's
   * getCategoryCounts for why this can't be derived from the current page's products. */
  categoryCounts: Record<string, number>;
  /** Real stores from the `stores` table (lib/data.ts's getStores) — not the static seed list,
   * which drifts out of date as real stores are added/removed. */
  stores: Store[];
};

type FilterControlProps = FilterProps & {
  onChange: (key: keyof SearchViewFilters, value: string | boolean) => void;
};

function FilterControls({ filters, onChange, categoryCounts, stores }: FilterControlProps) {
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">Category</p>
        <div className="space-y-2">
          {categories.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <button type="button" aria-pressed={filters.category === item.slug} onClick={() => onChange("category", filters.category === item.slug ? "" : item.slug)} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#7e8582]" aria-label={item.name}><span className={`h-2.5 w-2.5 rounded-full ${filters.category === item.slug ? "bg-[#0c8b67]" : "bg-transparent"}`} /></button>
              {item.name}
              <span className="ml-auto text-xs text-[#a0aaa5]">{categoryCounts[item.slug] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">Store</p>
        <div className="space-y-2">
          {stores.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <button type="button" aria-pressed={filters.store === item.slug} onClick={() => onChange("store", filters.store === item.slug ? "" : item.slug)} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#7e8582]" aria-label={item.name}><span className={`h-2.5 w-2.5 rounded-full ${filters.store === item.slug ? "bg-[#0c8b67]" : "bg-transparent"}`} /></button>
              {item.name}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">Price (NPR)</p>
        <div className="flex gap-2">
          <input aria-label="Minimum price" inputMode="numeric" value={filters.minPrice} onChange={(event) => onChange("minPrice", event.target.value.replace(/\D/g, ""))} placeholder="Min" className="min-w-0 w-full rounded border border-[#d6dfda] px-2 py-2 text-xs outline-none focus:border-[#0c8b67]" />
          <input aria-label="Maximum price" inputMode="numeric" value={filters.maxPrice} onChange={(event) => onChange("maxPrice", event.target.value.replace(/\D/g, ""))} placeholder="Max" className="min-w-0 w-full rounded border border-[#d6dfda] px-2 py-2 text-xs outline-none focus:border-[#0c8b67]" />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={filters.inStock} onChange={(event) => onChange("inStock", event.target.checked)} className="h-4 w-4 accent-[#0c8b67]" />
        <Check size={16} className="text-[#0c8b67]" /> In stock only
      </label>
    </div>
  );
}

function updateUrl(key: keyof SearchViewFilters, value: string | boolean) {
  const params = new URLSearchParams(window.location.search);
  const parameter = key === "inStock" ? "stock" : key === "minPrice" ? "min" : key === "maxPrice" ? "max" : key;
  if (!value || value === "relevance") params.delete(parameter);
  else params.set(parameter, String(value));
  return `/search?${params.toString()}`;
}

export function FilterSidebar({ filters, categoryCounts, stores }: FilterProps) {
  const router = useRouter();
  return <aside className="hidden rounded-[4px] border border-[#e3e9e5] bg-white p-5 lg:block"><FilterControls filters={filters} onChange={(key, value) => router.push(updateUrl(key, value))} categoryCounts={categoryCounts} stores={stores} /></aside>;
}

export function SearchResults({
  products,
  total,
  filters,
  categoryCounts,
  stores,
  favoritedProductIds = [],
  isAuthenticated = false,
}: {
  /** Just the current page's products — rendered as the grid. */
  products: ProductWithOffers[];
  /** The true total match count across every page — shown in the "N products found" text,
   * which must not read "20 products found" just because that's the page size. */
  total: number;
  filters: SearchViewFilters;
  categoryCounts: Record<string, number>;
  stores: Store[];
  favoritedProductIds?: string[];
  isAuthenticated?: boolean;
}) {
  const router = useRouter();
  const favoritedSet = new Set(favoritedProductIds);
  const hasActiveFilters = Boolean(filters.category || filters.store || filters.minPrice || filters.maxPrice || filters.inStock);
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={() => document.getElementById("mobile-filters")?.classList.toggle("hidden")} className="flex items-center gap-2 rounded-[3px] border border-[#d6dfda] bg-white px-3 py-2 text-sm font-bold lg:hidden"><SlidersHorizontal size={16} /> Filters{hasActiveFilters ? " · Active" : ""}</button>
      <p className="hidden text-sm text-[#66736e] lg:block">{total} products found</p>
      <label className="ml-auto flex items-center gap-2 text-sm text-[#66736e]">Sort by <span className="relative"><select aria-label="Sort products" value={filters.sort} onChange={(event) => router.push(updateUrl("sort", event.target.value))} className="appearance-none rounded-[3px] border border-[#d6dfda] bg-white py-2 pl-3 pr-8 font-semibold text-[#17221f] outline-none focus:border-[#0c8b67]"><option value="relevance">Relevance</option><option value="lowest">Lowest price</option><option value="highest">Highest price</option><option value="discount">Biggest discount</option><option value="recent">Recently added</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" /></span></label>
    </div>
    <div id="mobile-filters" className="mb-5 hidden rounded-[4px] border border-[#d6dfda] bg-white p-5 lg:hidden"><FilterControls filters={filters} onChange={(key, value) => router.push(updateUrl(key, value))} categoryCounts={categoryCounts} stores={stores} /></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.length ? products.map((product) => <ProductCard key={product.id} product={product} isFavorited={favoritedSet.has(product.id)} isAuthenticated={isAuthenticated} />) : <div className="col-span-full rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-12 text-center"><h2 className="text-xl font-bold">No products found</h2><p className="mt-2 text-sm text-[#66736e]">Try another search or adjust your filters.</p></div>}</div>
  </>;
}
