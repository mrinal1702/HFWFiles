"""
Forward point scoring system (v0 — user-provided weights).

This module is intended to be consumed alongside the CSVs produced by
`Tests/stat_collection.py`.
"""

from __future__ import annotations

from typing import Any, TypedDict


class ForwardWeights(TypedDict, total=False):
    aerial_duels_won: float
    aerial_duels_lost: float

    tackles_won: float
    last_man_tackle: float
    clearance_off_the_line: float
    tackles_lost: float
    dribbled_past: float

    interceptions: float
    clearances: float

    fouls_committed: float
    caught_offside: float
    own_goals: float
    errors_led_to_goal: float

    accurate_passes: float
    inaccurate_passes: float
    chances_created: float

    dribbles_won: float
    dribbles_lost: float

    blocks: float
    long_balls: float
    crosses_completed: float

    shots_off_target: float
    shots_on_target: float

    woodwork: float

    goals: float
    assists: float

    penalty_miss: float
    red_card: float


class ForwardFormulas(TypedDict, total=False):
    dispossessed_base: float
    dispossessed_per_event: float
    minutes_per_point: float


FORWARDS_WEIGHTS: ForwardWeights = {
    # Duels / defending
    "aerial_duels_won": 1.4,
    "aerial_duels_lost": 0.4,
    "tackles_won": 2.6,
    "last_man_tackle": 3.0,
    "clearance_off_the_line": 3.0,
    # Same weight for failed tackle proxy and times dribbled past
    "tackles_lost": -1.0,
    "dribbled_past": -1.0,
    "interceptions": 2.7,

    # Clearances (combine with headed to avoid double counting)
    "clearances": 1.0,

    # Discipline / negatives
    "fouls_committed": -0.5,
    "caught_offside": -0.5,
    "own_goals": -1.5,
    "errors_led_to_goal": -3.0,

    # Passing / creation
    "accurate_passes": 1.0 / 6.0,  # ~= 0.16
    "inaccurate_passes": -0.125,
    "chances_created": 3.25,

    # Take-ons
    "dribbles_won": 3.0,
    "dribbles_lost": -1.0,

    # Blocks / delivery
    "blocks": 0.8,
    "long_balls": 0.75,

    "crosses_completed": 1.2,

    # Shooting
    "shots_off_target": -0.3,
    "shots_on_target": 3.2,
    "woodwork": 3.0,

    # Outcomes (same as defenders)
    "goals": 10.0,
    "assists": 8.0,

    # Cards / penalties (same as defenders)
    "penalty_miss": -5.0,
    "red_card": -4.0,
}


FORWARDS_FORMULAS: ForwardFormulas = {
    # points = 5 - 0.9 * times_dispossessed
    "dispossessed_base": 5.0,
    "dispossessed_per_event": 0.9,
    "minutes_per_point": 1.0 / 30.0,
}


# Mapping logical keys -> actual columns exported by `Tests/stat_collection.py`
FORWARDS_STAT_KEYS: dict[str, str] = {
    "aerial_duels_won": "aerial_duels_won",
    "aerial_duels_lost": "aerial_duels_lost",

    "tackles_won": "tackles",
    "last_man_tackle": "last_man_tackle",
    "clearance_off_the_line": "clearance_off_the_line",
    "tackles_lost": "tackles_lost",
    "dribbled_past": "dribbled_past",

    "interceptions": "interceptions",
    "clearances": "clearances_total",

    "fouls_committed": "fouls_committed",
    "caught_offside": "caught_offside",
    "own_goals": "own_goals",
    "errors_led_to_goal": "errors_led_to_goal",

    "accurate_passes": "accurate_passes",
    "inaccurate_passes": "inaccurate_passes",
    "chances_created": "chances_created",

    "dribbles_won": "dribbles_successful",
    "dribbles_lost": "dribbles_failed",

    "blocks": "blocks",
    "long_balls": "long_balls_completed",
    "crosses_completed": "crosses_completed",

    "shots_off_target": "shots_off_target",
    "shots_on_target": "shots_on_target",

    "woodwork": "woodwork",

    "goals": "goals",
    "assists": "assists",

    "penalty_miss": "missed_penalty",
    "red_card": "red_cards",

    # Formula-only inputs
    "dispossessed": "dispossessed",
    "minutes_played": "minutes_played",
}


FORWARDS_SCORING: dict[str, Any] = {
    "version": "0.1",
    "role": "forward",
    "weights": FORWARDS_WEIGHTS,
    "formulas": FORWARDS_FORMULAS,
    "stat_keys": FORWARDS_STAT_KEYS,
    "pending": {
        # Not explicitly available as aggregated playerStats in our current sample JSON.
        # If/when event-level defensive parsing is added, these can be wired in.
        "last_man_tackle_off_line": None,
    },
    "notes": (
        "Clearances apply to `clearances_total` (clearances + headed_clearance) once. "
        "Tackles lost uses the existing proxy column `tackles_lost` (ground duels lost). "
        "Dribbled_past uses `dribbled_past` and shares the same -1 weight per your rule. "
        "Woodwork uses the per-player `woodwork` column (only present when the JSON provides it)."
    ),
}

