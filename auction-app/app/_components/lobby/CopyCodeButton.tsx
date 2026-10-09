"use client";

import { useState } from "react";

/** Participant join code with a one-tap copy button. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 font-mono text-lg font-semibold tracking-wider text-slate-900">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className="min-h-9 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 transition hover:bg-sky-100"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </span>
  );
}
