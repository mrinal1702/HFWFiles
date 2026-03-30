"use client";

const SCROLL_KEY_PREFIX = "hfw:scroll-restore:";
const MAX_AGE_MS = 5 * 60 * 1000;

function keyForCurrentLocation(): string {
  return `${SCROLL_KEY_PREFIX}${window.location.pathname}${window.location.search}`;
}

/** Save current scroll so the next refresh/re-render can restore it. */
export function saveScrollForCurrentLocation(): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ y: window.scrollY, t: Date.now() });
  window.sessionStorage.setItem(keyForCurrentLocation(), payload);
}

/** Read + consume saved scroll for current location, if still fresh. */
export function consumeSavedScrollForCurrentLocation(): number | null {
  if (typeof window === "undefined") return null;
  const key = keyForCurrentLocation();
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  window.sessionStorage.removeItem(key);
  try {
    const parsed = JSON.parse(raw) as { y?: unknown; t?: unknown };
    const y = typeof parsed.y === "number" ? parsed.y : null;
    const t = typeof parsed.t === "number" ? parsed.t : 0;
    if (y == null) return null;
    if (Date.now() - t > MAX_AGE_MS) return null;
    return y;
  } catch {
    return null;
  }
}

