"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ProductWithOffers } from "@/types";
import { ProductCard } from "@/components/ProductCard";
import { categories, stores } from "@/lib/data";

export function SearchResults({
  products,
  query,
}: {
  products: ProductWithOffers[];
  query: string;
}) {
  const [sort, setSort] = useState("relevance");
  const [category, setCategory] = useState("");
  const [store, setStore] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const filtered = useMemo(
    () =>
      products
        .filter(
          (product) =>
            (!category || product.categorySlug === category) &&
            (!store || product.offers.some((offer) => offer.storeId === store)),
        )
        .sort((a, b) =>
          sort === "lowest"
            ? a.lowestPrice - b.lowestPrice
            : sort === "highest"
              ? b.lowestPrice - a.lowestPrice
              : sort === "discount"
                ? b.savings - a.savings
                : 0,
        ),
    [category, products, sort, store],
  );
  const controls = (
    <div className="space-y-7">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">
          Category
        </p>
        <div className="space-y-2">
          {categories.slice(0, 6).map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 text-sm"
            >
              <input
                type="radio"
                name="category"
                checked={category === item.slug}
                onChange={() =>
                  setCategory(category === item.slug ? "" : item.slug)
                }
                className="h-4 w-4 accent-[#0c8b67]"
              />
              {item.name}
              <span className="ml-auto text-xs text-[#a0aaa5]">
                {products.filter((p) => p.categorySlug === item.slug).length}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">
          Store
        </p>
        <div className="space-y-2">
          {stores.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={store === item.id}
                onChange={() => setStore(store === item.id ? "" : item.id)}
                className="h-4 w-4 accent-[#0c8b67]"
              />
              {item.name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#88948e]">
          Availability
        </p>
        <label className="flex items-center gap-3 text-sm">
          <Check size={16} className="text-[#0c8b67]" /> In stock only
        </label>
      </div>
    </div>
  );
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => setMobileFilters(!mobileFilters)}
          className="flex items-center gap-2 rounded-[3px] border border-[#d6dfda] bg-white px-3 py-2 text-sm font-bold lg:hidden"
        >
          <SlidersHorizontal size={16} /> Filters
        </button>
        <p className="hidden text-sm text-[#66736e] lg:block">
          {filtered.length} products found
        </p>
        <label className="flex items-center gap-2 text-sm text-[#66736e]">
          Sort by{" "}
          <span className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none rounded-[3px] border border-[#d6dfda] bg-white py-2 pl-3 pr-8 font-semibold text-[#17221f] outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="lowest">Lowest price</option>
              <option value="highest">Highest price</option>
              <option value="discount">Biggest discount</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </span>
        </label>
      </div>
      {mobileFilters && (
        <div className="mb-5 rounded-[4px] border border-[#d6dfda] bg-white p-5 lg:hidden">
          {controls}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.length ? (
          filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="col-span-full rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-12 text-center">
            <h2 className="text-xl font-bold">No products found</h2>
            <p className="mt-2 text-sm text-[#66736e]">
              Try a broader search or clear your filters.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
export function FilterSidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="hidden rounded-[4px] border border-[#e3e9e5] bg-white p-5 lg:block">
      {children}
    </aside>
  );
}
