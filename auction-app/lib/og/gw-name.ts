/** "UEFA Champions League GW4" → "GW4" (falls back to the full name). Safe for client code. */
export function shortGwName(name: string): string {
  const m = name.match(/\b(GW|MW|Matchday|Gameweek)\s*\d+\b/i);
  return m ? m[0] : name;
}
