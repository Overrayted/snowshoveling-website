import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CallButton } from "@/components/call-button";
import { PLANS, formatPrice } from "@/lib/business";

export const metadata: Metadata = {
  title: "Thank you | Kaiyns Snow Shovelling",
};

export default function ThankYouPage(props: PageProps<"/thank-you">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <p aria-hidden="true" className="text-7xl">
        ❄️
      </p>
      <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Thank you! You&apos;re signed up.</h1>
      <Suspense fallback={null}>
        <PlanLine searchParams={props.searchParams} />
      </Suspense>
      <p className="mt-6 text-xl">We&apos;ll call you soon to say hello and confirm your details.</p>
      <p className="mt-10 text-xl">Questions? We&apos;re happy to help.</p>
      <CallButton variant="blue" label="Call" className="mt-4" />
      <p className="mt-10">
        <Link href="/" className="text-xl font-bold text-brand-blue underline underline-offset-4">
          Back to the home page
        </Link>
      </p>
    </div>
  );
}

async function PlanLine({ searchParams }: Pick<PageProps<"/thank-you">, "searchParams">) {
  const { plan: type, already } = await searchParams;
  const plan = PLANS.find((p) => p.type === type);
  if (!plan) return null;
  return (
    <>
      <p className="mt-6 text-xl">
        Your plan: <strong>{plan.name}</strong>.
      </p>
      {already === "1" && (
        <p className="mt-2 text-xl">You were already signed up for this plan, so nothing new was charged.</p>
      )}
      {plan.type === "one_time" && !already && (
        <p className="mt-2 text-xl">
          Your card is saved. We only charge {formatPrice(plan.price)} after a visit you book.
        </p>
      )}
    </>
  );
}
