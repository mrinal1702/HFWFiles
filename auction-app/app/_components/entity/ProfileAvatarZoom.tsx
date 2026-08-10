"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";

import { Avatar } from "@/app/_components/entity/Avatar";

type Props = {
  name: string;
  avatarUrl: string | null;
};

/** Large avatar; click opens a simple lightbox zoom when a photo exists. */
export function ProfileAvatarZoom({ name, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const shown = avatarUrl?.trim() || null;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!shown) {
    return <Avatar name={name} avatarUrl={null} size="lg" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge ${name}'s profile picture`}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      >
        <Avatar name={name} avatarUrl={shown} size="lg" className="cursor-zoom-in" />
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">Tap photo to enlarge</p>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-slate-900 shadow"
          >
            Close
          </button>
          <h2 id={titleId} className="sr-only">
            {name} profile picture
          </h2>
          <div
            className="relative max-h-[min(90vh,36rem)] max-w-[min(90vw,36rem)] overflow-hidden rounded-2xl bg-slate-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={shown}
              alt={`${name}'s profile picture`}
              width={576}
              height={576}
              unoptimized
              className="h-auto max-h-[min(90vh,36rem)] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
