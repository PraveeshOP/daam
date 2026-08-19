import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import type { ProductWithOffers } from "@/types";
import { SafeImage } from "@/components/SafeImage";

const npr = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;
export function ProductCard({ product }: { product: ProductWithOffers }) {
  const drop = product.offers.some(
    (offer) => offer.previousPrice && offer.price < offer.previousPrice,
  );
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white transition hover:-translate-y-1 hover:border-[#a9cdbf] hover:shadow-[0_16px_35px_rgba(23,34,31,0.08)]">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[1.15] overflow-hidden bg-[#f2f5f2]"
      >
        <SafeImage
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 90vw, 280px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {drop && (
          <span className="absolute left-3 top-3 rounded-full bg-[#ef745f] px-2.5 py-1 text-[11px] font-bold text-white">
            Price drop
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#88948e]">
          {product.brand} · {product.category}
        </p>
        <Link
          href={`/product/${product.slug}`}
          className="line-clamp-2 min-h-[48px] text-[17px] font-bold leading-6 hover:text-[#0c8b67]"
        >
          {product.name}
        </Link>
        <div className="mt-auto pt-4">
          <p className="text-xl font-bold text-[#0c8b67]">
            {product.offers.length ? `From ${npr(product.lowestPrice)}` : "Price unavailable"}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-[#66736e]">
            <span className="flex items-center gap-1">
              <Store size={13} /> {product.stores} stores
            </span>
            <span>
              {product.savings ? `Save ${npr(product.savings)}` : "Best prices"}
            </span>
          </div>
        </div>
        <Link
          href={`/product/${product.slug}`}
          className="mt-4 flex items-center justify-center gap-2 rounded-[3px] bg-[#17221f] py-2.5 text-sm font-bold text-white transition hover:bg-[#0c8b67]"
        >
          Compare prices <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
}
