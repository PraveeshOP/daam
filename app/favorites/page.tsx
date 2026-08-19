import Link from "next/link";
import { Heart } from "lucide-react";
export default function FavoritesPage() {
  return (
    <main className="container flex min-h-[60vh] items-center justify-center py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#d9f5ec] text-[#0c8b67]">
          <Heart size={28} />
        </div>
        <h1 className="mt-6 text-3xl font-bold">Your shortlist starts here</h1>
        <p className="mt-3 leading-7 text-[#66736e]">
          Save products you are watching and we will keep their best offers easy
          to find. Accounts are coming soon.
        </p>
        <Link
          href="/search"
          className="mt-7 inline-flex rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]"
        >
          Browse products
        </Link>
      </div>
    </main>
  );
}
