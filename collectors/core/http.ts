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
