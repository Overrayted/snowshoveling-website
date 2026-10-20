import "server-only";
import { createCheckout } from "@/lib/payments";
import type { DrivewaySize, PlanType } from "@/lib/pocketbase/types";
import { findOrCreateCustomer } from "./customers";
import { createProperty, findProperty } from "./properties";
import { createPendingSubscription, getActiveSubscription } from "./subscriptions";

export type SignupResult =
  | { status: "already_active" }
  | { status: "checkout"; checkoutUrl: string };

// The signup form's single entry point: saves the customer, their property
// and a pending plan, then returns the Stripe page to pay on. The plan turns
// active when Stripe confirms payment (lib/payments.ts).
// Safe to repeat: a double-submit reuses the same customer and property.
export async function signUpCustomer(input: {
  fullName: string;
  phoneNumber: string; // already normalized with normalizePhone()
  address: string;
  smsOptIn: boolean;
  streetAddress: string;
  drivewaySize: DrivewaySize | null;
  estimatedSquareFeet: number | null;
  planType: PlanType;
  quoteAmount: number;
}): Promise<SignupResult> {
  const customer = await findOrCreateCustomer(input);
  const property =
    (await findProperty(customer.id, input.streetAddress)) ??
    (await createProperty({ customerId: customer.id, ...input }));

  const active = await getActiveSubscription(customer.id, property.id);
  if (active?.plan_type === input.planType) return { status: "already_active" };

  const subscription = await createPendingSubscription({
    customerId: customer.id,
    propertyId: property.id,
    planType: input.planType,
    quoteAmount: input.quoteAmount,
  });
  const checkoutUrl = await createCheckout({ customer, subscription, property });
  return { status: "checkout", checkoutUrl };
}
