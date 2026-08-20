"use client";

import { trackEventAction } from "@/app/actions/analytics";

/**
 * A plain external link with one addition: fires `store_click` on click without ever blocking
 * or delaying the navigation — `void` means we don't await the Server Action, and `target`
 * already opens a new tab, so there's nothing for the click handler to hold up (§25/§27).
 */
export function StoreClickLink({
  href,
  productId,
  storeId,
  offerId,
  className,
  children,
}: {
  href: string;
  productId: string;
  storeId: string;
  offerId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => {
        void trackEventAction("store_click", { product_id: productId, store_id: storeId, offer_id: offerId });
      }}
    >
      {children}
    </a>
  );
}
