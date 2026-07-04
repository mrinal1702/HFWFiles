"use client";

import { useEffect, useState } from "react";

/**
 * Renders a UTC ISO timestamp in the viewer's local timezone.
 *
 * Formatting is deferred to a useEffect so it only ever runs in the browser,
 * guaranteeing the device's own timezone is used. The server always renders a
 * neutral "—" placeholder, which the client also renders during hydration
 * (no mismatch), then immediately replaces with the correct local time once
 * the effect fires.
 */
export function LocalTime({ iso }: { iso: string | null }) {
  const [localStr, setLocalStr] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      setLocalStr(iso);
      return;
    }
    setLocalStr(
      d.toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    );
  }, [iso]);

  if (!iso) return <span>—</span>;
  if (localStr === null) return <span>—</span>;
  return <span>{localStr}</span>;
}
