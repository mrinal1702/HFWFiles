"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGIN = 12;
const WIDTH = 288;
const WIDE = 384;

/**
 * Small "i" icon with an explanation bubble.
 * Laptop/desktop: opens on hover (and click pins it). Phone/tablet: tap to open, tap anywhere to close.
 * The bubble is portalled to <body> so table scroll areas and the mobile zoom wrapper never clip it.
 */
export function InfoTip({
  text,
  label = "More info",
  wide = false,
}: {
  text: string;
  label?: string;
  /** Wider bubble for long, multi-line help. */
  wide?: boolean;
}) {
  const maxWidth = wide ? WIDE : WIDTH;
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const open = hovered || pinned;

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const width = Math.min(maxWidth, vw - MARGIN * 2);
    const left = Math.min(Math.max(b.left + b.width / 2 - width / 2, MARGIN), vw - width - MARGIN);
    const room = wide ? 320 : 160;
    const above = b.bottom + room > window.innerHeight && b.top > room;
    setPos({ top: above ? b.top - 8 : b.bottom + 8, left, above });
  }, [maxWidth, wide]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          place();
          setPinned((p) => !p);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          place();
          setHovered(true);
        }}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sky-500 transition hover:bg-sky-100 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3.25a.75.75 0 0 0 1.5 0V9.75A.75.75 0 0 0 10 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: Math.min(maxWidth, window.innerWidth - MARGIN * 2),
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
            className="z-50 whitespace-pre-line rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 text-[13px] font-normal normal-case leading-relaxed tracking-normal text-slate-700 shadow-lg shadow-sky-100"
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
