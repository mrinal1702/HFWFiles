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
      className="group inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 sm:min-h-9 sm:py-1.5"
    >
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-4 w-4 text-sky-500 transition group-hover:rotate-90 ${pending ? "animate-spin" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M15.31 4.69a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.8A5.5 5.5 0 1 0 15.5 10a.75.75 0 0 1 1.5 0 7 7 0 1 1-2.44-5.31V5.44a.75.75 0 0 1 .75-.75Z"
          clipRule="evenodd"
        />
      </svg>
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
