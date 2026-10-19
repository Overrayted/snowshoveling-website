import type { DrivewaySize, PlanType } from "@/lib/pocketbase/types";

export const BUSINESS_PHONE = {
  e164: "+16476437864",
  display: "647-643-7864",
  href: "tel:+16476437864",
};

// We're a small, student-run business and don't charge HST, so every price
// shown is the final price.
export const CHARGES_HST = false;

export type Plan = {
  type: PlanType;
  name: string;
  price: number;
  priceUnit: string;
  summary: string;
  highlight?: string;
};

// Listed in the order shown to customers.
export const PLANS: Plan[] = [
  {
    type: "one_time",
    name: "One Storm",
    price: 50,
    priceUnit: "per visit",
    summary: "We clear your driveway once, when you need it. No commitment.",
  },
  {
    type: "monthly",
    name: "Monthly",
    price: 300,
    priceUnit: "per month",
    summary: "We clear your driveway after every snowfall that month.",
  },
  {
    type: "full_season",
    name: "Full Season",
    price: 1000,
    priceUnit: "for the whole winter",
    summary: "We clear your driveway after every snowfall, all winter long.",
    highlight: "Best value",
  },
];

export function getPlan(type: PlanType): Plan {
  const plan = PLANS.find((p) => p.type === type);
  if (!plan) throw new Error(`Unknown plan type: ${type}`);
  return plan;
}

// Pricing is flat for now. The extra inputs are here so flexible pricing by
// square footage and time slot can be added without changing callers.
export function getQuoteAmount(input: {
  planType: PlanType;
  drivewaySize?: DrivewaySize | null;
  estimatedSquareFeet?: number | null;
}): number {
  return getPlan(input.planType).price;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
