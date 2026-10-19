"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "../actions";

const inputClass =
  "mt-2 min-h-14 w-full rounded-xl border-4 border-brand-slate-muted px-4 text-xl focus:border-brand-blue";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, { email: "" });

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      {state.error && (
        <p role="alert" className="rounded-xl border-4 border-red-700 bg-red-50 p-4 text-lg font-bold text-red-800">
          {state.error}
        </p>
      )}
      <label className="block text-xl font-bold">
        Email
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} />
      </label>
      <label className="block text-xl font-bold">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-xl bg-brand-blue px-6 text-xl font-bold text-brand-white hover:bg-brand-blue-dark disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
