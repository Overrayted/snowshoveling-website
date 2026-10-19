import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up | Kaiyns Snow Shovelling",
};

export default function SignupPage(props: PageProps<"/signup">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl font-bold sm:text-5xl">Sign up</h1>
      <p className="mt-4 max-w-3xl">Two quick steps. It takes about a minute.</p>
      <Suspense fallback={<p className="mt-6 text-xl">Loading…</p>}>
        <PrefilledForm searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function PrefilledForm({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  return (
    <SignupForm
      initialValues={{
        plan: first(params.plan),
        fullName: "",
        phone: "",
        address: first(params.address),
        smsOptIn: false,
      }}
    />
  );
}
