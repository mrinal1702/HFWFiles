/**
 * Which auctions a gameweek step acts on — discovered from Supabase, never hand-listed.
 *
 * An auction plays round N when it belongs to the competition, bidding has started
 * (Auctions.status = 'bidding') and its first gameweek is round N or earlier.
 * Self-serve auctions record their first gameweek (start_round_id) at Start Bidding.
 * Auctions created before self-serve have no start_round_id and count as starting at
 * round 1 (UCL 2026/27 auctions 10–13 all locked MW1).
 *
 * First-gameweek budget boost: when round N opens, an auction whose first gameweek was
 * N−1 gets +FIRST_GAMEWEEK_BOOST (10–13 got theirs when MW2 opened).
 */

export const LEGACY_START_ROUND = 1;
export const FIRST_GAMEWEEK_BOOST = 100;

/** Every started auction in the competition, each with `start_round_number`. */
export async function loadCompetitionAuctions(sb, competitionId) {
  const { data: auctions, error } = await sb
    .from("Auctions")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "bidding")
    .order("id");
  if (error) throw new Error(`Auctions: ${error.message}`);

  const roundIds = [...new Set(auctions.map((a) => a.start_round_id).filter((id) => id != null))];
  const roundNumberById = new Map();
  if (roundIds.length) {
    const { data: rounds, error: rErr } = await sb
      .from("competition_rounds")
      .select("id, competition_id, round_number")
      .in("id", roundIds);
    if (rErr) throw new Error(`competition_rounds: ${rErr.message}`);
    for (const r of rounds) {
      if (Number(r.competition_id) !== Number(competitionId)) {
        throw new Error(`start round ${r.id} belongs to competition ${r.competition_id}, not ${competitionId}`);
      }
      roundNumberById.set(r.id, Number(r.round_number));
    }
  }

  return auctions.map((a) => {
    if (a.start_round_id != null && !roundNumberById.has(a.start_round_id)) {
      throw new Error(`auction ${a.id}: start round ${a.start_round_id} not found`);
    }
    return {
      ...a,
      start_round_number: a.start_round_id == null ? LEGACY_START_ROUND : roundNumberById.get(a.start_round_id),
    };
  });
}

/** Auctions that play round `roundNumber` (first gameweek on or before it). */
export function auctionsPlayingRound(auctions, roundNumber) {
  return auctions.filter((a) => a.start_round_number <= roundNumber);
}

/**
 * What `open` does for one auction in round N:
 *  - startedHere: its first gameweek is N — Start Bidding already opened this window → skip.
 *  - otherwise open, with the first-gameweek boost when its first gameweek was N−1.
 */
export function openPlanFor(auction, roundNumber) {
  if (auction.start_round_number === roundNumber) return { action: "started_here", boost: 0 };
  if (auction.start_round_number > roundNumber) return { action: "not_playing", boost: 0 };
  return {
    action: "open",
    boost: auction.start_round_number === roundNumber - 1 ? FIRST_GAMEWEEK_BOOST : 0,
  };
}
