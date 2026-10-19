import "server-only";
import { localDate } from "@/lib/dates";
import { getAdminClient, isNotFound } from "@/lib/pocketbase/client";
import type { PlanType, SubscriptionRecord, SubscriptionStatus } from "@/lib/pocketbase/types";

export async function getActiveSubscription(
  customerId: string,
  propertyId: string,
): Promise<SubscriptionRecord | null> {
  const pb = await getAdminClient();
  try {
    return await pb.collection("subscriptions").getFirstListItem(
      pb.filter('customer = {:customerId} && property = {:propertyId} && status = "active"', {
        customerId,
        propertyId,
      }),
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function createSubscription(input: {
  customerId: string;
  propertyId: string;
  planType: PlanType;
  quoteAmount: number;
}): Promise<SubscriptionRecord> {
  const pb = await getAdminClient();
  return pb.collection("subscriptions").create({
    customer: input.customerId,
    property: input.propertyId,
    plan_type: input.planType,
    status: "active",
    quote_amount: input.quoteAmount,
    start_date: localDate(),
  });
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<SubscriptionRecord> {
  const pb = await getAdminClient();
  return pb.collection("subscriptions").update(subscriptionId, { status });
}

// Upgrade or downgrade: expire the current active plan and start a new one,
// keeping the old row as history. The unique index on active plans rejects a
// concurrent double-change instead of creating two active plans.
export async function changePlan(input: {
  customerId: string;
  propertyId: string;
  newPlanType: PlanType;
  quoteAmount: number;
}): Promise<SubscriptionRecord> {
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
