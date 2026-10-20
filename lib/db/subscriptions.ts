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

// New plans start as "pending" and become active once Stripe confirms
// payment (see lib/payments.ts).
export async function createPendingSubscription(input: {
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
    status: "pending",
    quote_amount: input.quoteAmount,
    start_date: localDate(),
  });
}

export async function updateSubscription(
  id: string,
  fields: Partial<Pick<SubscriptionRecord, "status" | "stripe_checkout_session" | "stripe_subscription_id">>,
): Promise<SubscriptionRecord> {
  const pb = await getAdminClient();
  return pb.collection("subscriptions").update(id, fields);
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<SubscriptionRecord> {
  return updateSubscription(subscriptionId, { status });
}

// Full Season plans have no Stripe subscription to end them, so the daily
// storm check expires them once the season is over.
export async function expireFullSeasonPlans(seasonEnd: string): Promise<number> {
  if (localDate() <= seasonEnd) return 0;
  const pb = await getAdminClient();
  const ended = await pb.collection("subscriptions").getFullList({
    filter: pb.filter('plan_type = "full_season" && status = "active" && start_date <= {:end}', {
      end: seasonEnd,
    }),
  });
  for (const sub of ended) await setSubscriptionStatus(sub.id, "expired");
  return ended.length;
}
