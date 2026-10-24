import Image from "next/image";
import Link from "next/link";
import { BUSINESS_PHONE } from "@/lib/business";
import { EmailButton } from "./contact-button";

export function SiteHeader() {
  return (
    <header className="bg-brand-blue">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-lg">
          <Image
            src="/images/logo.svg"
            alt="Kaiyns home"
            width={670}
            height={268}
            priority
            className="h-16 w-auto sm:h-20"
          />
        </Link>
        {/* Hidden on phones, where the sticky bottom bar takes over */}
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <EmailButton variant="light" label="Email us:" />
          <a
            href={BUSINESS_PHONE.href}
            className="text-lg text-brand-white underline underline-offset-4"
          >
            or call <span className="whitespace-nowrap font-bold">{BUSINESS_PHONE.display}</span>
          </a>
        </div>
      </div>
    </header>
  );
}

// Always-visible contact bar pinned to the bottom of small screens.
export function MobileContactBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-brand-blue-dark bg-brand-blue px-4 pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] text-center text-brand-white sm:hidden">
      <EmailButton variant="light" label="" className="w-full" />
      <a href={BUSINESS_PHONE.href} className="mt-1 inline-block text-lg underline underline-offset-4">
        or call <span className="whitespace-nowrap font-bold">{BUSINESS_PHONE.display}</span>
      </a>
    </div>
  );
}
