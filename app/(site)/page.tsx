import Form from "next/form";
import { CallButton } from "@/components/call-button";
import { NoHstNote, PlanCard } from "@/components/plan-card";
import { PLANS } from "@/lib/business";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Pricing />
      <TalkToUs />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-brand-blue text-brand-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24">
        <h1 className="max-w-3xl text-4xl leading-tight font-bold sm:text-6xl">
          We shovel your driveway, so you don&apos;t have to.
        </h1>
        <p className="mt-6 max-w-2xl text-xl sm:text-2xl">
          Friendly, reliable snow clearing for families and seniors. Get your
          free price in under a minute.
        </p>

        <Form
          action="/quote"
          className="mt-10 max-w-3xl rounded-3xl bg-brand-white p-6 text-brand-slate shadow-xl sm:p-8"
        >
          <label htmlFor="address" className="block text-2xl font-bold">
            What is your home address?
          </label>
          <p id="address-hint" className="mt-2 text-lg text-brand-slate-muted">
            For example: 123 Main Street, Toronto
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row">
            <input
              id="address"
              name="address"
              type="text"
              required
              autoComplete="street-address"
              aria-describedby="address-hint"
              className="min-h-16 flex-1 rounded-2xl border-4 border-brand-slate-muted px-5 text-xl placeholder:text-brand-slate-muted focus:border-brand-blue"
            />
            <button
              type="submit"
              className="min-h-16 rounded-2xl bg-brand-blue px-8 text-xl font-bold text-brand-white shadow-md transition-colors hover:bg-brand-blue-dark"
            >
              Get my free price
            </button>
          </div>
        </Form>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Tell us your address",
    body: "Type it in above so we know where to come.",
  },
  {
    title: "Pick a plan",
    body: "One storm, one month, or the whole winter. You can change plans any time.",
  },
  {
    title: "Relax when it snows",
    body: "When the snow falls, we come and clear your driveway.",
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 id="how-heading" className="text-3xl font-bold sm:text-4xl">
        How it works
      </h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-5">
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-cyan text-3xl font-bold text-brand-slate"
            >
              {i + 1}
            </span>
            <div>
              <h3 className="text-2xl font-bold">{step.title}</h3>
              <p className="mt-2">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Pricing() {
  return (
    <section aria-labelledby="pricing-heading" className="bg-brand-cyan-light">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="pricing-heading" className="text-3xl font-bold sm:text-4xl">
          Simple, honest prices
        </h2>
        <p className="mt-4 max-w-3xl">
          The same price for every driveway. You can upgrade or change your plan
          at any time.
        </p>

        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.type} plan={plan} />
          ))}
        </ul>
        <NoHstNote />
      </div>
    </section>
  );
}

function TalkToUs() {
  return (
    <section aria-labelledby="talk-heading" className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
      <h2 id="talk-heading" className="text-3xl font-bold sm:text-4xl">
        Rather talk to a person?
      </h2>
      <p className="mx-auto mt-4 max-w-2xl">
        Give us a call. We&apos;re happy to answer questions and sign you up over
        the phone.
      </p>
      <CallButton variant="blue" label="Call" className="mt-8 px-10 text-2xl" />
    </section>
  );
}
