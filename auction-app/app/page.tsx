import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { HowItWorksCarousel, type HowItWorksStep } from "@/app/_components/HowItWorksCarousel";
import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

const primaryButton =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-5 py-3 text-base font-semibold text-white shadow-md shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-lg";
const secondaryButton =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-sky-200 bg-white px-5 py-3 text-base font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-sky-50";

/** How the game works — auto-sliding carousel on every screen size. */
const STEPS: HowItWorksStep[] = [
  {
    step: "Step 1",
    title: "Bid",
    text: "Bid against each other to build a squad of 18. Find the steals your friends haven't heard of and snap them up cheap. Unlike FPL, a player's price is set by you and your mates.",
    icon: "🔨",
    stripe: "from-sky-400 to-sky-600",
    iconTone: "bg-sky-100 ring-sky-200",
    stepTone: "text-sky-700",
  },
  {
    step: "Step 2",
    title: "Construct a team",
    text: "Can you manage your budget, value players properly, avoid overpaying for the stars and build the best-performing squad of 18? If you only know players like Mbappé, Haaland and Yamal, this fantasy isn't for you!",
    icon: "📋",
    stripe: "from-amber-400 to-amber-600",
    iconTone: "bg-amber-100 ring-amber-200",
    stepTone: "text-amber-700",
  },
  {
    step: "Step 3",
    title: "Score",
    text: "The scoring is what makes this nothing like the fantasy football you know. On top of goals, assists and clean sheets, players score for tackles, interceptions, passes completed, key passes, passes into the final third, aerial duels and much more — so your best players could be anywhere on the pitch.",
    icon: "⚽",
    stripe: "from-emerald-400 to-emerald-600",
    iconTone: "bg-emerald-100 ring-emerald-200",
    stepTone: "text-emerald-700",
  },
];

export default async function Home() {
  const user = await getAuthUser();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 sm:max-w-2xl lg:max-w-4xl sm:px-6 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-900 to-sky-700 px-5 py-8 text-center shadow-lg shadow-sky-900/20 sm:px-8 sm:py-10">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-400/20 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-2xl"
        />
        <div className="relative mx-auto h-36 w-36 overflow-hidden rounded-3xl bg-white shadow-xl ring-4 ring-white/20 sm:h-44 sm:w-44">
          <Image
            src="/hfw-auction-logo.png"
            alt="HFW Auction logo"
            width={768}
            height={768}
            priority
            className="h-full w-full scale-110 object-cover"
          />
        </div>
        <h1 className="relative mt-6 font-display text-4xl font-semibold uppercase tracking-wide text-white sm:text-5xl">
          HFW Fantasy Auction
        </h1>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-sky-100 sm:text-base">
          Think you and your mates know ball? Bid against each other and score points in this
          ultra-realistic fantasy football game.
        </p>
      </section>

      <HowItWorksCarousel steps={STEPS} />

      <section className="relative mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 p-5 pl-6 shadow-sm sm:p-6 sm:pl-7">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        {user ? (
          <Cta title="Welcome back" subtitle="Your auctions are waiting on the dashboard.">
            <Link href="/dashboard" className={primaryButton}>
              Go to Active Auctions
            </Link>
          </Cta>
        ) : (
          <Cta
            title={
              <>
                Get in the game <span className="text-emerald-600">– it&apos;s completely free</span>
              </>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/signup" className={primaryButton}>
                Sign up
              </Link>
              <Link href="/login" className={secondaryButton}>
                Log in
              </Link>
            </div>
          </Cta>
        )}
      </section>

      <p className="mt-6 text-center">
        <Link
          href="/rules"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-white"
        >
          📖 Read the rules
        </Link>
      </p>
    </main>
  );
}

function Cta({ title, subtitle, children }: { title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <>
      <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </>
  );
}
