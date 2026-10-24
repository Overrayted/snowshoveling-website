import Link from "next/link";
import { Suspense } from "react";
import { formatPrice, getPlan } from "@/lib/business";
import { requireStaff } from "@/lib/auth";
import { addDays, formatServiceDate, localDate } from "@/lib/dates";
import type {
  CustomerRecord,
  PropertyRecord,
  SubscriptionRecord,
  VisitRecord,
  VisitStatus,
  WithExpand,
} from "@/lib/pocketbase/types";
import { retryVisitCharge, setVisitStatus, signOut, startManualStormDay } from "./actions";

export default function StaffPage(props: PageProps<"/staff">) {
  return (
    <Suspense fallback={<p className="text-xl">Loading…</p>}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/staff">, "searchParams">) {
  const { staff, pb } = await requireStaff();
  const params = await searchParams;
  const today = localDate();

  const { items: storms } = await pb.collection("storms").getList(1, 10, {
    filter: pb.filter("service_date >= {:from}", { from: addDays(today, -14) }),
    sort: "-service_date",
  });

  // Default to the next upcoming storm day, else the most recent one
  const selected =
    storms.find((s) => s.service_date === params.date) ??
    storms.filter((s) => s.service_date >= today).at(-1) ??
    storms[0];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xl">
          Hi, <strong>{staff.full_name}</strong>
        </p>
        <form action={signOut}>
          <button className="min-h-12 rounded-xl border-4 border-brand-slate-muted px-4 text-lg font-bold">
            Sign out
          </button>
        </form>
      </div>

      {params.error === "date" && (
        <p role="alert" className="mt-6 rounded-xl border-4 border-red-700 bg-red-50 p-4 text-lg font-bold text-red-800">
          Pick a date between today and two weeks from now.
        </p>
      )}

      {storms.length > 0 && (
        <nav aria-label="Storm days" className="mt-8 flex flex-wrap gap-3">
          {storms.map((s) => (
            <Link
              key={s.id}
              href={`/staff?date=${s.service_date}`}
              aria-current={s.id === selected?.id ? "page" : undefined}
              className="rounded-xl border-4 border-brand-blue px-4 py-2 text-lg font-bold text-brand-blue aria-[current=page]:bg-brand-blue aria-[current=page]:text-brand-white"
            >
              {formatServiceDate(s.service_date)}
            </Link>
          ))}
        </nav>
      )}

      {selected ? (
        <Suspense fallback={<p className="mt-8 text-xl">Loading visits…</p>}>
          <VisitList stormId={selected.id} serviceDate={selected.service_date} snowMm={selected.expected_snow_mm} />
        </Suspense>
      ) : (
        <p className="mt-8 text-xl">No storm days yet. They&apos;ll appear here when snow is forecast.</p>
      )}

      <StartStormDayForm defaultDate={addDays(today, 1)} minDate={today} />
    </>
  );
}

async function VisitList({
  stormId,
  serviceDate,
  snowMm,
}: {
  stormId: string;
  serviceDate: string;
  snowMm: number;
}) {
  const { pb } = await requireStaff();
  const visits = await pb.collection("visits").getFullList<VisitRow>({
    filter: pb.filter("storm = {:storm}", { storm: stormId }),
    expand: "property.customer,subscription",
  });

  const street = (v: VisitRow) => v.expand?.property?.street_address ?? "";
  visits.sort((a, b) => street(a).localeCompare(street(b)));
  const byStatus = (status: VisitStatus) => visits.filter((v) => v.status === status);
  const toDo = byStatus("booked");
  const done = byStatus("done");
  const waiting = byStatus("offered");
  const skipped = byStatus("skipped");

  return (
    <section aria-labelledby="day-heading" className="mt-8">
      <h1 id="day-heading" className="text-3xl font-bold">
        {formatServiceDate(serviceDate)}
      </h1>
      <p className="mt-2 text-xl">
        {snowMm ? `About ${Math.round(snowMm)} cm forecast. ` : ""}
        <strong>{toDo.length}</strong> to shovel, <strong>{done.length}</strong> done.
      </p>

      <VisitGroup
        title="To shovel"
        visits={toDo}
        actions={[
          ["done", "Mark done"],
          ["skipped", "Skip"],
        ]}
      />
      <VisitGroup title="Done" visits={done} actions={[["booked", "Undo"]]} />
      <VisitGroup
        title="Texted, no reply yet"
        note="One-time customers we offered a visit to. Call them if you have time, then press Book."
        visits={waiting}
        actions={[["booked", "Book"]]}
      />
      <VisitGroup title="Skipped" visits={skipped} actions={[["booked", "Undo"]]} />
    </section>
  );
}

