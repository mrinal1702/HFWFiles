"use client";

/**
 * Renders a UTC ISO timestamp in the viewer's local timezone.
 * suppressHydrationWarning is required because the server (Vercel, UTC)
 * and the client (user's device timezone) produce different strings —
 * we always want the client's local time to win.
 */
export function LocalTime({ iso }: { iso: string | null }) {
  if (!iso) return <span>—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span>{iso}</span>;
  const formatted = d.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  // suppressHydrationWarning tells React to trust the client value here
  return <span suppressHydrationWarning>{formatted}</span>;
}
