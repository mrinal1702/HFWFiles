// ─── DB row shapes ────────────────────────────────────────────────────────────

export type LiveAuctionStatus = "setup" | "live" | "paused" | "completed";
export type ParticipantRole = "participant" | "admin";
export type PlayerStatus = "available" | "sold" | "unsold";

export interface LiveAuction {
  id: string;
  name: string;
  status: LiveAuctionStatus;
  starting_budget: number;
  squad_size: number;
  min_bid: number;
  created_by: string | null;
  created_at: string;
}

export interface LiveAuctionParticipant {
  id: string;
  auction_id: string;
  user_id: string | null;
  display_name: string;
  role: ParticipantRole;
  created_at: string;
}

export interface LiveAuctionPlayer {
  id: string;
  auction_id: string;
  fotmob_player_id: string;
  player_name: string;
  team_name: string | null;
  nation: string | null;
  position: string | null;
  status: PlayerStatus;
  created_at: string;
}

export interface LiveAuctionSale {
  id: string;
  auction_id: string;
  player_id: string;
  participant_id: string;
  price: number;
  created_by: string | null;
  created_at: string;
  is_voided: boolean;
  void_reason: string | null;
}

// ─── Derived / enriched shapes ────────────────────────────────────────────────

/** Participant row enriched with computed budget and squad stats. */
export interface ParticipantSummary {
  id: string;
  auction_id: string;
  user_id: string | null;
  display_name: string;
  role: ParticipantRole;
  total_spent: number;
  budget_remaining: number;
  players_count: number;
}

/** Sale row with player and participant names joined in. */
export interface SaleWithDetails {
  id: string;
  auction_id: string;
  player_id: string;
  participant_id: string;
  price: number;
  created_at: string;
  is_voided: boolean;
  void_reason: string | null;
  player_name: string;
  fotmob_player_id: string;
  participant_name: string;
}

/** SaleWithDetails enriched with player position, nationality, and club. */
export interface SaleWithFullDetails extends SaleWithDetails {
  position: string | null;
  nation: string | null;
  team_name: string | null;
}

/** A player on a participant's squad, derived from non-voided sales. */
export interface SquadPlayer {
  sale_id: string;
  price: number;
  player_id: string;
  fotmob_player_id: string;
  player_name: string;
  team_name: string | null;
  nation: string | null;
  position: string | null;
}

/** Counts of players by position bucket for one participant's squad. */
export interface PositionBreakdown {
  gk: number;
  def: number;
  mid: number;
  fwd: number;
  other: number;
}

/** ParticipantSummary enriched with a per-position player count. */
export interface ParticipantSummaryWithPositions extends ParticipantSummary {
  positions: PositionBreakdown;
}

/**
 * A player row enriched with its current sale details (if sold).
 * Used by the admin team-browse view so all players are shown with their status.
 */
export interface PlayerWithSaleInfo extends LiveAuctionPlayer {
  /** null when the player has not been sold (status available/unsold). */
  sale_id: string | null;
  sale_price: number | null;
  sold_to_name: string | null;
  sold_to_participant_id: string | null;
}

// ─── Server action state types ────────────────────────────────────────────────

export type RecordSaleState = {
  error?: string;
  fieldErrors?: {
    playerId?: string;
    participantId?: string;
    price?: string;
  };
  success?: boolean;
} | null;

export type VoidSaleState = {
  error?: string;
  success?: boolean;
} | null;

export type EditSaleState = {
  error?: string;
  success?: boolean;
} | null;
