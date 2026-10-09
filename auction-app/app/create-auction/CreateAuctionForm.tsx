"use client";

import { useActionState, useRef, useState } from "react";

import { InfoTip } from "@/app/_components/InfoTip";
import { AUCTION_NAME_MAX } from "@/lib/auction-create-constants";

import {
  checkAuctionNameAction,
  createAuctionAction,
  type CreateAuctionState,
  type NameCheckState,
} from "./actions";

const ROLES = [
  {
    value: "play_and_admin",
    title: "I want to play and admin this auction",
    detail: "You get a manager seat and the admin controls.",
  },
  {
    value: "admin_only",
    title: "I only want to admin the auction",
    detail: "You get the admin controls and the participant code. You can always join as a participant using the participant code.",
  },
] as const;

const FIRST_GW_HELP =
  "Your first scoring gameweek is set when you press Start Bidding in your admin page, not now. " +
  "New auctions need at least 5 days of bidding before a gameweek's first deadline, so a gameweek " +
  "that's too close is skipped. Your admin page will show the exact cutoff before you start.";

const card =
  "relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 pl-6 shadow-sm sm:p-6 sm:pl-7";
const stripe = "absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600";
const input =
  "min-h-12 w-full rounded-xl border bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm transition focus:bg-white focus:outline-none focus:ring-4";

type NameStatus = NameCheckState & { checking: boolean };

export function CreateAuctionForm({
  suggestedName,
  competitionName,
  firstGameweekIfStartedNow,
}: {
  suggestedName: string;
  competitionName: string;
  firstGameweekIfStartedNow: string;
}) {
  const [state, formAction, pending] = useActionState<CreateAuctionState, FormData>(createAuctionAction, null);
  const [name, setName] = useState(suggestedName);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("play_and_admin");
  // The server-computed suggestion is already known to be free.
  const [nameStatus, setNameStatus] = useState<NameStatus>({ available: true, message: null, checking: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  function onNameChange(next: string) {
    setName(next);
    setNameStatus((s) => ({ ...s, checking: true }));
    if (timer.current) clearTimeout(timer.current);
    const ticket = ++latest.current;
    timer.current = setTimeout(async () => {
      const res = await checkAuctionNameAction(next);
      if (ticket === latest.current) setNameStatus({ ...res, checking: false });
    }, 400);
  }

  const nameBlocked = nameStatus.checking || !nameStatus.available;
  const borderTone = nameStatus.checking
    ? "border-sky-200 focus:border-sky-500 focus:ring-sky-500/15"
    : nameStatus.available
      ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/15"
      : "border-red-300 focus:border-red-500 focus:ring-red-500/15";

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <section className={card}>
        <span aria-hidden className={stripe} />
        <label htmlFor="auction-name" className="text-sm font-semibold text-slate-900">
          Auction name
        </label>
        <input
          id="auction-name"
          name="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={AUCTION_NAME_MAX}
          autoComplete="off"
          className={`${input} ${borderTone} mt-2`}
          disabled={pending}
        />
        <p
          className={`mt-2 min-h-5 text-xs ${
            nameStatus.checking ? "text-slate-500" : nameStatus.available ? "text-emerald-700" : "text-red-700"
          }`}
          role="status"
        >
          {nameStatus.checking ? "Checking…" : nameStatus.available ? "✓ Name available" : nameStatus.message}
        </p>
      </section>

      <section className={card}>
        <span aria-hidden className={stripe} />
        <p className="text-sm font-semibold text-slate-900">Your role</p>
        <div className="mt-3 space-y-3">
          {ROLES.map((r) => {
            const checked = role === r.value;
            return (
              <label
                key={r.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  checked ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20" : "border-slate-200 bg-white hover:bg-sky-50/50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={checked}
                  onChange={() => setRole(r.value)}
                  className="mt-1 h-4 w-4 accent-sky-600"
                  disabled={pending}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{r.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{r.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className={card}>
        <span aria-hidden className={stripe} />
        <p className="text-sm font-semibold text-slate-900">Competition</p>
        <p className="mt-2 text-sm text-slate-700">{competitionName}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          If you started bidding right now, your first gameweek would be{" "}
          <strong className="whitespace-nowrap text-slate-900">{firstGameweekIfStartedNow}</strong>{" "}
          <span className="inline-block align-middle">
            <InfoTip text={FIRST_GW_HELP} label="How the first gameweek is chosen" wide />
          </span>
        </p>
      </section>

      {state?.ok === false && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || nameBlocked}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-3 text-base font-semibold text-white shadow-md shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:max-w-xs"
      >
        {pending ? "Creating…" : "Create auction"}
      </button>
    </form>
  );
}
