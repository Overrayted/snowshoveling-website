import { BUSINESS_EMAIL, BUSINESS_PHONE } from "@/lib/business";

const variants = {
  // White on the blue header / blue sections
  light: "bg-brand-white text-brand-blue hover:bg-brand-cyan-light",
  // Cyan with dark text, for the most prominent placements
  cyan: "bg-brand-cyan text-brand-slate hover:bg-brand-cyan-light",
  // Blue on white sections
  blue: "bg-brand-blue text-brand-white hover:bg-brand-blue-dark",
};

// Email is our main contact; PhoneLine shows the number as a smaller second option.
export function EmailButton({
  variant = "cyan",
  label = "Email",
  className = "",
}: {
  variant?: keyof typeof variants;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={BUSINESS_EMAIL.href}
      className={`inline-flex min-h-16 max-w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-xl sm:px-6 font-bold shadow-md transition-colors ${variants[variant]} ${className}`}
    >
      <EmailIcon />
      <span>
        {label && `${label} `}<span className="whitespace-nowrap">{BUSINESS_EMAIL.address}</span>
      </span>
    </a>
  );
}

export function PhoneLine({ className = "" }: { className?: string }) {
  return (
    <p className={`text-lg ${className}`}>
      Or call{" "}
      <a href={BUSINESS_PHONE.href} className="font-bold whitespace-nowrap underline underline-offset-4">
        {BUSINESS_PHONE.display}
      </a>
    </p>
  );
}

function EmailIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-7 shrink-0"
      fill="currentColor"
    >
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v.5l8 5 8-5V6H4zm16 2.85-7.47 4.67a1 1 0 0 1-1.06 0L4 8.85V18h16V8.85z" />
    </svg>
  );
}
