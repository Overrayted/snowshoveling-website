import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pocketbase/client";
import type { StaffRecord } from "@/lib/pocketbase/types";

export const STAFF_COOKIE = "kaiyns_staff";
// Matches PocketBase's default auth token lifetime (7 days)
export const STAFF_SESSION_SECONDS = 60 * 60 * 24 * 7;

// Returns the signed-in staff member and a PocketBase client acting as them
// (collection rules apply), or null if nobody valid is signed in.
export async function getStaff() {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;

  const pb = createClient();
  pb.authStore.save(token, null);
  if (!pb.authStore.isValid) return null;
  try {
    // Confirms the token with PocketBase and that it belongs to a staff account
    const { record } = await pb.collection("staff").authRefresh();
    return { staff: record as StaffRecord, pb };
  } catch {
    return null;
  }
}

export async function requireStaff() {
  const result = await getStaff();
  if (!result) redirect("/staff/login");
  return result;
}
