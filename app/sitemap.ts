import type { MetadataRoute } from "next";
import { supabase } from "@/lib/data";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const STATIC_ROUTES = ["", "/search", "/categories"];

/**
 * §H-seo (phase-9 audit): no sitemap existed at all — for a price-comparison site, the product
 * pages ARE the acquisition funnel, so crawlers had no machine-readable way to discover them.
 * Bounded at 5,000 products (well under the format's 50,000-URL-per-file limit; see
 * generateSitemaps in the Next.js docs for splitting across files if the catalog ever gets that
 * large — not needed at today's scale).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.6,
  }));

  if (!supabase) return staticEntries;

  const { data } = await supabase.from("products").select("slug, updated_at").eq("status", "active").order("updated_at", { ascending: false }).limit(5000);
  const productEntries: MetadataRoute.Sitemap = (data || []).map((product) => ({
    url: `${base}/product/${product.slug}`,
    lastModified: product.updated_at,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
