/** Online auction roster cap — owned players + leading bids count toward this. */
export const SQUAD_LIMIT = 18;

/** Bid-column copy when the roster cap is reached (shown with an info icon). */
export const SQUAD_LIMIT_REASON = "You are at the squad limit";
export const SQUAD_LIMIT_HELP = `You cannot place bids on more players if the sum total of the players you own and the players you hold the highest bid on equals ${SQUAD_LIMIT}`;

export function remainingBidSlots(owned: number, bidsHeld: number): number {
  return Math.max(0, SQUAD_LIMIT - owned - bidsHeld);
}
