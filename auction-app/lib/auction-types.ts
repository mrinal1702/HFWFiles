export type AuctionUserRow = {
  id: number;
  name: string | null;
  /** Optional fantasy team label for this auction; UI falls back to `name` when null. */
  team_name: string | null;
  budget_remaining: number;
  active_budget: number;
  /** False until the manager uses their 1 paid release for the current GW window. Reset via SQL between GWs. */
  paid_release_used: boolean;
  /** Supabase auth user id when this row is a real member; null = legacy test row. */
  user_id?: string | null;
  /** True when relegated by standings — view-only, no squad or bidding. */
  is_relegated?: boolean;
  /** From profiles.avatar_url when user_id is set; null if unset or unlinked. */
  avatar_url?: string | null;
};

export type EnrichedLot = {
  player_id: string;
  player_name: string | null;
  position: string | null;
  club: string | null;
  /** Real-world club id from `players.team_id` when present; used for default list ordering. */
  team_id: number | null;
  status: string;
  expires_at: string | null;
  high_bidder_id: number | null;
  high_bidder_name: string | null;
  /** profiles.avatar_url for the high bidder when linked to an auth user. */
  high_bidder_avatar_url: string | null;
  high_amount: number | null;
  /** Nation (players.team_name) for rolling deadline mode. */
  nation_name: string | null;
  nation_raise_deadline_at: string | null;
  nation_hard_deadline_at: string | null;
  /** True when nation hard deadline passed (rolling mode). */
  nation_bidding_closed: boolean;
  /** Per-lot +5 raise rule (rolling mode uses nation raise deadline). */
  nation_raise_mode_active: boolean;
};

/** Serializable subset for client bid eligibility checks. */
export type BidGateContext = {
  biddingClosed: boolean;
  biddingClosedReason: string | null;
  viewerMode: boolean;
  me: AuctionUserRow | null;
  meRosterSlots: number;
  meGkCount: number;
  /** True once initiation_deadline_at has passed — uninitiated lots can no longer be opened. */
  initiationClosed: boolean;
  /** True once raise_deadline_at has passed — all bids must raise by at least 5. */
  raiseModeActive: boolean;
  /** nation_rolling auctions use per-lot nation deadlines instead of global initiation/raise. */
  nationRollingMode: boolean;
};
