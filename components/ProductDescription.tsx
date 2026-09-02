"use client";

import { useState } from "react";

const TRUNCATE_AT = 280;

/** Some stores' scraped descriptions run to 2000+ characters of unbroken marketing copy (a full
 * feature list, an FAQ section, etc. all in one paragraph) — rendering that in full made every
 * product page feel dominated by one store's ad copy. Truncates to the first ~280 characters at a
 * word boundary, with a Read more/Show less toggle so the full text is still one click away. */
export function ProductDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = description.length > TRUNCATE_AT;
  const truncated = needsTruncation ? `${description.slice(0, TRUNCATE_AT).replace(/\s+\S*$/, "")}…` : description;

  return (
    <p className="mt-6 max-w-xl leading-7 text-[#66736e]">
      {expanded ? description : truncated}{" "}
      {needsTruncation && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="font-semibold text-[#0c8b67] underline underline-offset-2">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </p>
  );
}
