import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PlanType,
  Subscription,
  SubscriptionStatus,
} from "@/lib/supabase/database.types";

export async function getActiveSubscription(
  customerId: string,
  propertyId: string,
): Promise<Subscription | null> {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select()
    .eq("customer_id", customerId)
    .eq("property_id", propertyId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSubscription(input: {
  customerId: string;
  propertyId: string;
  planType: PlanType;
  quoteAmount: number;
  startDate?: string;
}): Promise<Subscription> {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .insert({
      customer_id: input.customerId,
      property_id: input.propertyId,
      plan_type: input.planType,
      quote_amount: input.quoteAmount,
      start_date: input.startDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<Subscription> {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .update({ status })
    .eq("id", subscriptionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Upgrade or downgrade: expire the current active plan and start a new one,
// keeping the old row as history. The partial unique index on active plans
// rejects a concurrent double-change instead of creating two active plans.
export async function changePlan(input: {
  customerId: string;
  propertyId: string;
  newPlanType: PlanType;
  quoteAmount: number;
}): Promise<Subscription> {
  const current = await getActiveSubscription(input.customerId, input.propertyId);
  if (current?.plan_type === input.newPlanType) return current;
  if (current) await setSubscriptionStatus(current.id, "expired");

  return createSubscription({
    customerId: input.customerId,
    propertyId: input.propertyId,
    planType: input.newPlanType,
    quoteAmount: input.quoteAmount,
  });
}
