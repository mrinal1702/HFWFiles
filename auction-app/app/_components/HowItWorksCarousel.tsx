"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HowItWorksStep = {
  step: string;
  title: string;
  text: string;
  icon: string;
  stripe: string;
  iconTone: string;
  stepTone: string;
};

const AUTO_SLIDE_MS = 10_000;
/** Pause auto-slide this long after the viewer swipes or taps a dot. */
const PAUSE_AFTER_TOUCH_MS = 20_000;

/**
 * Landing-page "how it works" cards.
 * One card at a time on every screen: swipe (phone) or arrows (laptop), dots, auto-advance every 10s.
 * Auto-advance pauses after the viewer interacts, and while the mouse is over a card.
 */
export function HowItWorksCarousel({ steps }: { steps: HowItWorksStep[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);
  const hovered = useRef(false);
  /** Card we're sliding to; scroll events mid-animation don't override it. */
  const target = useRef(0);
  const animatingUntil = useRef(0);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    target.current = i;
    animatingUntil.current = Date.now() + 700;
    setActive(i);
    const card = track.children[i] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  // Keep the dots in sync with whichever card is in view.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      if (Date.now() < animatingUntil.current) return;
      const i = Math.min(steps.length - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      target.current = i;
      setActive(i);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [steps.length]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (hovered.current || Date.now() < pausedUntil.current || document.hidden) return;
      goTo((target.current + 1) % steps.length);
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(id);
  }, [goTo, steps.length]);

  const pause = () => {
    pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
  };

  const step = (delta: number) => {
    pause();
    goTo((target.current + delta + steps.length) % steps.length);
  };

  return (
    <div
      className="relative mt-6"
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <ul
        ref={trackRef}
        onTouchStart={pause}
        onPointerDown={pause}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="How it works"
      >
        {steps.map((s) => (
          <li
            key={s.title}
            className="relative flex w-full shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br from-white to-slate-50 p-5 pl-6 shadow-sm sm:p-7 sm:pl-8"
          >
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${s.stripe}`} />
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ring-1 ${s.iconTone}`}
              >
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className={`block text-[11px] font-semibold uppercase tracking-wider ${s.stepTone}`}>
                  {s.step}
                </span>
                <span className="block font-display text-xl font-semibold uppercase leading-tight tracking-wide text-slate-900">
                  {s.title}
                </span>
              </span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700 sm:text-base">{s.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-center gap-2">
        <ArrowButton dir="prev" onClick={() => step(-1)} />
        {steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Show ${s.title}`}
            aria-current={i === active}
            onClick={() => {
              pause();
              goTo(i);
            }}
            className={`h-2.5 rounded-full transition-all ${
              i === active ? "w-6 bg-white shadow" : "w-2.5 bg-white/50"
            }`}
          />
        ))}
        <ArrowButton dir="next" onClick={() => step(1)} />
      </div>
    </div>
  );
}

function ArrowButton({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous card" : "Next card"}
      className="mx-1 hidden h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg font-semibold text-sky-800 shadow-sm transition hover:bg-white sm:inline-flex"
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}
