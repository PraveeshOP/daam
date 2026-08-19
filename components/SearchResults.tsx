"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ProductWithOffers } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { categories, stores } from "@/lib/data";

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
  products: ProductWithOffers[];
};

type FilterControlProps = FilterProps & {
  onChange: (key: keyof SearchViewFilters, value: string | boolean) => void;
};

function FilterControls({ filters, onChange, products }: FilterControlProps) {
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">Category</p>
        <div className="space-y-2">
          {categories.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <button type="button" aria-pressed={filters.category === item.slug} onClick={() => onChange("category", filters.category === item.slug ? "" : item.slug)} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#7e8582]" aria-label={item.name}><span className={`h-2.5 w-2.5 rounded-full ${filters.category === item.slug ? "bg-[#0c8b67]" : "bg-transparent"}`} /></button>
              {item.name}
              <span className="ml-auto text-xs text-[#a0aaa5]">{products.filter((product) => product.categorySlug === item.slug).length}</span>
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

export function FilterSidebar({ filters, products }: FilterProps) {
  const router = useRouter();
  return <aside className="hidden rounded-[4px] border border-[#e3e9e5] bg-white p-5 lg:block"><FilterControls filters={filters} onChange={(key, value) => router.push(updateUrl(key, value))} products={products} /></aside>;
}

export function SearchResults({ products, filters }: { products: ProductWithOffers[]; filters: SearchViewFilters }) {
  const router = useRouter();
  const hasActiveFilters = Boolean(filters.category || filters.store || filters.minPrice || filters.maxPrice || filters.inStock);
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={() => document.getElementById("mobile-filters")?.classList.toggle("hidden")} className="flex items-center gap-2 rounded-[3px] border border-[#d6dfda] bg-white px-3 py-2 text-sm font-bold lg:hidden"><SlidersHorizontal size={16} /> Filters{hasActiveFilters ? " · Active" : ""}</button>
      <p className="hidden text-sm text-[#66736e] lg:block">{products.length} products found</p>
      <label className="ml-auto flex items-center gap-2 text-sm text-[#66736e]">Sort by <span className="relative"><select aria-label="Sort products" value={filters.sort} onChange={(event) => router.push(updateUrl("sort", event.target.value))} className="appearance-none rounded-[3px] border border-[#d6dfda] bg-white py-2 pl-3 pr-8 font-semibold text-[#17221f] outline-none focus:border-[#0c8b67]"><option value="relevance">Relevance</option><option value="lowest">Lowest price</option><option value="highest">Highest price</option><option value="discount">Biggest discount</option><option value="recent">Recently added</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" /></span></label>
    </div>
    <div id="mobile-filters" className="mb-5 hidden rounded-[4px] border border-[#d6dfda] bg-white p-5 lg:hidden"><FilterControls filters={filters} onChange={(key, value) => router.push(updateUrl(key, value))} products={products} /></div>
    <div className="grid gap-4 sm:grid-cols-2">{products.length ? products.map((product) => <ProductCard key={product.id} product={product} />) : <div className="col-span-full rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-12 text-center"><h2 className="text-xl font-bold">No products found</h2><p className="mt-2 text-sm text-[#66736e]">Try another search or adjust your filters.</p></div>}</div>
  </>;
}
