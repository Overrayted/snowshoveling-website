import Image from "next/image";
import Link from "next/link";
import { CallButton } from "./call-button";

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
        <div className="hidden sm:block">
          <CallButton variant="cyan" label="Call us:" />
        </div>
      </div>
    </header>
  );
}

// Always-visible call button pinned to the bottom of small screens.
export function MobileCallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-brand-blue-dark bg-brand-blue px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:hidden">
      <CallButton variant="cyan" label="Call" className="w-full" />
    </div>
  );
}
