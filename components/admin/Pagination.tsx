import Link from "next/link";

/** Plain-link pagination (no client JS) — every admin list page paginates server-side via
 * `.range()` in its query, never loading a whole table into the browser (phase-6 spec §25). */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) if (value) params.set(key, value);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-5 flex items-center justify-between gap-4 text-sm text-[#66736e]">
      <p>
        Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
      </p>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page <= 1}
          href={hrefFor(Math.max(1, page - 1))}
          className={`rounded-[3px] border border-[#d6dfda] px-3 py-1.5 font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-[#0c8b67] hover:text-[#0c8b67]"}`}
        >
          Previous
        </Link>
        <span className="font-semibold text-[#17221f]">
          Page {page} of {totalPages}
        </span>
        <Link
          aria-disabled={page >= totalPages}
          href={hrefFor(Math.min(totalPages, page + 1))}
          className={`rounded-[3px] border border-[#d6dfda] px-3 py-1.5 font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-[#0c8b67] hover:text-[#0c8b67]"}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
