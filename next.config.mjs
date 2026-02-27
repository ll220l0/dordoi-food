import withPWA from "@ducanh2912/next-pwa";

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" }
    ]
  }
};

export default withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development" && process.env.PWA_DEV !== "true",
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.destination === "image",
        handler: "CacheFirst",
        options: { cacheName: "images", expiration: { maxEntries: 300, maxAgeSeconds: 604800 } }
      }
    ]
  }
})(nextConfig);

