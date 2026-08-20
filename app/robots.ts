import type { MetadataRoute } from "next";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// §H-seo (phase-9 audit): none existed before — search crawlers had no guidance keeping them out
// of account/admin pages or the outbound `/go/[offerId]` redirect (which should never itself be
// indexed as a destination).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/account", "/favorites", "/alerts", "/go/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
