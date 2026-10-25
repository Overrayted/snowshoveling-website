"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Reloads the visit list in the background, so a customer's YES reply shows
// up without staff refreshing the page. Pauses while the tab is hidden.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);

  return null;
}
