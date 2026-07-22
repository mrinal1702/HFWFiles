import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuctionUserRow } from "@/lib/auction-types";
import { fetchAvatarUrlsByUserIds } from "@/lib/profile-avatars";
import { isUserRelegated } from "@/lib/relegated-participants";

const BASE_SELECT =
  "id,name,budget_remaining,active_budget,paid_release_used,user_id";
const FULL_SELECT = `${BASE_SELECT},team_name,is_relegated`;
const FULL_NO_RELEGATION = `${BASE_SELECT},team_name`;
const BASE_WITH_RELEGATION = `${BASE_SELECT},is_relegated`;

function dbRelegationFlag(row: Record<string, unknown>): boolean | null {
  if (!("is_relegated" in row)) return null;
  return Boolean(row.is_relegated);
}

function normalizeRow(row: Record<string, unknown>, auctionId: number): AuctionUserRow {
  const id = row.id as number;
  return {
    id,
    name: (row.name as string | null) ?? null,
    team_name: (row.team_name as string | null | undefined) ?? null,
    budget_remaining: row.budget_remaining as number,
    active_budget: row.active_budget as number,
    paid_release_used: Boolean(row.paid_release_used),
    user_id: (row.user_id as string | null | undefined) ?? null,
    is_relegated: isUserRelegated(auctionId, id, dbRelegationFlag(row)),
    avatar_url: null,
  };
}

async function withAvatarUrls(
  admin: SupabaseClient,
  users: AuctionUserRow[],
): Promise<AuctionUserRow[]> {
  const authIds = users
    .map((u) => u.user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (authIds.length === 0) return users;

  const avatars = await fetchAvatarUrlsByUserIds(admin, authIds);
  return users.map((u) => ({
    ...u,
    avatar_url: u.user_id ? (avatars.get(u.user_id) ?? null) : null,
  }));
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
    return withAvatarUrls(
      admin,
      (full.data ?? []).map((row) =>
        normalizeRow(row as unknown as Record<string, unknown>, auctionId),
      ),
    );
  }

  const fullErr = String(full.error.message);
  if (!fullErr.includes("team_name") && !fullErr.includes("is_relegated")) {
    throw new Error(`auction_users: ${full.error.message}`);
  }

  if (fullErr.includes("team_name") && !fullErr.includes("is_relegated")) {
    const withRelegation = await admin
      .from("auction_users")
      .select(BASE_WITH_RELEGATION)
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (withRelegation.error) throw new Error(`auction_users: ${withRelegation.error.message}`);

    return withAvatarUrls(
      admin,
      (withRelegation.data ?? []).map((row) =>
        normalizeRow({ ...(row as unknown as Record<string, unknown>), team_name: null }, auctionId),
      ),
    );
  }

  if (fullErr.includes("is_relegated") && !fullErr.includes("team_name")) {
    const noRelegation = await admin
      .from("auction_users")
      .select(FULL_NO_RELEGATION)
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (noRelegation.error) throw new Error(`auction_users: ${noRelegation.error.message}`);

    return withAvatarUrls(
      admin,
      (noRelegation.data ?? []).map((row) =>
        normalizeRow(row as unknown as Record<string, unknown>, auctionId),
      ),
    );
  }

  const base = await admin
    .from("auction_users")
    .select(BASE_SELECT)
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });
  if (base.error) throw new Error(`auction_users: ${base.error.message}`);

  return withAvatarUrls(
    admin,
    (base.data ?? []).map((row) =>
      normalizeRow({ ...(row as unknown as Record<string, unknown>), team_name: null }, auctionId),
    ),
  );
}

export type AuctionUserNameRow = {
  id: number;
  name: string | null;
  team_name: string | null;
  /** From auction_users.is_relegated when the column exists. */
  isRelegatedInDb: boolean | null;
  user_id: string | null;
  avatar_url: string | null;
};

function mapAuctionUserNameRow(row: Record<string, unknown>): AuctionUserNameRow {
  return {
    id: row.id as number,
    name: (row.name as string | null) ?? null,
    team_name: (row.team_name as string | null | undefined)?.trim() || null,
    isRelegatedInDb: dbRelegationFlag(row),
    user_id: (row.user_id as string | null | undefined) ?? null,
    avatar_url: null,
  };
}

async function withNameRowAvatars(
  admin: SupabaseClient,
  users: AuctionUserNameRow[],
): Promise<AuctionUserNameRow[]> {
  const authIds = users
    .map((u) => u.user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (authIds.length === 0) return users;

  const avatars = await fetchAvatarUrlsByUserIds(admin, authIds);
  return users.map((u) => ({
    ...u,
    avatar_url: u.user_id ? (avatars.get(u.user_id) ?? null) : null,
  }));
}

export async function fetchAuctionUserNames(
  admin: SupabaseClient,
  auctionId: number,
): Promise<AuctionUserNameRow[]> {
  const full = await admin
    .from("auction_users")
    .select("id, name, team_name, is_relegated, user_id")
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });

  if (!full.error) {
    return withNameRowAvatars(
      admin,
      (full.data ?? []).map((row) =>
        mapAuctionUserNameRow(row as unknown as Record<string, unknown>),
      ),
    );
  }

  const fullErr = String(full.error.message);
  if (
    !fullErr.includes("team_name") &&
    !fullErr.includes("is_relegated") &&
    !fullErr.includes("user_id")
  ) {
    throw new Error(`auction_users: ${full.error.message}`);
  }

  if (fullErr.includes("team_name") && !fullErr.includes("is_relegated")) {
    const withRelegation = await admin
      .from("auction_users")
      .select("id, name, is_relegated, user_id")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (withRelegation.error) throw new Error(`auction_users: ${withRelegation.error.message}`);

    return withNameRowAvatars(
      admin,
      (withRelegation.data ?? []).map((row) =>
        mapAuctionUserNameRow({ ...(row as unknown as Record<string, unknown>), team_name: null }),
      ),
    );
  }

  if (fullErr.includes("is_relegated") && !fullErr.includes("team_name")) {
    const noRelegation = await admin
      .from("auction_users")
      .select("id, name, team_name, user_id")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (noRelegation.error) throw new Error(`auction_users: ${noRelegation.error.message}`);

    return withNameRowAvatars(
      admin,
      (noRelegation.data ?? []).map((row) =>
        mapAuctionUserNameRow(row as unknown as Record<string, unknown>),
      ),
    );
  }

  const base = await admin
    .from("auction_users")
    .select("id, name, user_id")
    .eq("auction_id", auctionId)
    .order("id", { ascending: true });
  if (base.error) {
    // Very old DBs without user_id on auction_users
    const legacy = await admin
      .from("auction_users")
      .select("id, name")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (legacy.error) throw new Error(`auction_users: ${legacy.error.message}`);
    return (legacy.data ?? []).map((row) =>
      mapAuctionUserNameRow({
        ...(row as unknown as Record<string, unknown>),
        team_name: null,
        user_id: null,
      }),
    );
  }

  return withNameRowAvatars(
    admin,
    (base.data ?? []).map((row) =>
      mapAuctionUserNameRow({ ...(row as unknown as Record<string, unknown>), team_name: null }),
    ),
  );
}
