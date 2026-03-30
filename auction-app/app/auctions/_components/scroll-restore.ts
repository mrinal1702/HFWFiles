"use client";

import { lotRowAnchorId } from "@/lib/lot-row-anchor";

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

/**
 * After a successful bid, revalidatePath refreshes the tree without changing the URL, so we must
 * restore here (not in a layout effect keyed only on pathname).
 * Prefer scrolling the bid row into view so default sort reorder does not strand the viewport.
 */
export function restoreScrollAfterBid(playerId: string): void {
  const y = consumeSavedScrollForCurrentLocation();
  const anchorId = lotRowAnchorId(playerId);
  let attempts = 0;
  const maxAttempts = 48;

  const tick = () => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      requestAnimationFrame(tick);
    } else if (y != null) {
      window.scrollTo({ top: Math.max(0, y), left: 0, behavior: "auto" });
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(tick);
  });
}

