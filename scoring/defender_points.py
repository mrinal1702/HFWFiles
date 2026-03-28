"""
Defender point scoring system (v0 — trial weights).

Used by downstream “stat collection” scoring; weights can be adjusted when
missing stats (woodwork, crosses, long balls, tackle won/lost split, etc.) are wired in.

Data source notes (FotMob-style `playerStats` in match JSON)
-----------------------------------------------------------
- **Error led to goal**: present as stat key `errors_led_to_goal` (“Error led to goal”).
- **Error leading to shot**: not found in sample `Match1.json`; only `errors_led_to_goal` appears.
- **Woodwork**: team stats use `shots_woodwork`; confirm per-player availability before scoring.
- **Crosses / long balls**: player keys `accurate_crosses`, `long_balls_accurate` (often fraction value/total).
"""

from __future__ import annotations

from typing import Any, TypedDict


class DefenderWeights(TypedDict, total=False):
    """Per-unit linear weights (except where formula_* applies)."""

    aerial_duels_won: float
    aerial_duels_lost: float
    tackles_won: float
    last_man_tackle: float
    clearance_off_the_line: float
    tackles_lost: float
    dribbled_past: float  # same magnitude as tackles_lost (-1.6)
    interceptions: float
    clearances: float  # apply once to (clearances + headed_clearance) to avoid double counting
    errors_led_to_goal: float
    fouls_committed: float
    caught_offside: float
    accurate_passes: float
    inaccurate_passes: float
    chances_created: float
    dribbles_won: float  # `dribbles_succeeded` value (successful take-on)
    dribbles_lost: float  # failed take-on: total − value on `dribbles_succeeded`
    blocks: float
    shots_off_target: float
    shots_on_target: float
    woodwork: float  # use only when per-player woodwork exists in JSON (see docs)
    crosses_completed: float
    long_balls: float
    own_goals: float
    goals: float
    assists: float
    penalty_miss: float  # same as missed_penalty column / `missed_penalty` stat key
    red_card: float


class DefenderFormulas(TypedDict, total=False):
    """Non-linear or special rules; implement in code using these parameters."""

    dispossessed_base: float
    dispossessed_per_event: float
    minutes_per_point: float  # points per minute = 1/30


class DefenderPending(TypedDict, total=False):
    """Weights not yet assigned — fill when rules are finalized."""

    own_goal: Any
    error_events: Any  # generic “error” if distinct from errors_led_to_goal


DEFENDER_WEIGHTS: DefenderWeights = {
    # Duels / defending
    "aerial_duels_won": 1.5,
    "aerial_duels_lost": -0.7,
    "tackles_won": 2.7,
    "last_man_tackle": 3.0,
    "clearance_off_the_line": 3.0,
    # Proxy: total − value on `ground_duels_won` (no separate tackles-lost in API)
    "tackles_lost": -1.6,
    # Times beaten by an opponent dribble (defensive) — same weight as tackles_lost
    "dribbled_past": -1.6,
    "interceptions": 2.7,
    # One combined line: points += clearances_weight * (clearances + headed_clearance)
    "clearances": 1.1,
    "errors_led_to_goal": -5.0,
    "fouls_committed": -0.6,
    "caught_offside": -0.6,
    # Passing / creation
    "accurate_passes": 0.11,
    "inaccurate_passes": -0.22,
    "chances_created": 2.6,
    # Take-ons (`dribbles_succeeded` in JSON) — not the same as ground-duel tackles_lost
    "dribbles_won": 2.5,
    "dribbles_lost": -0.8,  # unsuccessful / failed take-on
    "blocks": 1.0,
    # Shooting
    "shots_off_target": 0.5,
    "shots_on_target": 2.5,
    "woodwork": 2.5,
    # Delivery (per completed / accurate — confirm mapping later)
    "crosses_completed": 1.6,
    "long_balls": 0.2,
    # Outcomes
    "own_goals": -3.0,
    "goals": 10.0,
    "assists": 8.0,
    "penalty_miss": -5.0,
    "red_card": -4.0,
}
# Apply `penalty_miss` weight to the `missed_penalty` stat / CSV column.

# Dispossessed: points = dispossessed_base - (times_dispossessed * dispossessed_per_event)
DEFENDER_FORMULAS: DefenderFormulas = {
    "dispossessed_base": 3.0,
    "dispossessed_per_event": 1.2,
    "minutes_per_point": 1.0 / 30.0,
}

