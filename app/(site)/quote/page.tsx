import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NoHstNote, PlanCard } from "@/components/plan-card";
import { PLANS } from "@/lib/business";
import { estimateDriveway } from "@/lib/estimator";

export const metadata: Metadata = {
  title: "Your price | Kaiyns Snow Shovelling",
};

export default function QuotePage(props: PageProps<"/quote">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl font-bold sm:text-5xl">Your price</h1>
      <Suspense fallback={<p className="mt-6 text-xl">Loading your price…</p>}>
        <Quote searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Quote({ searchParams }: Pick<PageProps<"/quote">, "searchParams">) {
  const { address: raw } = await searchParams;
  const address = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!address) redirect("/#address");

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

      <Suspense
        fallback={
          <p role="status" className="mt-6 text-xl text-brand-slate-muted">
            Taking a look at your driveway from above…
          </p>
        }
      >
        <DrivewayNote address={address} />
      </Suspense>

      <h2 className="mt-12 text-3xl font-bold">Choose your plan</h2>
      <p className="mt-2">You can change your plan any time.</p>
      {/* Prices are flat for now. When pricing depends on driveway size, compute
          them with getQuoteAmount() using the estimate. */}
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.type} plan={plan}>
            <Link
              href={`/signup?${new URLSearchParams({ address, plan: plan.type })}`}
              className="mt-6 flex min-h-16 items-center justify-center rounded-2xl bg-brand-blue px-6 text-xl font-bold text-brand-white shadow-md transition-colors hover:bg-brand-blue-dark"
            >
              Choose {plan.name}
            </Link>
          </PlanCard>
        ))}
      </ul>
      <NoHstNote />
    </>
  );
}

const SIZE_LABEL = { small: "small", medium: "medium-sized", large: "large" };

async function DrivewayNote({ address }: { address: string }) {
  const estimate = await estimateDriveway(address);

  if (estimate.status === "ok") {
    return (
      <p role="status" className="mt-6 max-w-3xl text-xl">
        We looked at your home from above. Your driveway looks{" "}
        <strong>{SIZE_LABEL[estimate.size]}</strong> (about{" "}
        {estimate.squareFeet.toLocaleString("en-CA")} square feet). Good news: our
        price is the same for every driveway.
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
