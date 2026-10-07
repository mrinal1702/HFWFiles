/** Online auction roster cap — owned players + leading bids count toward this. */
export const SQUAD_LIMIT = 18;

export function remainingBidSlots(owned: number, bidsHeld: number): number {
  return Math.max(0, SQUAD_LIMIT - owned - bidsHeld);
}
