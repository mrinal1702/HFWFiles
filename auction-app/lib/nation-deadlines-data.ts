import { createAdminClient } from "@/lib/supabase-server";

export type NationDeadlineRow = {
  teamName: string;
  kickoffAt: string;
  raiseDeadlineAt: string;
  hardDeadlineAt: string;
};

/** Per-nation raise/hard schedule for nation_rolling auctions. */
export async function loadNationDeadlinesForAuction(
  auctionId: number,
): Promise<NationDeadlineRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auction_nation_deadlines")
    .select("team_name, kickoff_at, raise_deadline_at, hard_deadline_at")
    .eq("auction_id", auctionId);

  if (error) throw new Error(`auction_nation_deadlines: ${error.message}`);

  const rows = (data ?? []).map((row) => ({
    teamName: String(row.team_name),
    kickoffAt: String(row.kickoff_at),
    raiseDeadlineAt: String(row.raise_deadline_at),
    hardDeadlineAt: String(row.hard_deadline_at),
  }));

  rows.sort((a, b) => {
    const ha = Date.parse(a.hardDeadlineAt);
    const hb = Date.parse(b.hardDeadlineAt);
    if (ha !== hb) return ha - hb;
    return a.teamName.localeCompare(b.teamName);
  });

  return rows;
}
