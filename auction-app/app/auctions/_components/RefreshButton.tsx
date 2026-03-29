"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
      className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-sky-50 disabled:opacity-50 sm:min-h-9 sm:py-1.5"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
