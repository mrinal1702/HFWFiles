export type AuctionUserRow = {
  id: number;
  name: string | null;
  budget_remaining: number;
  active_budget: number;
  /** Supabase auth user id when this row is a real member; null = legacy test row. */
  user_id?: string | null;
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
  high_amount: number | null;
};

/** Serializable subset for client bid eligibility checks. */
export type BidGateContext = {
  biddingClosed: boolean;
  biddingClosedReason: string | null;
  viewerMode: boolean;
  me: AuctionUserRow | null;
  meRosterSlots: number;
  meGkCount: number;
};
