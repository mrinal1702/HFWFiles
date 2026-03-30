"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { consumeSavedScrollForCurrentLocation } from "./scroll-restore";

export function ScrollRestoreOnRefresh() {
  const pathname = usePathname();
  const sp = useSearchParams();

  useLayoutEffect(() => {
    const savedY = consumeSavedScrollForCurrentLocation();
    if (savedY == null) return;

    // Two frames gives the browser time to paint refreshed content and sticky bars.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, savedY), left: 0, behavior: "auto" });
      });
    });
  }, [pathname, sp]);

  return null;
}

