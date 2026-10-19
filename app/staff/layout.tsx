import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staff | Kaiyns",
  robots: { index: false },
};

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <>
      <header className="bg-brand-blue">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/staff" className="rounded-lg">
            <Image src="/images/logo.svg" alt="Kaiyns staff home" width={670} height={268} className="h-12 w-auto" />
          </Link>
          <span className="rounded-full bg-brand-cyan px-3 py-1 text-lg font-bold text-brand-slate">Staff</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  );
}
