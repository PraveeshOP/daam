import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
