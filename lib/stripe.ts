import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    maxNetworkRetries: 2,
    ...testServerOptions(),
  });
  return client;
}

// Automated tests only: point the SDK at a local stripe-mock server, e.g.
// STRIPE_API_BASE=http://localhost:12111. Never set this in production.
function testServerOptions(): Partial<Stripe.StripeConfig> {
  const base = process.env.STRIPE_API_BASE;
  if (!base) return {};
  const url = new URL(base);
  return { host: url.hostname, port: url.port, protocol: url.protocol === "https:" ? "https" : "http" };
}

// Stripe amounts are in cents
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
