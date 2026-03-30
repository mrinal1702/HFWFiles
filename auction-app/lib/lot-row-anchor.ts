/** Stable DOM id for a player row / bid block (bidding room list + player detail). */
export function lotRowAnchorId(playerId: string): string {
  return `lot-row-${playerId}`;
}
