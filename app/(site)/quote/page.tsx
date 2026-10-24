import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NoHstNote, PlanCard } from "@/components/plan-card";
import { PLANS } from "@/lib/business";
import { type DrivewayEstimate, estimateDriveway } from "@/lib/estimator";
import { QuoteLoading } from "./quote-loading";

export const metadata: Metadata = {
  title: "Your quote | Kaiyns Snow Shovelling",
};

// The loading screen stays up at least this long, so the quote feels
// prepared for the customer even when the estimate is cached.
const MIN_LOADING_MS = 1500;
// Show the quote without the driveway note if the estimate is slower than this
const MAX_ESTIMATE_MS = 12000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function QuotePage(props: PageProps<"/quote">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl font-bold sm:text-5xl">Your personalized quote</h1>
      <Suspense fallback={<QuoteLoading />}>
        <Quote searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Quote({ searchParams }: Pick<PageProps<"/quote">, "searchParams">) {
  const { address: raw } = await searchParams;
  const address = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!address) redirect("/#address");

  const [estimate] = await Promise.all([
    Promise.race([
      estimateDriveway(address),
      pause(MAX_ESTIMATE_MS).then((): DrivewayEstimate => ({ status: "unavailable" })),
    ]),
    pause(MIN_LOADING_MS),
  ]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-brand-cyan-light p-6">
        <p className="text-xl">
          Address: <strong>{address}</strong>
        </p>
        <Link href="/#address" className="text-xl font-bold text-brand-blue underline underline-offset-4">
          Change address
        </Link>
      </div>

      <DrivewayNote estimate={estimate} />

      <h2 className="mt-12 text-3xl font-bold">Choose your plan</h2>
      <p className="mt-2">You can change your plan any time.</p>
      {/* Prices are flat for now. When pricing depends on driveway size, compute
          them with getQuoteAmount() using the estimate. */}
      <ul className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.type} plan={plan}>
            <Link
              href={`/signup?${new URLSearchParams({ address, plan: plan.type })}`}
              className="mt-6 flex min-h-16 items-center justify-center rounded-2xl bg-brand-blue px-4 text-xl whitespace-nowrap font-bold text-brand-white shadow-md transition-colors hover:bg-brand-blue-dark"
            >
              {plan.name}
            </Link>
          </PlanCard>
        ))}
      </ul>
      <NoHstNote />
    </>
  );
}

const SIZE_LABEL = { small: "small", medium: "medium-sized", large: "large" };

function DrivewayNote({ estimate }: { estimate: DrivewayEstimate }) {
  if (estimate.status === "ok") {
    return (
      <p role="status" className="mt-6 max-w-3xl text-xl">
        We looked at your home from above. Your driveway looks{" "}
        <strong>{SIZE_LABEL[estimate.size]}</strong> (about{" "}
        {estimate.squareFeet.toLocaleString("en-CA")} square feet). Here are your
        options.
      </p>
    );
  }
  if (estimate.status === "not_found") {
    return (
      <p role="status" className="mt-6 max-w-3xl text-xl">
        We couldn&apos;t find that exact address on the map. That&apos;s okay: you can
        still sign up, and we&apos;ll check it with you on the phone.
      </p>
    );
  }
  return null;
}
