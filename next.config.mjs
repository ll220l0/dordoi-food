import withPWA from "next-pwa";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" }
    ]
  }
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development" && process.env.PWA_DEV !== "true",
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.pathname.startsWith("/api/restaurants/") && url.pathname.endsWith("/menu"),
      handler: "StaleWhileRevalidate",
      options: { cacheName: "menu-api", expiration: { maxEntries: 80, maxAgeSeconds: 3600 } }
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: { cacheName: "images", expiration: { maxEntries: 300, maxAgeSeconds: 604800 } }
    }
  ]
})(nextConfig);
