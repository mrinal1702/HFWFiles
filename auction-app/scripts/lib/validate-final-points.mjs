/**
 * FinalPoints CSV validation — blocks Supabase upload if keeper rows are corrupt.
 * See docs/AGENT_SCORING_LESSONS_GW1_RESCORE.md
 */

/**
 * @param {Array<{
 *   player_name: string;
 *   stats_score: number;
 *   endowment_score: number;
 *   score: number;
 *   is_keeper_unit: boolean;
 *   source_file: string;
 * }>} rows
 */
export function validateFinalPointsRows(rows) {
  const errors = [];

  for (const row of rows) {
    if (!row.is_keeper_unit) continue;

    const stats = Number(row.stats_score);
    const endow = Number(row.endowment_score);
    const final = Number(row.score);
    if (!Number.isFinite(stats) || !Number.isFinite(endow) || !Number.isFinite(final)) {
      errors.push(`${row.player_name} [${row.source_file}]: non-numeric score components`);
      continue;
    }

    const rawTotal = stats + endow;
    const expected = Math.max(0, Math.round(rawTotal));

    if (rawTotal > 0.01 && final === 0) {
      errors.push(
        `${row.player_name} [${row.source_file}]: final_score=0 but stats+endowment=${rawTotal.toFixed(2)} ` +
          "(keeper total_points was likely not computed before merge)",
      );
    } else if (final !== expected) {
      errors.push(
        `${row.player_name} [${row.source_file}]: final_score=${final} but expected ${expected}`,
      );
    }
  }

  if (errors.length) {
    throw new Error(
      `FinalPoints validation failed (${errors.length} keeper issue(s)):\n  ${errors.join("\n  ")}\n` +
        "Run: python Tests/validate_final_points.py <csv files>",
    );
  }
}
