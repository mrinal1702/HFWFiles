import "server-only";

import { createAdminClient } from "@/lib/supabase-server";

/**
 * Which gameweek does a self-created auction start at if bidding begins now?
 *
 * Reads the round schedule recorded in competition_rounds (scripts/record-competition-schedule.mjs).
 * Product rules (HFW Self-Sufficiency, Oct 2026):
 *  - The first gameweek is the earliest recorded round whose initiation deadline is at least
 *    MIN_LEAD_HOURS away — anything closer leaves too little time to build a squad.
 *  - Starting is blocked unless at least MIN_FUTURE_ROUNDS future rounds are recorded
 *    (failsafe for when the owner hasn't recorded the schedule far enough ahead).
 */

export const MIN_LEAD_HOURS = 120;
export const MIN_FUTURE_ROUNDS = 2;

const HOUR_MS = 60 * 60 * 1000;

export type ScheduledRound = {
  id: number;
  roundSlug: string;
  roundNumber: number;
  displayName: string;
  legacyGameWeekId: number;
  initiationDeadlineAt: string;
  raiseDeadlineAt: string;
  hardDeadlineAt: string;
  firstKickoffAt: string;
};

export type StartGameweekBlockReason = "not_enough_schedule" | "no_round_far_enough";

export type StartGameweekOutcome =
  | {
      ok: true;
      /** The auction's first scoring gameweek. */
      target: ScheduledRound;
      /** Hours from now until the target's initiation deadline (last moment to open new players). */
      hoursUntilInitiation: number;
      /** Future rounds skipped because their initiation deadline is under MIN_LEAD_HOURS away. */
      tooClose: { round: ScheduledRound; hoursUntilInitiation: number }[];
      /** After this instant, starting would no longer get `target` (target.initiation − MIN_LEAD_HOURS). */
      cutoffAt: string;
      futureRoundCount: number;
    }
  | {
      ok: false;
      reason: StartGameweekBlockReason;
      message: string;
      futureRoundCount: number;
    };

export type StartGameweekPreview = {
  now: string;
  /** What happens if bidding starts at `now`. */
  outcome: StartGameweekOutcome;
  /** What happens if bidding starts just after the cutoff (null when blocked now). */
  ifStartedAfterCutoff: StartGameweekOutcome | null;
};

/** "11 days 16 hours" / "4 hours 20 minutes" — coarse, for lobby copy. */
export function formatLeadTime(hours: number): string {
  const totalMin = Math.max(0, Math.floor(hours * 60));
  const d = Math.floor(totalMin / (24 * 60));
  const h = Math.floor((totalMin % (24 * 60)) / 60);
  const m = totalMin % 60;
  const unit = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  return d > 0 ? `${unit(d, "day")} ${unit(h, "hour")}` : `${unit(h, "hour")} ${unit(m, "minute")}`;
}

/** Pure decision: no I/O, so any date can be tested. `rounds` must have full schedules. */
export function decideStartGameweek(rounds: ScheduledRound[], nowMs: number): StartGameweekOutcome {
  const future = rounds
    .filter((r) => Date.parse(r.initiationDeadlineAt) > nowMs)
    .sort((a, b) => Date.parse(a.initiationDeadlineAt) - Date.parse(b.initiationDeadlineAt));

  if (future.length < MIN_FUTURE_ROUNDS) {
    return {
      ok: false,
      reason: "not_enough_schedule",
      message:
        "New auctions can't start right now — upcoming gameweek dates haven't been published yet. Please check back soon.",
      futureRoundCount: future.length,
    };
  }

  const hoursUntil = (r: ScheduledRound) => (Date.parse(r.initiationDeadlineAt) - nowMs) / HOUR_MS;
  const targetIndex = future.findIndex((r) => hoursUntil(r) >= MIN_LEAD_HOURS);

  if (targetIndex === -1) {
    return {
      ok: false,
      reason: "no_round_far_enough",
      message:
        "Every published gameweek is too close to give a new auction enough bidding time. Please check back once later gameweeks are published.",
      futureRoundCount: future.length,
    };
  }

  const target = future[targetIndex];
  return {
    ok: true,
    target,
    hoursUntilInitiation: hoursUntil(target),
    tooClose: future.slice(0, targetIndex).map((round) => ({ round, hoursUntilInitiation: hoursUntil(round) })),
    cutoffAt: new Date(Date.parse(target.initiationDeadlineAt) - MIN_LEAD_HOURS * HOUR_MS).toISOString(),
    futureRoundCount: future.length,
  };
}

/** Outcome now, plus what starting one minute after the cutoff would give (for the lobby warning). */
export function previewStartGameweek(rounds: ScheduledRound[], nowMs: number): StartGameweekPreview {
  const outcome = decideStartGameweek(rounds, nowMs);
  const ifStartedAfterCutoff = outcome.ok
    ? decideStartGameweek(rounds, Date.parse(outcome.cutoffAt) + 60 * 1000)
    : null;
  return { now: new Date(nowMs).toISOString(), outcome, ifStartedAfterCutoff };
}

/** Rounds of a competition that have a complete recorded schedule, in order. */
export async function loadScheduledRounds(competitionId: number): Promise<ScheduledRound[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("competition_rounds")
    .select(
      "id, round_slug, round_number, display_name, legacy_game_week_id, initiation_deadline_at, raise_deadline_at, hard_deadline_at, first_kickoff_at",
    )
    .eq("competition_id", competitionId)
    .not("initiation_deadline_at", "is", null)
    .not("raise_deadline_at", "is", null)
    .not("hard_deadline_at", "is", null)
    .not("first_kickoff_at", "is", null)
    .not("legacy_game_week_id", "is", null)
    .order("initiation_deadline_at", { ascending: true });
  if (error) throw new Error(`competition_rounds: ${error.message}`);

  type Row = {
    id: number;
    round_slug: string;
    round_number: number | null;
    display_name: string | null;
    legacy_game_week_id: number;
    initiation_deadline_at: string;
    raise_deadline_at: string;
    hard_deadline_at: string;
    first_kickoff_at: string;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: Number(r.id),
    roundSlug: r.round_slug,
    roundNumber: Number(r.round_number ?? 0),
    displayName: r.display_name ?? r.round_slug,
    legacyGameWeekId: Number(r.legacy_game_week_id),
    initiationDeadlineAt: r.initiation_deadline_at,
    raiseDeadlineAt: r.raise_deadline_at,
    hardDeadlineAt: r.hard_deadline_at,
    firstKickoffAt: r.first_kickoff_at,
  }));
}

/** Convenience: load the schedule and preview starting at `nowMs` (defaults to the real now). */
export async function loadStartGameweekPreview(
  competitionId: number,
  nowMs: number = Date.now(),
): Promise<StartGameweekPreview & { rounds: ScheduledRound[] }> {
  const rounds = await loadScheduledRounds(competitionId);
  return { ...previewStartGameweek(rounds, nowMs), rounds };
}
