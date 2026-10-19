import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Customer } from "@/lib/supabase/database.types";

// Normalizes North American phone input ("(416) 555-1234", "416.555.1234",
// "1 416 555 1234") to E.164 (+14165551234). Returns null if it isn't valid.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  const { data, error } = await createAdminClient()
    .from("customers")
    .select()
    .eq("phone_number", phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Phone number is the customer's identity (no passwords). A returning
// customer reuses their existing record, which is never overwritten here:
// the signup form is public, so anyone could type someone else's number.
// Name/address changes should go through staff instead. Text consent can
// only be switched on here; replying STOP switches it off.
export async function findOrCreateCustomer(input: {
  fullName: string;
  phoneNumber: string;
  address: string;
  smsOptIn: boolean;
}): Promise<Customer> {
  const existing = await getCustomerByPhone(input.phoneNumber);
  if (existing) {
    if (!input.smsOptIn || existing.sms_opt_in) return existing;
    const { data, error } = await createAdminClient()
      .from("customers")
      .update({ sms_opt_in: true, sms_opt_in_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await createAdminClient()
    .from("customers")
    .insert({
      full_name: input.fullName.trim(),
      phone_number: input.phoneNumber,
      address: input.address.trim(),
      sms_opt_in: input.smsOptIn,
      sms_opt_in_at: input.smsOptIn ? new Date().toISOString() : null,
    })
    .select()
    .single();

  // Lost a race with a concurrent signup for the same phone number
  if (error?.code === "23505") {
    const winner = await getCustomerByPhone(input.phoneNumber);
    if (winner) return winner;
  }
  if (error) throw error;
  return data;
}