# API / stat-key mapping hints (FotMob `stat_key` under playerStats)
DEFENDER_STAT_KEYS: dict[str, str] = {
    # Duels / defending
    "aerial_duels_won": "aerial_duels_won",
    "aerial_duels_lost": "aerial_duels_lost",
    "tackles_won": "tackles",
    "last_man_tackle": "last_man_tackle",
    "clearance_off_the_line": "clearance_off_the_line",
    "tackles_lost": "tackles_lost",
    "dribbled_past": "dribbled_past",
    "interceptions": "interceptions",

    # One combined term to avoid double counting
    "clearances": "clearances_total",

    # Passing / creation
    "accurate_passes": "accurate_passes",
    "inaccurate_passes": "inaccurate_passes",
    "chances_created": "chances_created",

    # Take-ons
    "dribbles_won": "dribbles_successful",
    "dribbles_lost": "dribbles_failed",

    # Others
    "blocks": "blocks",
    "shots_off_target": "shots_off_target",
    "shots_on_target": "shots_on_target",
    "woodwork": "woodwork",
    "crosses_completed": "crosses_completed",
    "long_balls": "long_balls_completed",

    # Outcomes
    "goals": "goals",
    "assists": "assists",
    "caught_offside": "caught_offside",
    "own_goals": "own_goals",
    "errors_led_to_goal": "errors_led_to_goal",
    "dispossessed": "dispossessed",
    "minutes_played": "minutes_played",
    "penalty_miss": "missed_penalty",
    "red_card": "red_cards",
}

# Stats you still cannot populate from this FotMob match JSON alone (per earlier audit)
STATS_STILL_MISSING_OR_EXTERNAL: tuple[str, ...] = (
    "Per-player woodwork is match-dependent (sometimes present as `shots_woodwork`, sometimes absent)",
    "Whether woodwork counts as shot on/off target (not labeled on shotmap events)",
    "Error leading to shot / generic defensive errors count (only `errors_led_to_goal` exists per player)",
    "Yellow cards (excluded by design; available via timeline Card+Yellow or lineup yellowCard)",
    "Clearance off the line / last-man tackle as aggregated player stats (see EVENT_LEVEL_DEFENSIVE)",
)

# Shot-level fields (not summed in playerStats in our samples): parse `content.shotmap.shots` or per-player `shotmap`.
EVENT_LEVEL_DEFENSIVE: dict[str, str] = {
    "saved_off_line": "isSavedOffLine on shot events (e.g. keeper/goal-line clearance); no per-player total in playerStats",
    "last_man_tackle": "no dedicated key in sample JSON; may appear only in narrative or another feed",
}

# Intentionally no weight (for now); still exported in stat_collection CSV.
STATS_NO_WEIGHT_ASSIGNED: tuple[str, ...] = (
    "recoveries — not scored until a weight is chosen",
)

# Ignore for fantasy points (aggregate overlaps component duels).
STATS_IGNORED_FOR_SCORING: tuple[str, ...] = (
    "duels_won (aggregate)",
)

# Collected in pipeline or mapped in `DEFENDER_STAT_KEYS` but no linear `DEFENDER_WEIGHTS` entry yet (or formula-only).
SCORING_WEIGHTS_STILL_TODO: tuple[str, ...] = (
    "recoveries — see STATS_NO_WEIGHT_ASSIGNED",
)

DEFENDER_PENDING: DefenderPending = {
    "own_goal": None,
    "error_events": None,
}

DEFENDER_SCORING: dict[str, Any] = {
    "version": "0.6",
    "role": "defender",
    "weights": DEFENDER_WEIGHTS,
    "formulas": DEFENDER_FORMULAS,
    "stat_keys": DEFENDER_STAT_KEYS,
    "pending": DEFENDER_PENDING,
    "event_level": EVENT_LEVEL_DEFENSIVE,
    "stats_no_weight": STATS_NO_WEIGHT_ASSIGNED,
    "stats_ignored": STATS_IGNORED_FOR_SCORING,
    "weights_todo": SCORING_WEIGHTS_STILL_TODO,
    "notes": (
        "Clearances: apply weight 1.1 once to (clearances + headed_clearance). "
        "dribbled_past: -1.6 (same as tackles_lost). errors_led_to_goal: -5. "
        "dribbles: 2.5 / -0.8 (`dribbles_succeeded`). penalty_miss -5, red_card -4. "
        "Woodwork: confirm per-player key in each JSON before applying 2.5. "
        "recoveries: no weight yet."
    ),
}
