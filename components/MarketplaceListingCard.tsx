import { ExternalLink } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { CONDITION_LABELS, marketplaceSourceName, type MarketplaceListingView } from "@/lib/marketplace";

const npr = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;

export function MarketplaceListingCard({ listing }: { listing: MarketplaceListingView }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white transition hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-[#f5f7f6]">
        {listing.imageUrl ? (
          <SafeImage src={listing.imageUrl} alt={listing.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#88948e]">No image</div>
        )}
        <span className="absolute left-2 top-2 rounded-[3px] bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0c8b67]">
          {CONDITION_LABELS[listing.condition] ?? listing.condition}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {listing.sourceCategory && (
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#88948e]">{listing.sourceCategory}</p>
        )}
        <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-5">{listing.title}</h2>
        <div className="mt-auto pt-3">
          <p className="text-xl font-bold text-[#0c8b67]">{npr(listing.price)}</p>
          {/* Verified live: sellers set this flag themselves, and roughly half of one sampled feed
              had it on. Shown because it materially changes what the number above means. */}
          {listing.negotiable && <p className="text-[11px] text-[#66736e]">Negotiable</p>}
          <a
            href={listing.listingUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0c8b67]"
          >
            View on {marketplaceSourceName(listing.source)} <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </article>
  );
}
