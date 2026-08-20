import Link from "next/link";

// §H-seo (phase-9 audit): previously absent, so any unmatched route (a typo'd URL, a deleted
// category) fell through to Next's unstyled default 404 instead of matching the rest of the
// site's design (same color tokens as app/error.tsx).
export default function NotFound() {
  return (
    <main className="container flex min-h-[60vh] items-center justify-center py-16">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ef745f]">404</p>
        <h1 className="mt-3 text-3xl font-bold">We could not find that page</h1>
        <p className="mt-3 leading-7 text-[#66736e]">
          The link may be out of date, or the page may have moved.
        </p>
        <Link
          href="/search"
          className="mt-7 inline-block rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]"
        >
          Browse products
        </Link>
      </div>
    </main>
  );
}
