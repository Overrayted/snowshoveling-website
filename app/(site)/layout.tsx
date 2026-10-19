import { SiteFooter } from "@/components/site-footer";
import { MobileCallBar, SiteHeader } from "@/components/site-header";

// Customer-facing pages. Staff pages live under app/staff with their own layout.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* Bottom padding leaves room for the sticky call bar on phones */}
      <main id="main" className="flex-1 pb-32 sm:pb-0">
        {children}
      </main>
      <SiteFooter />
      <MobileCallBar />
    </>
  );
}
