import type { StoreProduct } from "@/collectors/evo/types";

export type IttiPayload = {
  pid: number;
  sku: string;
  name: string;
  short_name?: string;
  description?: string;
  summary?: string;
  specification?: string;
  price?: { sku?: string; stock?: number; in_stock?: boolean; selling_price?: number; mark_price?: number };
  image?: { image?: string };
};

const stripHtml = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const specificationValue = (html: string, label: string) => {
  const match = html.match(new RegExp(`<td[^>]*>${label}<\\/td>\\s*<td[^>]*>([^<]+)`, "i"));
  return match?.[1]?.trim();
};
const firstImage = (url?: string) => url?.replace(/\\/g, "");

export function parseIttiProduct(payload: { is_product?: boolean; data?: IttiPayload }, productUrl: string): StoreProduct[] {
  const item = payload.is_product ? payload.data : undefined;
  if (!item?.name) throw new Error("missing ITTI product payload or name");
  const storage = item.sku.match(/\b(\d+(?:GB|TB))\b/i)?.[1] || specificationValue(item.specification || "", "Internal Storage");
  const ram = specificationValue(item.specification || "", "RAM");
  const model = specificationValue(item.specification || "", "Model") || item.short_name || item.name;
  const brand = specificationValue(item.specification || "", "Brand") || item.name.split(" ")[0];
  const imageUrl = firstImage(item.image?.image);
  const price = Number(item.price?.selling_price ?? item.price?.mark_price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("missing or invalid ITTI price");
  return [{ externalId: item.sku || String(item.pid), name: `${item.name}${storage && !item.name.toLowerCase().includes(storage.toLowerCase()) ? ` ${storage}` : ""}`, brand, model, storage, ram, price, currency: "NPR", imageUrl, productUrl, availability: item.price?.in_stock ? "in_stock" : "out_of_stock", description: stripHtml(item.description || item.summary), specifications: { Model: model, ...(storage ? { Storage: storage } : {}), ...(ram ? { RAM: ram } : {}) } }];
}

export function parseIttiProductUrls(sitemap: string, limit = 20) {
  const urls = [...sitemap.matchAll(/<loc>\s*(https:\/\/itti\.com\.np\/product\/[^<\s]+)\s*<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => /iphone|samsung-galaxy|oneplus|xiaomi|redmi|pixel|honor/i.test(url))
    .filter((url) => !/case|cover|charger|adapter|cable|watch|buds|earphone|accessor|tab/i.test(url));
  return urls.sort((first, second) => {
    const priority = (url: string) => /apple-iphone-(15|16|17)/i.test(url) ? 3 : /samsung-galaxy-(a|s)/i.test(url) ? 2 : /oneplus|xiaomi|redmi|pixel|honor/i.test(url) ? 1 : 0;
    return priority(second) - priority(first);
  }).slice(0, limit);
}
