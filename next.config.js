const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/uploads/menu/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/uploads/welcome/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  /**
   * Klasický `next dev` (webpack): vypnutá filesystem cache ve vývoji snižuje riziko
   * „Cannot find module './NNN.js'“ po pár kliknutích (rozjetá .next cache).
   * Turbopack (`npm run dev`) tento hook většinou nepoužívá – tam je stabilnější jiný bundler.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  widenClientFileUpload: true,
});
