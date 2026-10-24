import "server-only";
import type Stripe from "stripe";
import { formatPrice, getPlan } from "@/lib/business";
import { formatServiceDate, localDate, seasonEndDate } from "@/lib/dates";
import { getActiveSubscription, setSubscriptionStatus, updateSubscription } from "@/lib/db/subscriptions";
import { siteUrl } from "@/lib/env";
import { getAdminClient, isNotFound } from "@/lib/pocketbase/client";
import type {
  CustomerRecord,
  PropertyRecord,
  StormRecord,
  SubscriptionRecord,
  VisitRecord,
  WithExpand,
} from "@/lib/pocketbase/types";
import { getStripe, toCents } from "@/lib/stripe";

// How each plan is paid:
//   One Time:   card saved at signup (Checkout "setup" mode), charged $50
//                when a visit is marked done (chargeVisit below)
//   Monthly:     Stripe subscription, renews monthly until the season ends
//   Full Season: one payment at signup

export async function ensureStripeCustomer(customer: CustomerRecord): Promise<string> {
  if (customer.stripe_customer_id) return customer.stripe_customer_id;
  const stripeCustomer = await getStripe().customers.create({
    name: customer.full_name,
    phone: customer.phone_number,
    address: { line1: customer.address, country: "CA" },
    metadata: { pocketbase_customer_id: customer.id },
  });
  const pb = await getAdminClient();
  await pb.collection("customers").update(customer.id, { stripe_customer_id: stripeCustomer.id });
  return stripeCustomer.id;
}

// Creates the Stripe-hosted payment page for a pending plan and returns its URL.
export async function createCheckout(input: {
  customer: CustomerRecord;
  subscription: SubscriptionRecord;
  property: PropertyRecord;
}): Promise<string> {
  const { customer, subscription, property } = input;
  const plan = getPlan(subscription.plan_type);
  const stripeCustomer = await ensureStripeCustomer(customer);
  const metadata = { pocketbase_subscription_id: subscription.id };
  const backToSignup = new URLSearchParams({
    address: property.street_address,
    plan: plan.type,
    cancelled: "1",
  });

  const common: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomer,
    client_reference_id: subscription.id,
    metadata,
    locale: "en",
    success_url: `${siteUrl()}/thank-you?plan=${plan.type}`,
    cancel_url: `${siteUrl()}/signup?${backToSignup}`,
  };
  const lineItem = (recurring?: { interval: "month" }) => ({
    quantity: 1,
    price_data: {
      currency: "cad",
      unit_amount: toCents(subscription.quote_amount),
      product_data: { name: `Kaiyns ${plan.name}: ${property.street_address}` },
      ...(recurring && { recurring }),
    },
  });

  let params: Stripe.Checkout.SessionCreateParams;
  if (plan.type === "one_time") {
    params = {
      ...common,
      mode: "setup",
      currency: "cad",
      setup_intent_data: { metadata },
      custom_text: {
        submit: { message: `Nothing is charged today. We charge ${formatPrice(plan.price)} after each visit you book.` },
      },
    };
  } else if (plan.type === "monthly") {
    params = {
      ...common,
      mode: "subscription",
      line_items: [lineItem({ interval: "month" })],
      subscription_data: { metadata },
    };
  } else {
    params = {
      ...common,
      mode: "payment",
      line_items: [lineItem()],
      payment_intent_data: { metadata },
    };
  }

  const session = await getStripe().checkout.sessions.create(params);
  await updateSubscription(subscription.id, { stripe_checkout_session: session.id });
  if (!session.url) throw new Error(`Checkout session ${session.id} has no URL`);
  return session.url;
}

// Stripe webhook: checkout finished. Activates the plan. Safe to receive
// more than once (Stripe retries webhooks).
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subscriptionId = session.metadata?.pocketbase_subscription_id;
  if (!subscriptionId) return;

  const pb = await getAdminClient();
  let subscription: SubscriptionRecord;
  try {
    subscription = await pb.collection("subscriptions").getOne(subscriptionId);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  if (subscription.status !== "pending") return;

  const stripe = getStripe();
  if (session.mode === "setup") {
    const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
    if (!setupIntentId) throw new Error(`Setup session ${session.id} has no setup intent`);
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    const paymentMethod =
      typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
    if (!paymentMethod) throw new Error(`Setup intent ${setupIntentId} has no payment method`);

    const customer = await pb.collection("customers").getOne(subscription.customer);
    await stripe.customers.update(await ensureStripeCustomer(customer), {
      invoice_settings: { default_payment_method: paymentMethod },
    });
    await pb.collection("customers").update(customer.id, { stripe_payment_method: paymentMethod });
  } else if (session.payment_status !== "paid") {
    // Card payments are paid by the time checkout completes; anything else
    // (e.g. a delayed bank payment) needs a look in the Stripe dashboard.
    console.warn(`Checkout ${session.id} completed with payment_status ${session.payment_status}`);
    return;
  }

  if (session.mode === "subscription") {
    const stripeSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (stripeSubscriptionId) {
      await updateSubscription(subscription.id, { stripe_subscription_id: stripeSubscriptionId });
      await stopMonthlyAtSeasonEnd(stripeSubscriptionId);
    }
  }

  await activate(subscription);
}

// Monthly plans stop renewing after the season ends instead of charging
// through the summer.
async function stopMonthlyAtSeasonEnd(stripeSubscriptionId: string) {
  const end = seasonEndDate();
  if (!end) {
    console.warn("SEASON_END_DATE is not set: Monthly plans will renew until cancelled");
    return;
  }
  // End of that day, Toronto time (close enough either side of DST)
  const cancelAt = Math.floor(new Date(`${end}T23:59:59-04:00`).getTime() / 1000);
  if (cancelAt <= Date.now() / 1000) return;
  await getStripe().subscriptions.update(stripeSubscriptionId, { cancel_at: cancelAt });
}

