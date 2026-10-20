import type Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { handleCheckoutCompleted, handleStripeSubscriptionChange } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";

// Stripe calls this when a payment or subscription changes. In the Stripe
// dashboard (Developers > Webhooks), add <SITE_URL>/api/stripe/webhook with
// the events checkout.session.completed, customer.subscription.updated and
// customer.subscription.deleted.
export async function POST(request: Request) {
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      request.headers.get("stripe-signature") ?? "",
      requireEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleStripeSubscriptionChange(event.data.object);
        break;
    }
  } catch (error) {
    // A 500 makes Stripe retry later, e.g. after the homelab comes back up
    console.error(`Stripe webhook ${event.type} (${event.id}) failed`, error);
    return new Response("Webhook handler failed", { status: 500 });
  }
  return Response.json({ received: true });
}
