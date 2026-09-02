export const COLLECTOR_USER_AGENT = "PriceNepalCatalogCollector/0.1 (+manual low-volume catalog import)";

const DEFAULT_TIMEOUT_MS = Number(process.env.COLLECTOR_REQUEST_TIMEOUT_MS || 15_000);

export const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Every store request goes through this so a stalled store can never hang a job forever. */
export async function fetchText(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": COLLECTOR_USER_AGENT, Accept: "text/html,application/xml", ...init.headers },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * WooCommerce's Store API caps every single request at `perPage` items (100 is the platform's
 * hard ceiling) — a category holding more than that silently truncates unless the caller pages
 * through it. This walks `&page=1,2,3...` until a short/empty page signals the end, or `maxItems`
 * (a hard backstop against a runaway loop, not a real expected ceiling) is hit.
 *
 * `perPage` defaults to 100, but is a parameter rather than hardcoded because at least one store
 * in this codebase (MeroEpasal) gets measurably slower per item added to one of its category
 * pages — verified live, not a guess — so that collector deliberately passes both a smaller page
 * size and a longer `timeoutMs` here instead of forcing every store through the same defaults.
 */
export async function fetchAllWooCommerceItems<T>(baseUrl: string, options: { perPage?: number; maxItems?: number; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<T[]> {
  const perPage = options.perPage ?? 100;
  const maxItems = options.maxItems ?? 5000;
  const items: T[] = [];
  let page = 1;
  while (items.length < maxItems) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${separator}per_page=${perPage}&page=${page}`;
    // A page fetch here is one of several in a longer chain, so a single slow/flaky response
    // (verified live on at least one store's server) shouldn't sink the whole collection —
    // retry a couple of times with backoff before giving up.
    let raw: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        raw = await fetchText(url, { headers: { Accept: "application/json", ...options.headers } }, options.timeoutMs);
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await delay(2000 * (attempt + 1));
      }
    }
    const pageItems = JSON.parse(raw!) as T[];
    items.push(...pageItems);
    if (pageItems.length < perPage) break; // short page: this was the last one
    page += 1;
    await delay(750);
  }
  return items.slice(0, maxItems);
}
