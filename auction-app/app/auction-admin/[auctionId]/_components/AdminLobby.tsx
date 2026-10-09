import { InfoTip } from "@/app/_components/InfoTip";
import { CopyCodeButton } from "@/app/_components/lobby/CopyCodeButton";
import { LobbyMembers } from "@/app/_components/lobby/LobbyMembers";
import { LocalTime } from "@/app/auctions/_components/LocalTime";
import type { AuctionLobby } from "@/lib/auction-lobby";
import { formatLeadTime, type StartGameweekPreview } from "@/lib/auction-state/start-gameweek";

import { StartBiddingButton } from "./StartBiddingButton";

const START_HELP =
  "Your first scoring gameweek is the earliest one at least 5 days away when you press Start Bidding, " +
  "so everyone has time to build a squad. Squads, bids and the admin tools unlock once bidding starts.";

const card = "relative overflow-hidden rounded-2xl border bg-white p-5 pl-6 shadow-sm sm:p-6 sm:pl-7";

/** Admin view while the auction is in the lobby: share the code, watch people join, start bidding. */
export function AdminLobby({
  lobby,
  adminIsSeated,
  preview,
}: {
  lobby: AuctionLobby;
  adminIsSeated: boolean;
  preview: StartGameweekPreview;
}) {
  const { outcome, ifStartedAfterCutoff } = preview;

  return (
    <div className="space-y-5">
      <section className={`${card} border-sky-100`}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <p className="text-sm font-semibold text-slate-900">Participant code</p>
        <div className="mt-3">{lobby.joinCode ? <CopyCodeButton code={lobby.joinCode} /> : "—"}</div>
        <p className="mt-3 text-sm text-slate-700">Share it with your friends — they join from their dashboard.</p>
        {!adminIsSeated && (
          <p className="mt-1 text-sm text-slate-700">You can always join as a participant using the participant code.</p>
        )}
      </section>

      <section className={`${card} border-amber-200`}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600" />
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          Start bidding
          <InfoTip text={START_HELP} label="How Start Bidding works" wide />
        </p>
        {outcome.ok ? (
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>
              If you start now, your first gameweek is{" "}
              <strong className="text-slate-900">{outcome.target.displayName}</strong>, with{" "}
              <strong className="text-slate-900">{formatLeadTime(outcome.hoursUntilInitiation)}</strong> to open bids
              on new players.
            </li>
            <li>
              Start before <strong className="text-slate-900"><LocalTime iso={outcome.cutoffAt} /></strong> to keep{" "}
              {outcome.target.displayName}
              {ifStartedAfterCutoff?.ok
                ? ` — after that your first gameweek becomes ${ifStartedAfterCutoff.target.displayName}.`
                : "."}
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-amber-900">{outcome.message}</p>
        )}
        {outcome.ok && (
          <StartBiddingButton
            auctionId={lobby.auctionId}
            roundId={outcome.target.id}
            roundName={outcome.target.displayName}
          />
        )}
      </section>

      <LobbyMembers members={lobby.members} maxParticipants={lobby.maxParticipants} />
    </div>
  );
}
