import { BUSINESS_EMAIL, BUSINESS_PHONE } from "@/lib/business";

export function SiteFooter() {
  return (
    <footer className="bg-brand-slate text-brand-white">
      <div className="mx-auto max-w-6xl px-4 py-10 text-lg sm:px-6">
        <p className="font-bold">Kaiyns Snow Shovelling</p>
        <p className="mt-2 text-xl">
          Email:{" "}
          <a href={BUSINESS_EMAIL.href} className="font-bold underline underline-offset-4">
            {BUSINESS_EMAIL.address}
          </a>
        </p>
        <p className="mt-1 text-base">
          Phone:{" "}
          <a href={BUSINESS_PHONE.href} className="underline underline-offset-4">
            {BUSINESS_PHONE.display}
          </a>
        </p>
        <p className="mt-2">A small, student-run business. No HST charged.</p>
      </div>
    </footer>
  );
}
