import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Cache Components is off: Cloudflare's adapter (OpenNext) has open bugs with
// it on Next 16.3+. Pages that read the URL or cookies render per request.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Lets `next dev` emulate the Cloudflare runtime
initOpenNextCloudflareForDev();
