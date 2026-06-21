"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import { FANTASY_TEAM_NAME_MAX_LENGTH } from "@/lib/team-name";
import { createAdminClient } from "@/lib/supabase-server";

export type UpdateFantasyTeamNameState =
  | { ok: true; teamName: string | null; displayLabel: string }
  | { ok: false; message: string };

export async function updateFantasyTeamNameAction(
  auctionId: number,
  teamNameRaw: string,
): Promise<UpdateFantasyTeamNameState> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, message: "You must be logged in." };
  }

  const trimmed = teamNameRaw.trim();
  const teamName = trimmed.length > 0 ? trimmed : null;

  if (teamName && teamName.length > FANTASY_TEAM_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Team name must be ${FANTASY_TEAM_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("auction_users")
    .select("id, name")
    .eq("auction_id", auctionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, message: fetchErr.message };
  }
  if (!row) {
    return { ok: false, message: "You are not a member of this auction." };
  }

  const { error: updErr } = await admin
    .from("auction_users")
    .update({ team_name: teamName })
    .eq("id", row.id);

  if (updErr) {
    return { ok: false, message: updErr.message };
  }

  const participantName = (row as { name: string | null }).name?.trim() || "—";
  const displayLabel = teamName ?? participantName;

  revalidatePath(`/auctions/${auctionId}`, "layout");
  revalidatePath(`/leaderboard/${auctionId}`);

  return { ok: true, teamName, displayLabel };
}
