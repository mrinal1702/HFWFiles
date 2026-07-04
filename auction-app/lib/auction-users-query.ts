import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuctionUserRow } from "@/lib/auction-types";
import { isUserRelegated } from "@/lib/relegated-participants";

const BASE_SELECT =
  "id,name,budget_remaining,active_budget,paid_release_used,user_id";
const FULL_SELECT = `${BASE_SELECT},team_name,is_relegated`;
const FULL_SELECT_NO_RELEGATED = `${BASE_SELECT},team_name`;

function normalizeRow(row: Record<string, unknown>, auctionId: number): AuctionUserRow {
  const id = row.id as number;
  const dbRelegated =
    row.is_relegated === undefined || row.is_relegated === null
      ? null
      : Boolean(row.is_relegated);
  return {
    id,
    name: (row.name as string | null) ?? null,
    team_name: (row.team_name as string | null | undefined) ?? null,
    budget_remaining: row.budget_remaining as number,
    active_budget: row.active_budget as number,
    paid_release_used: Boolean(row.paid_release_used),
    user_id: (row.user_id as string | null | undefined) ?? null,
    is_relegated: isUserRelegated(auctionId, id, dbRelegated),
  };
}

/** Loads auction_users; tolerates DBs that have not yet applied auction-team-names.sql. */
export async function fetchAuctionUsers(
  admin: SupabaseClient,
  auctionId: number,
): Promise<AuctionUserRow[]> {
  const full = await admin
    .from("auction_users")
    .select(FULL_SELECT)
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });

  if (!full.error) {
    return (full.data ?? []).map((row) =>
      normalizeRow(row as Record<string, unknown>, auctionId),
    );
  }

  const msg = String(full.error.message);
  if (!msg.includes("team_name") && !msg.includes("is_relegated")) {
    throw new Error(`auction_users: ${full.error.message}`);
  }

  const fallbackSelect = msg.includes("is_relegated") ? FULL_SELECT_NO_RELEGATED : FULL_SELECT;
  const fallback = await admin
    .from("auction_users")
    .select(fallbackSelect)
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });
  if (fallback.error) {
    if (!String(fallback.error.message).includes("team_name")) {
      throw new Error(`auction_users: ${fallback.error.message}`);
    }
    const base = await admin
      .from("auction_users")
      .select(BASE_SELECT)
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (base.error) throw new Error(`auction_users: ${base.error.message}`);
    return (base.data ?? []).map((row) =>
      normalizeRow({ ...(row as Record<string, unknown>), team_name: null }, auctionId),
    );
  }

  return (fallback.data ?? []).map((row) =>
    normalizeRow(row as Record<string, unknown>, auctionId),
  );
}

export type AuctionUserNameRow = {
  id: number;
  name: string | null;
  team_name: string | null;
};

export async function fetchAuctionUserNames(
  admin: SupabaseClient,
  auctionId: number,
): Promise<AuctionUserNameRow[]> {
  const full = await admin
    .from("auction_users")
    .select("id, name, team_name")
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });

  if (!full.error) {
    return (full.data ?? []).map((row) => ({
      id: row.id as number,
      name: (row.name as string | null) ?? null,
      team_name: (row.team_name as string | null | undefined)?.trim() || null,
    }));
  }

  if (!String(full.error.message).includes("team_name")) {
    throw new Error(`auction_users: ${full.error.message}`);
  }

  const base = await admin
    .from("auction_users")
    .select("id, name")
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });
  if (base.error) throw new Error(`auction_users: ${base.error.message}`);

  return (base.data ?? []).map((row) => ({
    id: row.id as number,
    name: (row.name as string | null) ?? null,
    team_name: null,
  }));
}
