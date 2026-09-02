import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions (app/actions/alerts.ts) enqueue notification jobs via lib/queue/notifications.ts,
  // which pulls in bullmq/ioredis. Both are Node-only and bullmq's optional native/valkey client
  // paths otherwise trip webpack ("Critical dependency" / unresolved module warnings) when bundled
  // for Server Components — this makes Next require() them natively instead.
  serverExternalPackages: ["bullmq", "ioredis"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "evostore.com.np" },
      { protocol: "https", hostname: "admin.itti.com.np" },
      { protocol: "https", hostname: "admin.mobilemandu.com" },
      { protocol: "https", hostname: "www.neostore.com.np" },
      { protocol: "https", hostname: "cdn.hukut.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "media.itechstore.com.np" },
      { protocol: "https", hostname: "neptronics.com" },
      { protocol: "https", hostname: "api.zolpastore.com" },
      { protocol: "https", hostname: "smartdoko.com" },
      { protocol: "https", hostname: "lds.com.np" },
      { protocol: "https", hostname: "yantranepal.com" },
      { protocol: "https", hostname: "gadgethousenepal.com" },
      { protocol: "https", hostname: "dealayo.com" },
      { protocol: "https", hostname: "electromandu.com" },
      { protocol: "https", hostname: "techinn.com.np" },
      { protocol: "https", hostname: "infotechsnepal.com.np" },
      { protocol: "https", hostname: "cplanetnp.com" },
      { protocol: "https", hostname: "mystore.com.np" },
      { protocol: "https", hostname: "drive.brodox.com" },
      { protocol: "https", hostname: "onlineit.com.np" },
      { protocol: "https", hostname: "maxnepal.com.np" },
      { protocol: "https", hostname: "tronixspace.com" },
      { protocol: "https", hostname: "meroepasal.com" },
      { protocol: "https", hostname: "bigbyte.com.np" },
      { protocol: "https", hostname: "sewasmart.com" },
      { protocol: "https", hostname: "rapidotechnepal.com" },
      { protocol: "https", hostname: "exortstore.com" },
    ],
  },
};

export default nextConfig;
