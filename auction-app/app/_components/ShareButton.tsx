"use client";

import { useState } from "react";

/**
 * Small "Share" button (Project Socialize H-1). On phones it opens the native share sheet
 * (WhatsApp, Messages, …); elsewhere it opens WhatsApp with the message pre-filled.
 * The link preview card comes from the page's opengraph-image. HFW never sees a phone number.
 */
export function ShareButton({
  path,
  title,
  text,
  label = "Share",
  className = "",
}: {
  /** Site-relative path to share, e.g. `/auctions/11/leaderboard`. */
  path: string;
  title: string;
  /** Message placed before the link. */
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // User closed the share sheet — nothing to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    // Desktop / no share sheet: WhatsApp (web or app) with the message pre-filled.
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    const opened = window.open(wa, "_blank", "noopener,noreferrer");
    if (!opened) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* nothing else we can do */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 active:scale-[0.98] ${className}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? "Link copied" : label}
    </button>
  );
}
