"use client";

import "./globals.css";

// §H-seo (phase-9 audit): app/error.tsx only catches errors thrown below the root layout — an
// error thrown from the root layout itself (e.g. getCurrentUser()) needs this convention
// instead, which is required to render its own <html>/<body> since it replaces the whole layout
// (and, per the Next.js docs, does NOT automatically get the root layout's styles — hence the
// explicit globals.css import here so the Tailwind classes below actually render styled).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="container flex min-h-[60vh] items-center justify-center py-16">
          <div className="max-w-md text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ef745f]">Something went wrong</p>
            <h1 className="mt-3 text-3xl font-bold">daam could not load</h1>
            <p className="mt-3 leading-7 text-[#66736e]">Please try again. Your products and saved data are safe.</p>
            <button type="button" onClick={() => reset()} className="mt-7 rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white hover:bg-[#0c8b67]">
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
