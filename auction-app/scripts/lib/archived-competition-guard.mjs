/**
 * Read-only guard for commissioner write scripts: refuse to touch auctions or
 * gameweeks that belong to an archived competition (competitions.status = 'archived').
 *
 * Archived competitions stay readable by the app — this only stops scripts from
 * writing scores, locks or Best XI into them by mistake. Pass --allow-archived to a
 * script for a deliberate, commissioner-approved amendment.
 */

export const ALLOW_ARCHIVED_FLAG = "--allow-archived";

export function hasAllowArchivedFlag(argv = process.argv) {
  return argv.includes(ALLOW_ARCHIVED_FLAG);
}

async function loadArchivedCompetitions(supabase) {
  const { data, error } = await supabase
    .from("competitions")
    .select("id, slug")
    .eq("status", "archived");
  if (error) throw new Error(`archive guard: competitions: ${error.message}`);
  return new Map((data ?? []).map((c) => [Number(c.id), c.slug]));
}

function refuse(message) {
  throw new Error(
    `${message}\nArchived competitions are read-only. Re-run with ${ALLOW_ARCHIVED_FLAG} only for an approved amendment.`,
  );
}

/** Throws if any auction id belongs to an archived competition. */
export async function assertAuctionsNotArchived(supabase, auctionIds, { allowArchived = false } = {}) {
  if (allowArchived || !auctionIds?.length) return;
  const archived = await loadArchivedCompetitions(supabase);
  if (archived.size === 0) return;
  const { data, error } = await supabase
    .from("Auctions")
    .select("id, competition_id")
    .in("id", auctionIds);
  if (error) throw new Error(`archive guard: Auctions: ${error.message}`);
  const blocked = (data ?? []).filter((a) => archived.has(Number(a.competition_id)));
  if (blocked.length) {
    refuse(
      `Refusing: auction(s) ${blocked
        .map((a) => `${a.id} (${archived.get(Number(a.competition_id))})`)
        .join(", ")} belong to an archived competition.`,
    );
  }
}

/**
 * Throws if a legacy game_week_id belongs to an archived competition — i.e. an archived
 * competition's auction has locked squads for it, or (when given) the competition round
 * is in an archived competition.
 */
export async function assertGameWeekNotArchived(
  supabase,
  gameWeekId,
  { competitionRoundId = null, allowArchived = false } = {},
) {
  if (allowArchived) return;
  const archived = await loadArchivedCompetitions(supabase);
  if (archived.size === 0) return;

  if (competitionRoundId != null) {
    const { data, error } = await supabase
      .from("competition_rounds")
      .select("id, competition_id")
      .eq("id", competitionRoundId)
      .maybeSingle();
    if (error) throw new Error(`archive guard: competition_rounds: ${error.message}`);
    if (data && archived.has(Number(data.competition_id))) {
      refuse(
        `Refusing: competition round ${competitionRoundId} belongs to archived competition ${archived.get(
          Number(data.competition_id),
        )}.`,
      );
    }
  }

  const { data: auctions, error: aErr } = await supabase
    .from("Auctions")
    .select("id, competition_id")
    .in("competition_id", [...archived.keys()]);
  if (aErr) throw new Error(`archive guard: Auctions: ${aErr.message}`);
  const archivedAuctionIds = (auctions ?? []).map((a) => Number(a.id));
  if (!archivedAuctionIds.length) return;

  const { count, error: sErr } = await supabase
    .from("gameweek_squads")
    .select("auction_id", { count: "exact", head: true })
    .eq("game_week_id", gameWeekId)
    .in("auction_id", archivedAuctionIds);
  if (sErr) throw new Error(`archive guard: gameweek_squads: ${sErr.message}`);
  if ((count ?? 0) > 0) {
    refuse(
      `Refusing: game_week_id ${gameWeekId} is used by auctions in an archived competition (${[
        ...archived.values(),
      ].join(", ")}).`,
    );
  }
}
