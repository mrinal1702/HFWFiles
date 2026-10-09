import Link from "next/link";

import { InfoTip } from "@/app/_components/InfoTip";
import { CopyCodeButton } from "@/app/_components/lobby/CopyCodeButton";
import { LobbyMembers } from "@/app/_components/lobby/LobbyMembers";
import { STARTING_BUDGET } from "@/lib/auction-create";
import type { AuctionLobby } from "@/lib/auction-lobby";

const WAITING_HELP =
  `Bidding hasn't started yet. When your commissioner presses Start Bidding, this page becomes the ` +
  `bidding room and the deadlines appear. Every manager starts with ${STARTING_BUDGET}m.`;

/** Shown in place of every in-auction page while the auction is still in the lobby. */
export function ParticipantLobby({ lobby, viewerUserId }: { lobby: AuctionLobby; viewerUserId: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-sky-900 to-sky-700 px-4 py-4 shadow-lg shadow-sky-900/20 sm:px-6 sm:py-5">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-sky-400/25 blur-3xl" />
        <h1 className="relative min-w-0 text-xl font-bold tracking-tight text-white sm:text-3xl">{lobby.name}</h1>
        <Link
          href="/dashboard"
          className="relative inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
        >
          Dashboard
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-5 pl-6 shadow-sm sm:p-6 sm:pl-7">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600" />
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Lobby</p>
        <p className="mt-1 font-display text-xl font-semibold text-slate-900">
          Waiting for {lobby.adminName} to start bidding{" "}
          <span className="inline-block align-middle">
            <InfoTip text={WAITING_HELP} label="What happens next" wide />
          </span>
        </p>
        <p className="mt-3 text-sm text-slate-700">
          New to HFW?{" "}
          <Link href="/rules" className="font-medium text-sky-700 underline hover:text-sky-900">
            Read the rules
          </Link>{" "}
          while you wait.
        </p>
      </section>

      {lobby.joinCode && (
        <section className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 pl-6 shadow-sm sm:p-6 sm:pl-7">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
          <p className="text-sm font-semibold text-slate-900">Invite friends</p>
          <div className="mt-3">
            <CopyCodeButton code={lobby.joinCode} />
          </div>
        </section>
      )}

      <LobbyMembers members={lobby.members} maxParticipants={lobby.maxParticipants} highlightUserId={viewerUserId} />
    </main>
  );
}
