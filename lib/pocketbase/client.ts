import "server-only";
import PocketBase, { ClientResponseError } from "pocketbase";
import { requireEnv } from "@/lib/env";
import type { TypedPocketBase } from "./types";

// A fresh, unauthenticated client. Only ever used on the server: browsers
// never talk to PocketBase directly.
export function createClient(): TypedPocketBase {
  const pb = new PocketBase(requireEnv("POCKETBASE_URL")) as TypedPocketBase;
  // The SDK cancels duplicate in-flight requests by default, which breaks
  // concurrent server-side calls.
  pb.autoCancellation(false);

  // Optional: if PocketBase sits behind Cloudflare Access, authenticate with
  // a service token so only this website can reach it.
  const accessId = process.env.CF_ACCESS_CLIENT_ID;
  const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (accessId && accessSecret) {
    pb.beforeSend = (url, options) => {
      options.headers = {
        ...options.headers,
        "CF-Access-Client-Id": accessId,
        "CF-Access-Client-Secret": accessSecret,
      };
      return { url, options };
    };
  }
  return pb;
}

let adminClient: TypedPocketBase | undefined;

// Superuser client that bypasses collection rules. Every caller must
// validate input itself.
export async function getAdminClient(): Promise<TypedPocketBase> {
  adminClient ??= createClient();
  if (!adminClient.authStore.isValid) {
    await adminClient
      .collection("_superusers")
      .authWithPassword(
        requireEnv("POCKETBASE_SUPERUSER_EMAIL"),
        requireEnv("POCKETBASE_SUPERUSER_PASSWORD"),
      );
  }
  return adminClient;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 404;
}

// A create/update rejected by a unique index (or other validation) comes
// back as a 400.
export function isValidationError(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 400;
}
