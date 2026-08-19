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
      { protocol: "https", hostname: "cdn.hukut.com" },
      { protocol: "https", hostname: "admin.itti.com.np" },
    ],
  },
};

export default nextConfig;
