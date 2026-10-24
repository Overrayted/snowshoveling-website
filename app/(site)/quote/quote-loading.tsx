"use client";

import { useEffect, useState } from "react";

// What the quote page is doing while it loads (lib/estimator.ts really does
// find the home and look at the driveway).
const STEPS = [
  "Finding your home on the map…",
  "Looking at your driveway from above…",
  "Putting together your quote…",
];
const STEP_MS = 500;

export function QuoteLoading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-10 flex flex-col items-center rounded-3xl bg-brand-cyan-light px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="size-20 rounded-full border-8 border-brand-white border-t-brand-blue motion-safe:animate-[spin_0.6s_linear_infinite]"
      />
      <p role="status" className="mt-8 text-2xl font-bold">
        {STEPS[step]}
      </p>
      <ol className="mt-6 flex gap-3" aria-hidden="true">
        {STEPS.map((text, i) => (
          <li
            key={text}
            className={`size-4 rounded-full transition-colors ${i <= step ? "bg-brand-blue" : "bg-brand-white"}`}
          />
        ))}
      </ol>
    </div>
  );
}
