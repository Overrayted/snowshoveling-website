"use client";

import { useActionState } from "react";
import { BUSINESS_PHONE, PLANS, formatPrice, getPlan } from "@/lib/business";
import { submitSignup, type SignupState, type SignupValues } from "./actions";

export function SignupForm({
  initialValues,
  seasonEnd,
  paymentCancelled,
}: {
  initialValues: SignupValues;
  seasonEnd: string | null; // e.g. "April 30"
  paymentCancelled: boolean;
}) {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(submitSignup, {
    values: initialValues,
    errors: {},
    formError: paymentCancelled
      ? `Your payment wasn't finished, so you're not signed up yet. You can try again below, or call us at ${BUSINESS_PHONE.display}.`
      : undefined,
  });
  const { values, errors } = state;

  return (
    <form action={formAction} noValidate className="mt-8 flex max-w-3xl flex-col gap-10">
      {state.formError && (
        <p role="alert" className="rounded-2xl border-4 border-red-700 bg-red-50 p-5 text-xl font-bold text-red-800">
          {state.formError}
        </p>
      )}

      <fieldset aria-describedby={errors.plan ? "plan-error" : undefined}>
        <legend className="text-2xl font-bold">1. Your plan</legend>
        <FieldError id="plan-error" message={errors.plan} />
        <div className="mt-4 flex flex-col gap-4">
          {PLANS.map((plan) => (
            <label
              key={plan.type}
              className="flex cursor-pointer items-center gap-5 rounded-2xl border-4 border-brand-slate-muted/40 p-5 has-checked:border-brand-blue has-checked:bg-brand-cyan-light"
            >
              <input
                type="radio"
                name="plan"
                value={plan.type}
                defaultChecked={values.plan === plan.type}
                className="size-8 shrink-0 accent-brand-blue"
              />
              <span>
                <span className="block text-xl font-bold">
                  {plan.name}: {formatPrice(plan.price)} {plan.priceUnit}
                </span>
                <span className="block">{plan.summary}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-8">
        <legend className="mb-2 text-2xl font-bold">2. Your details</legend>
        <TextField
          name="fullName"
          label="Your full name"
          autoComplete="name"
          defaultValue={values.fullName}
          error={errors.fullName}
        />
        <TextField
          name="phone"
          label="Your phone number"
          hint="We'll call this number to confirm."
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={values.phone}
          error={errors.phone}
        />
        <TextField
          name="address"
          label="Address to shovel"
          autoComplete="street-address"
          defaultValue={values.address}
          error={errors.address}
        />
        <label className="flex cursor-pointer items-start gap-5 rounded-2xl border-4 border-brand-slate-muted/40 p-5 has-checked:border-brand-blue has-checked:bg-brand-cyan-light">
          <input
            type="checkbox"
            name="smsOptIn"
            defaultChecked={values.smsOptIn}
            className="mt-1 size-8 shrink-0 accent-brand-blue"
          />
          <span>
            <span className="block text-xl font-bold">Text me when snow is coming</span>
            <span className="block">
              One Storm customers: we&apos;ll text you before a snowfall so you can
              book a visit by replying YES. Reply STOP any time to stop.
            </span>
          </span>
        </label>
      </fieldset>

      <div>
        <p className="text-xl font-bold">Next: pay safely with Stripe</p>
        <p className="mt-2">
          You&apos;ll go to Stripe&apos;s secure page to enter your card. No HST is charged.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>
            <strong>One Storm:</strong> nothing is charged today. We save your card and charge{" "}
            {formatPrice(getPlan("one_time").price)} after each visit you book.
          </li>
          <li>
            <strong>Monthly:</strong> {formatPrice(getPlan("monthly").price)} today, then once a
            month{seasonEnd ? ` until ${seasonEnd}` : ""}.
          </li>
          <li>
            <strong>Full Season:</strong> {formatPrice(getPlan("full_season").price)} today, once.
          </li>
        </ul>
        <button
          type="submit"
          disabled={pending}
          className="mt-6 min-h-16 w-full rounded-2xl bg-brand-blue px-8 text-2xl font-bold text-brand-white shadow-md transition-colors hover:bg-brand-blue-dark disabled:opacity-70 sm:w-auto"
        >
          {pending ? "One moment…" : "Continue to payment"}
        </button>
        <p className="mt-6">
          Questions? Call us at{" "}
          <a href={BUSINESS_PHONE.href} className="font-bold text-brand-blue underline underline-offset-4">
            {BUSINESS_PHONE.display}
          </a>
          .
        </p>
      </div>
    </form>
  );
}

function TextField({
  name,
  label,
  hint,
  error,
  ...inputProps
}: {
  name: Exclude<keyof SignupValues, "smsOptIn">;
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={name} className="block text-xl font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-brand-slate-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${name}-error`} message={error} />
      <input
        id={name}
        name={name}
        type="text"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="mt-3 min-h-16 w-full rounded-2xl border-4 border-brand-slate-muted px-5 text-xl focus:border-brand-blue aria-invalid:border-red-700"
        {...inputProps}
      />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-xl font-bold text-red-700">
      {message}
    </p>
  );
}
