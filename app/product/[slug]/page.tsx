import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ArrowLeft, Check, Heart, Star } from "lucide-react";
import { getProduct, stores } from "@/lib/data";
import { OfferTable } from "@/components/OfferTable";
import { PriceHistory } from "@/components/PriceHistory";
import { SafeImage } from "@/components/SafeImage";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PriceAlertForm } from "@/components/PriceAlertForm";
import { getCurrentUser } from "@/lib/supabase/server";
import { getFavoriteProductIds } from "@/lib/favorites";
import { getUserAlertForProduct } from "@/lib/alerts/queries";
import { alertStatus } from "@/lib/alerts/status";
import { trackEvent } from "@/lib/analytics/track";
import { getTrackingIdentity } from "@/lib/analytics/identity";

const npr = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return {
    title: product
      ? `${product.name} – Price comparison in Nepal | daam`
      : "Product — daam",
    description: product?.description,
    alternates: product
      ? { canonical: `/product/${product.slug}` }
      : undefined,
    openGraph: {
      title: product?.name,
      description: product?.description,
      images: product ? [product.image] : [],
    },
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const product = await getProduct((await params).slug);
  if (!product)
    return (
      <main className="container py-24 text-center">
        <h1 className="text-3xl font-bold">Product not found</h1>
        <Link href="/search" className="mt-5 inline-flex text-[#0c8b67]">
          Browse all products
        </Link>
      </main>
    );
  const best = product.lowestPrice;
  const user = await getCurrentUser();
  const [favoriteIds, existingAlertRow] = await Promise.all([
    user ? getFavoriteProductIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getUserAlertForProduct(user.id, product.id) : Promise.resolve(null),
  ]);
  const existingAlert = existingAlertRow
    ? {
        id: existingAlertRow.id,
        targetPrice: existingAlertRow.targetPrice,
        triggeredAt: existingAlertRow.triggeredAt,
        status: alertStatus({ is_active: existingAlertRow.isActive, triggered_at: existingAlertRow.triggeredAt }),
      }
    : null;

  const { userId, anonymousId } = await getTrackingIdentity();
  after(() =>
    trackEvent({
      eventName: "product_view",
      userId,
      anonymousId,
      productId: product.id,
      properties: { product_id: product.id, category_slug: product.categorySlug },
    }),
  );
  return (
    <main className="container py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-2 text-sm text-[#66736e]">
        <Link href="/" className="hover:text-[#0c8b67]">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/search?category=${product.categorySlug}`}
          className="hover:text-[#0c8b67]"
        >
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-[#17221f]">{product.name}</span>
      </div>
      <section className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_1.1fr] lg:items-start">
        <div className="relative aspect-square overflow-hidden rounded-[4px] bg-[#f0f5f1]">
          <SafeImage
            src={product.image}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 1024px) 90vw, 520px"
            className="object-cover"
          />
        </div>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-[#d9f5ec] px-3 py-1.5 text-xs font-bold text-[#0c8b67]">
              {product.category}
            </span>
            <FavoriteButton
              productId={product.id}
              initialFavorited={favoriteIds.has(product.id)}
              isAuthenticated={Boolean(user)}
              variant="labeled"
            />
          </div>
          <p className="text-sm font-semibold text-[#88948e]">
            {product.brand}
          </p>
          <h1 className="mt-1 text-4xl font-bold leading-tight sm:text-5xl">
            {product.name}
          </h1>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 font-bold">
              <Star size={15} fill="#ef745f" className="text-[#ef745f]" />{" "}
              {product.rating}
            </span>
            <span className="text-[#66736e]">
              {product.reviewCount} reviews
            </span>
          </div>
          <p className="mt-6 max-w-xl leading-7 text-[#66736e]">
            {product.description}
          </p>
          <div className="mt-7 rounded-[4px] border border-[#a9d5c5] bg-[#f0fbf7] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0c8b67]">
              Best price today
            </p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-bold text-[#0c8b67]">{product.offers.length ? npr(best) : "Price unavailable"}</p>
              <p className="text-sm font-semibold text-[#66736e]">
                {product.stores} stores compared
              </p>
            </div>
            {product.offers.length > 0 && product.savings > 0 && (
              <p className="mt-2 text-sm font-semibold text-[#0c8b67]">
                Save up to {npr(product.savings)} by comparing
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <OfferTable offers={product.offers} stores={product.offerStores || stores} />
        <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">
            At a glance
          </p>
          <h2 className="mt-1 text-2xl font-bold">Key specifications</h2>
          <dl className="mt-5 divide-y divide-[#edf1ee]">
            {product.specs.map((spec) => (
              <div
                key={spec.label}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <dt className="text-[#66736e]">{spec.label}</dt>
                <dd className="text-right font-semibold">{spec.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 flex items-center gap-2 text-xs text-[#66736e]">
            <Check size={14} className="text-[#0c8b67]" /> Offers checked daily
          </p>
        </div>
      </section>
      <section id="price-alert" className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <PriceHistory points={product.history} />
        <PriceAlertForm
          productId={product.id}
          currentLowestPrice={best}
          isAuthenticated={Boolean(user)}
          existingAlert={existingAlert}
        />
      </section>
      <Link
        href="/search"
        className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-[#0c8b67]"
      >
        <ArrowLeft size={16} /> Back to comparisons
      </Link>
    </main>
  );
}
