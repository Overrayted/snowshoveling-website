"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStaff, requireStaff } from "@/lib/auth";
import { addDays, localDate } from "@/lib/dates";
import { startStormDay } from "@/lib/storms";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { email, error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { email, error: "That email and password didn't match." };

  if (!(await getStaff())) {
    await supabase.auth.signOut();
    return { email, error: "This account isn't set up as staff yet. Ask the owner to add you." };
  }
  redirect("/staff");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}

export async function setVisitStatus(formData: FormData) {
  const { user, supabase } = await requireStaff();
  const visitId = String(formData.get("visitId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "booked" && status !== "done" && status !== "skipped") return;

  const done = status === "done";
  const { error } = await supabase
    .from("visits")
    .update({
      status,
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? user.id : null,
    })
    .eq("id", visitId);
  if (error) throw error;
  revalidatePath("/staff");
}

// For when the forecast misses a storm: same flow as the daily check.
export async function startManualStormDay(formData: FormData) {
  await requireStaff();
  const date = String(formData.get("date") ?? "");
  const today = localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, 14)) {
    redirect("/staff?error=date");
  }
  await startStormDay({ serviceDate: date, expectedSnowMm: null, source: "manual" });
  redirect(`/staff?date=${date}`);
}
