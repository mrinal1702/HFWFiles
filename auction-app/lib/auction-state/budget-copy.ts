/**
 * Participant-facing budget labels. DB columns stay `budget_remaining` / `active_budget`;
 * the UI calls the latter "Disposable".
 */
export const REMAINING_LABEL = "Remaining";
export const DISPOSABLE_LABEL = "Disposable";

export const BUDGET_HELP = `Remaining budget is how much you have in the bank after accounting for purchased players.

Disposable budget is how much you can spend on bids now, after accounting for purchased players and players you hold the winning bid on`;
