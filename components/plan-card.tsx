import { formatPrice, type Plan } from "@/lib/business";

export function PlanCard({ plan, children }: { plan: Plan; children?: React.ReactNode }) {
  return (
    <li
      className={`relative flex flex-col rounded-3xl border-4 bg-brand-white p-8 shadow-md ${
        plan.highlight ? "border-brand-blue" : "border-transparent"
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-5 left-8 rounded-full bg-brand-cyan px-4 py-1 text-lg font-bold text-brand-slate">
          {plan.highlight}
        </span>
      )}
      <h3 className="text-2xl font-bold">{plan.name}</h3>
      <p className="mt-4">
        <span className="text-5xl font-bold text-brand-blue">{formatPrice(plan.price)}</span>{" "}
        <span className="text-xl text-brand-slate-muted">{plan.priceUnit}</span>
      </p>
      <p className="mt-4 flex-1">{plan.summary}</p>
      {children}
    </li>
  );
}

export function NoHstNote() {
  return (
    <div className="mt-10 flex max-w-3xl gap-4 rounded-3xl border-4 border-brand-blue bg-brand-white p-6">
      <span aria-hidden="true" className="text-4xl">
        🎓
      </span>
      <p>
        <strong className="block text-xl">No HST. The price you see is the price you pay.</strong>
        We&apos;re a small, student-run business, so we don&apos;t charge HST.
      </p>
    </div>
  );
}
