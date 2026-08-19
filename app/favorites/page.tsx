import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { getFavoriteProducts } from "@/lib/favorites";
import { SafeImage } from "@/components/SafeImage";
import { FavoriteButton } from "@/components/FavoriteButton";

export const metadata: Metadata = { title: "Your favorites — daam" };

const npr = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;

export default async function FavoritesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d9f5ec] text-[#0c8b67]">
            <Heart size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-bold">Your shortlist starts here</h1>
          <p className="mt-3 leading-7 text-[#66736e]">
            Log in to save products and keep their best offers easy to find.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
              Create account
            </Link>
            <Link href="/login" className="inline-flex rounded-[3px] border border-[#d6dfda] px-5 py-3 text-sm font-bold hover:border-[#0c8b67] hover:text-[#0c8b67]">
              Log in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const favorites = await getFavoriteProducts(user.id);

  return (
    <main className="container py-10 sm:py-14">
      <h1 className="text-4xl font-bold sm:text-5xl">My Favorites</h1>
      <p className="mt-3 text-[#66736e]">Products you are watching, with their current best price.</p>

      {favorites.length === 0 ? (
        <div className="mt-10 rounded-[4px] border border-dashed border-[#cbd8d1] bg-white p-12 text-center">
          <h2 className="text-xl font-bold">Your favorites are empty.</h2>
          <p className="mt-2 text-sm text-[#66736e]">Save products to keep track of their prices.</p>
          <Link href="/search" className="mt-6 inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="flex flex-col gap-4 rounded-[4px] border border-[#e3e9e5] bg-white p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5"
            >
              <Link href={`/product/${favorite.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[4px] bg-[#f2f5f2] sm:h-24 sm:w-24">
                <SafeImage src={favorite.image} alt={favorite.name} fill sizes="96px" className="object-cover" />
              </Link>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#88948e]">{favorite.brand}</p>
                <Link href={`/product/${favorite.slug}`} className="font-bold hover:text-[#0c8b67]">
                  {favorite.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-bold text-[#0c8b67]">{favorite.lowestPrice ? `From ${npr(favorite.lowestPrice)}` : "Price unavailable"}</span>
                  <span className="flex items-center gap-1 text-[#66736e]">
                    <Store size={13} /> {favorite.storeCount} {favorite.storeCount === 1 ? "store" : "stores"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:shrink-0">
                <Link
                  href={`/product/${favorite.slug}`}
                  className="rounded-[3px] bg-[#17221f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c8b67]"
                >
                  View product
                </Link>
                <FavoriteButton productId={favorite.id} initialFavorited isAuthenticated variant="icon" />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
