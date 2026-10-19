import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Returns the signed-in staff member and an RLS-scoped Supabase client, or
// null if nobody is signed in or the account isn't in the staff table.
export async function getStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select()
    .eq("user_id", user.id)
    .maybeSingle();
  return staff ? { user, staff, supabase } : null;
}

export async function requireStaff() {
  const result = await getStaff();
  if (!result) redirect("/staff/login");
  return result;
}
