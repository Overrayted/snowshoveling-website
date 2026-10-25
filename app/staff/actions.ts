"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, STAFF_SESSION_SECONDS, requireStaff } from "@/lib/auth";
import { addDays, localDate } from "@/lib/dates";
import { chargeVisit } from "@/lib/payments";
import { createClient, isValidationError } from "@/lib/pocketbase/client";
import { sendVisitDoneText, startStormDay } from "@/lib/storms";

export type LoginState = { error?: string; email: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { email, error: "Enter your email and password." };

  const pb = createClient();
  try {
    await pb.collection("staff").authWithPassword(email, password);
  } catch (error) {
    if (isValidationError(error)) return { email, error: "That email and password didn't match." };
    console.error("Staff sign-in failed", error);
    return { email, error: "Can't reach the server right now. Try again in a few minutes." };
  }

  (await cookies()).set(STAFF_COOKIE, pb.authStore.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_SECONDS,
  });
  redirect("/staff");
}

export async function signOut() {
  (await cookies()).delete(STAFF_COOKIE);
  redirect("/staff/login");
}

export async function setVisitStatus(formData: FormData) {
  const { staff, pb } = await requireStaff();
  const visitId = String(formData.get("visitId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "booked" && status !== "done" && status !== "skipped") return;

  const done = status === "done";
  await pb.collection("visits").update(visitId, {
    status,
    completed_at: done ? new Date().toISOString() : "",
    completed_by: done ? staff.id : "",
  });
  if (done) {
    // One Time visits are charged to the saved card once the job is done,
    // then every customer gets a "driveway cleared" text
    await chargeVisit(visitId);
    await sendVisitDoneText(visitId).catch((error) => console.error("Done text failed", error));
  }
  revalidatePath("/staff");
}

// After a declined card: the customer fixed it (or staff called them)
export async function retryVisitCharge(formData: FormData) {
  await requireStaff();
  await chargeVisit(String(formData.get("visitId") ?? ""));
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