// Makes a paid plan the property's active plan, ending the previous one.
async function activate(subscription: SubscriptionRecord) {
  const previous = await getActiveSubscription(subscription.customer, subscription.property);
  if (previous && previous.id !== subscription.id) {
    await setSubscriptionStatus(previous.id, "expired");
    if (previous.stripe_subscription_id) {
      // Changing away from Monthly: stop future charges. Refunds for unused
      // time, if any, are done by hand in the Stripe dashboard.
      await getStripe().subscriptions.cancel(previous.stripe_subscription_id);
    }
  }
  // Runs before the plan turns active so a failure is retried with the webhook
  if (subscription.plan_type !== "one_time") await coverOpenVisits(subscription);
  await setSubscriptionStatus(subscription.id, "active");
}

// A One Time customer who upgrades after being texted about a storm: their
// uncharged $50 visits for today or later become part of the new plan, so
// marking them done doesn't charge on top of it. Finished visits and past
// storms are left alone; those were One Time visits and are still owed.
async function coverOpenVisits(subscription: SubscriptionRecord) {
  const pb = await getAdminClient();
  const visits = await pb.collection("visits").getFullList({
    filter: pb.filter(
      'property = {:property} && payment_status = "due" && status != "done" && storm.service_date >= {:today}',
      { property: subscription.property, today: localDate() },
    ),
  });
  for (const visit of visits) {
    await pb.collection("visits").update(visit.id, {
      subscription: subscription.id,
      price: 0,
      payment_status: "not_needed",
      // Subscribers are booked automatically, like on a normal storm day
      ...(visit.status === "offered" && { status: "booked", booked_at: new Date().toISOString() }),
    });
  }
}

// Stripe webhook: a Monthly subscription changed (renewal failed, cancelled,
// reached the season end, ...). Mirrors it onto our plan.
export async function handleStripeSubscriptionChange(stripeSubscription: Stripe.Subscription) {
  const pb = await getAdminClient();
  let subscription: SubscriptionRecord;
  try {
    subscription = await pb
      .collection("subscriptions")
      .getFirstListItem(pb.filter("stripe_subscription_id = {:id}", { id: stripeSubscription.id }));
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  // Only plans that are live on our side follow Stripe's status
  if (subscription.status !== "active" && subscription.status !== "paused") return;

  const status = {
    active: "active",
    trialing: "active",
    past_due: "paused",
    unpaid: "paused",
    paused: "paused",
    incomplete: "paused",
    canceled: "expired",
    incomplete_expired: "expired",
  } as Record<string, SubscriptionRecord["status"] | undefined>;
  // Unknown future Stripe statuses leave the plan as it is
  const next = status[stripeSubscription.status];
  if (next && next !== subscription.status) await setSubscriptionStatus(subscription.id, next);
}

type VisitWithCustomer = WithExpand<
  VisitRecord,
  { storm: StormRecord; property: WithExpand<PropertyRecord, { customer: CustomerRecord }> }
>;

// Charges a One Time visit to the card saved at signup. Called when staff
// mark the visit done, or press "Try charge again" after a decline. Never
// charges twice: a paid visit is skipped, and each attempt has its own
// Stripe idempotency key.
export async function chargeVisit(visitId: string): Promise<void> {
  const pb = await getAdminClient();
  const visit = await pb
    .collection("visits")
    .getOne<VisitWithCustomer>(visitId, { expand: "storm,property.customer" });
  if (visit.payment_status !== "due" && visit.payment_status !== "failed") return;
  if (visit.price <= 0) return;

  const customer = visit.expand?.property?.expand?.customer;
  const attempts = visit.payment_attempts + 1;
  const fail = (message: string) =>
    pb.collection("visits").update(visit.id, {
      payment_status: "failed",
      payment_error: message,
      payment_attempts: attempts,
    });

  if (!customer?.stripe_customer_id || !customer.stripe_payment_method) {
    await fail("No card on file. Call the customer to arrange payment.");
    return;
  }

  const day = visit.expand?.storm ? formatServiceDate(visit.expand.storm.service_date) : "";
  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount: toCents(visit.price),
        currency: "cad",
        customer: customer.stripe_customer_id,
        payment_method: customer.stripe_payment_method,
        off_session: true,
        confirm: true,
        description: `Kaiyns snow shovelling ${day}: ${visit.expand?.property?.street_address ?? ""}`.trim(),
        metadata: { pocketbase_visit_id: visit.id },
      },
      { idempotencyKey: `visit-${visit.id}-attempt-${attempts}` },
    );
    if (intent.status === "succeeded") {
      await pb.collection("visits").update(visit.id, {
        payment_status: "paid",
        payment_error: "",
        stripe_payment_intent: intent.id,
        payment_attempts: attempts,
      });
    } else {
      await fail(`Payment is ${intent.status.replaceAll("_", " ")}. Check it in Stripe.`);
    }
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; message?: string };
    if (stripeError.type === "StripeCardError") {
      await fail(
        stripeError.code === "authentication_required"
          ? "The bank wants the customer to approve this payment. Call them."
          : `Card declined: ${stripeError.message ?? "unknown reason"}`,
      );
      return;
    }
    console.error(`Charging visit ${visit.id} failed`, error);
    await fail("Couldn't reach Stripe. Try again in a few minutes.");
  }
}
