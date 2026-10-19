import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "./database.types";

let adminClient: ReturnType<typeof createClient<Database>> | undefined;

// Secret-key client that bypasses Row Level Security. Server-only: the
// `server-only` import makes the build fail if a Client Component imports it.
// Every caller must validate input itself.
export function createAdminClient() {
  adminClient ??= createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return adminClient;
}
