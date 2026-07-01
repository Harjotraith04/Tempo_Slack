/**
 * The web companion shares the Slack app's domain by importing `../src` directly
 * (no duplication, no publish step):
 *  - `experimental.externalDir` lets files import from outside `web/`.
 *  - `extensionAlias` resolves the shared code's NodeNext `.js` import specifiers
 *    to their `.ts` sources.
 * Anything touching the domain runs on the Node.js runtime (fs / pg / Slack SDK).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { externalDir: true },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
