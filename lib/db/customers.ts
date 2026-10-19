import "server-only";
import { getAdminClient, isNotFound, isValidationError } from "@/lib/pocketbase/client";
import type { CustomerRecord } from "@/lib/pocketbase/types";

// Normalizes North American phone input ("(416) 555-1234", "416.555.1234",
// "1 416 555 1234") to E.164 (+14165551234). Returns null if it isn't valid.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function getCustomerByPhone(phone: string): Promise<CustomerRecord | null> {
  const pb = await getAdminClient();
  try {
    return await pb
      .collection("customers")
      .getFirstListItem(pb.filter("phone_number = {:phone}", { phone }));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
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
}): Promise<CustomerRecord> {
  const pb = await getAdminClient();
  const existing = await getCustomerByPhone(input.phoneNumber);
  if (existing) {
    if (!input.smsOptIn || existing.sms_opt_in) return existing;
    return pb.collection("customers").update(existing.id, {
      sms_opt_in: true,
      sms_opt_in_at: new Date().toISOString(),
    });
  }

  try {
    return await pb.collection("customers").create({
      full_name: input.fullName.trim(),
      phone_number: input.phoneNumber,
      address: input.address.trim(),
      sms_opt_in: input.smsOptIn,
      sms_opt_in_at: input.smsOptIn ? new Date().toISOString() : "",
    });
  } catch (error) {
    // Lost a race with a concurrent signup for the same phone number
    if (isValidationError(error)) {
      const winner = await getCustomerByPhone(input.phoneNumber);
      if (winner) return winner;
    }
    throw error;
  }
}