type VisitRow = WithExpand<
  VisitRecord,
  {
    property: WithExpand<PropertyRecord, { customer: CustomerRecord }>;
    subscription: SubscriptionRecord;
  }
>;

function VisitGroup({
  title,
  note,
  visits,
  actions,
}: {
  title: string;
  note?: string;
  visits: VisitRow[];
  // [status to set, button label]
  actions: [Exclude<VisitStatus, "offered">, string][];
}) {
  if (visits.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-bold">
        {title} ({visits.length})
      </h2>
      {note && <p className="mt-1 text-lg text-brand-slate-muted">{note}</p>}
      <ul className="mt-4 flex flex-col gap-4">
        {visits.map((visit) => {
          const property = visit.expand?.property;
          const customer = property?.expand?.customer;
          const subscription = visit.expand?.subscription;
          if (!property || !customer) return null;
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(property.street_address)}`;
          return (
            <li key={visit.id} className="rounded-2xl border-4 border-brand-slate-muted/30 p-5">
              <p className="text-2xl font-bold">{property.street_address}</p>
              <p className="mt-1 text-lg">
                {customer.full_name} ·{" "}
                <a href={`tel:${customer.phone_number}`} className="font-bold text-brand-blue underline underline-offset-4">
                  {customer.phone_number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3")}
                </a>
              </p>
              <p className="mt-1 text-lg text-brand-slate-muted">
                {subscription ? getPlan(subscription.plan_type).name : "No plan"}
                {property.driveway_size && ` · ${property.driveway_size} driveway`}
                {property.estimated_square_feet > 0 && ` (~${property.estimated_square_feet} sq ft)`}
              </p>
              <PaymentLine visit={visit} />
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-14 items-center rounded-xl border-4 border-brand-blue px-5 text-lg font-bold text-brand-blue"
                >
                  Directions
                </a>
                {actions.map(([status, label]) => (
                  <form key={status} action={setVisitStatus}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="status" value={status} />
                    <button
                      className={`min-h-14 rounded-xl px-5 text-lg font-bold ${
                        status === "done"
                          ? "bg-brand-blue text-brand-white hover:bg-brand-blue-dark"
                          : "border-4 border-brand-slate-muted text-brand-slate"
                      }`}
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// One Time visits are charged to the customer's saved card when marked done.
function PaymentLine({ visit }: { visit: VisitRow }) {
  const amount = formatPrice(visit.price);
  switch (visit.payment_status) {
    case "due":
      return <p className="mt-1 text-lg">Charges {amount} to their card when marked done</p>;
    case "paid":
      return <p className="mt-1 text-lg font-bold text-green-800">Paid {amount} ✓</p>;
    case "failed":
      return (
        <div role="alert" className="mt-3 rounded-xl border-4 border-red-700 bg-red-50 p-4">
          <p className="text-lg font-bold text-red-800">Not paid: {visit.payment_error}</p>
          <form action={retryVisitCharge} className="mt-3">
            <input type="hidden" name="visitId" value={visit.id} />
            <button className="min-h-12 rounded-xl border-4 border-red-700 bg-brand-white px-4 text-lg font-bold text-red-800">
              Try charging {amount} again
            </button>
          </form>
        </div>
      );
    default:
      return null;
  }
}

function StartStormDayForm({ defaultDate, minDate }: { defaultDate: string; minDate: string }) {
  return (
    <form action={startManualStormDay} className="mt-14 rounded-2xl bg-brand-cyan-light p-6">
      <h2 className="text-2xl font-bold">Start a storm day</h2>
      <p className="mt-1 text-lg">
        If the forecast missed a snowfall: this books every Monthly and Full Season customer and
        texts One Time customers an offer. Running it again for the same day won&apos;t text anyone twice.
      </p>
      <label className="mt-4 block text-xl font-bold">
        Date
        <input
          type="date"
          name="date"
          required
          defaultValue={defaultDate}
          min={minDate}
          className="mt-2 block min-h-14 rounded-xl border-4 border-brand-slate-muted bg-brand-white px-4 text-xl"
        />
      </label>
      <button className="mt-4 min-h-14 rounded-xl bg-brand-blue px-6 text-xl font-bold text-brand-white hover:bg-brand-blue-dark">
        Start storm day
      </button>
    </form>
  );
}
