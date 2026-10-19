// Read a required env var lazily, so a missing key fails loudly at the call
// site that needs it instead of breaking unrelated pages at build time.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

// The public address of the site, e.g. https://kaiyns.ca (no trailing slash).
// Read at request time, so it can be set in Cloudflare's runtime settings.
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
