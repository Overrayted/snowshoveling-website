import { BUSINESS_PHONE } from "@/lib/business";

const variants = {
  // White on the blue header / blue sections
  light: "bg-brand-white text-brand-blue hover:bg-brand-cyan-light",
  // Cyan with dark text, for the most prominent placements
  cyan: "bg-brand-cyan text-brand-slate hover:bg-brand-cyan-light",
  // Blue on white sections
  blue: "bg-brand-blue text-brand-white hover:bg-brand-blue-dark",
};

export function CallButton({
  variant = "cyan",
  label = "Call",
  className = "",
}: {
  variant?: keyof typeof variants;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={BUSINESS_PHONE.href}
      className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl px-6 py-3 text-xl font-bold shadow-md transition-colors ${variants[variant]} ${className}`}
    >
      <PhoneIcon />
      <span>
        {label} <span className="whitespace-nowrap">{BUSINESS_PHONE.display}</span>
      </span>
    </a>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-7 shrink-0"
      fill="currentColor"
    >
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
    </svg>
  );
}
