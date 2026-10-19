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

// NEXT_PUBLIC_ vars must be referenced literally so Next.js can inline them
// into the browser bundle; a dynamic process.env[name] lookup would be empty.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
