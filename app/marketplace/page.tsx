import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { MarketplaceListingCard } from "@/components/MarketplaceListingCard";
import { getMarketplaceCategories, getMarketplaceListings } from "@/lib/marketplace";

export const metadata = {
  title: "Marketplace listings | Daam",
  description: "Brand-new electronics listed by sellers on Nepali marketplaces, alongside our retail price comparison.",
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const [listings, categories] = await Promise.all([
    getMarketplaceListings({ category, query: q }),
    getMarketplaceCategories(),
  ]);

  return (
    <main className="container py-12 sm:py-16">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0c8b67]">Marketplace</p>
      <h1 className="text-4xl font-bold sm:text-5xl">Listed by sellers</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-[#66736e]">
        Brand-new items advertised by individual sellers on Nepali marketplaces.
      </p>

      {/*
        This disclosure is the reason the page exists in this shape rather than as another row in
        the offers table. These are not retailer offers: there is no shop behind them, the price
        is often negotiable, and several sellers may list the same model at different prices. They
        are excluded from every price comparison, price history and price alert on the site.
      */}
      <div className="mt-6 flex max-w-2xl gap-3 rounded-[4px] border border-[#e3e9e5] bg-[#f5f7f6] p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-[#66736e]" />
        <p className="text-sm leading-6 text-[#66736e]">
          These are seller adverts, not shop listings, so they are <strong>not part of our price
          comparison</strong> and do not appear in price history or price alerts. Prices are set by
          the seller and are often negotiable. Deal directly with the seller and take the usual
          care you would on any classifieds site.
        </p>
      </div>

      {categories.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          <FilterChip href="/marketplace" label="All" active={!category} />
          {categories.map((item) => (
            <FilterChip
              key={item.name}
              href={`/marketplace?category=${encodeURIComponent(item.name)}`}
              label={`${item.name} (${item.count})`}
              active={category === item.name}
            />
          ))}
        </div>
      )}

      {listings.length === 0 ? (
        <div className="mt-10 rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-10 text-center">
          <h2 className="text-xl font-bold">No listings right now</h2>
          <p className="mt-2 text-sm text-[#66736e]">
            {category || q
              ? "Nothing matches that filter. Try another category."
              : "Marketplace listings are collected on a schedule and expire quickly. Check back soon."}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-[#66736e]">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
            {category ? ` in ${category}` : ""}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <MarketplaceListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}

      <Link href="/search" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-[#0c8b67]">
        <ArrowLeft size={16} /> Back to comparisons
      </Link>
    </main>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-[3px] border px-3 py-1.5 text-xs font-bold transition ${
        active ? "border-[#0c8b67] bg-[#0c8b67] text-white" : "border-[#e3e9e5] bg-white text-[#66736e] hover:border-[#cbd8d1]"
      }`}
    >
      {label}
    </Link>
  );
}
