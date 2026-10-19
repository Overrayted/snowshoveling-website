import "server-only";
import type { DrivewaySize, PlanType } from "@/lib/pocketbase/types";
import { findOrCreateCustomer } from "./customers";
import { createProperty, findProperty } from "./properties";
import { changePlan } from "./subscriptions";

// The checkout form's single entry point: saves the customer, their property
// and their chosen plan. Call it from a Server Action after validating input.
// Safe to repeat: a double-submit reuses the same customer, property and plan.
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
}) {
  const customer = await findOrCreateCustomer(input);
  const property =
    (await findProperty(customer.id, input.streetAddress)) ??
    (await createProperty({ customerId: customer.id, ...input }));
  const subscription = await changePlan({
    customerId: customer.id,
    propertyId: property.id,
    newPlanType: input.planType,
    quoteAmount: input.quoteAmount,
  });
  return { customer, property, subscription };
}
