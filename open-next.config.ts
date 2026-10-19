import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages (home, staff login) are served from Workers static assets.
// Nothing uses ISR/revalidation, so no R2 or KV storage is needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
