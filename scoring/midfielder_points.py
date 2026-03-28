"""
Midfielder point scoring system (v0 — user-provided weights).

This config is intended to be used with the CSV produced by `Tests/stat_collection.py`.
"""

from __future__ import annotations

from typing import Any, TypedDict


class MidfielderWeights(TypedDict, total=False):
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

    # Outcomes (not specified in the user list; assumed same as defender rules)
    goals: float
    assists: float

    penalty_miss: float
    red_card: float


class MidfielderFormulas(TypedDict, total=False):
    dispossessed_base: float
    dispossessed_per_event: float
    minutes_per_point: float


MIDFIELDER_WEIGHTS: MidfielderWeights = {
    # Duels / defending
    "aerial_duels_won": 1.3,
    "aerial_duels_lost": -0.8,
    "tackles_won": 2.6,
    "last_man_tackle": 3.0,
    "clearance_off_the_line": 3.0,
    # Tackles lost and/or times dribbled past are both -0.6
    "tackles_lost": -0.6,
    "dribbled_past": -0.6,
    "interceptions": 2.5,
    "clearances": 1.1,  # applied to clearances_total (clearances + headed_clearance)
    # Possession/pressure consequences
    "fouls_committed": -0.55,
    "caught_offside": -0.55,
    "own_goals": -3.3,
    "errors_led_to_goal": -5.0,

    # Passing / creation
    "accurate_passes": 0.154,
    "inaccurate_passes": -0.31,
    "chances_created": 2.5,

    # Take-ons
    "dribbles_won": 2.9,
    "dribbles_lost": -0.8,

    # Delivery
    "blocks": 1.1,
    "long_balls": 0.4,  # per long_balls_completed
    "crosses_completed": 1.5,

    # Shooting
    "shots_off_target": 0.25,
    "shots_on_target": 2.2,

    # Shooting delivery
    "woodwork": 3.0,

    # Outcomes (assumption: same as defender)
    "goals": 10.0,
    "assists": 8.0,

    # Cards / penalties
    "penalty_miss": -5.0,
    "red_card": -4.0,
}


MIDFIELDER_FORMULAS: MidfielderFormulas = {
    # Dispossessed: points = 3 - 1.1*(times dispossessed)
    "dispossessed_base": 3.0,
    "dispossessed_per_event": 1.1,
    # Time played: 1/30 per minute
    "minutes_per_point": 1.0 / 30.0,
}


# Mapping logical keys -> actual `stat_collection.py` CSV columns.
MIDFIELDER_STAT_KEYS: dict[str, str] = {
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
    # Formulas inputs
    "dispossessed": "dispossessed",
    "minutes_played": "minutes_played",
}


MIDFIELDER_SCORING: dict[str, Any] = {
    "version": "0.1",
    "role": "midfielder",
    "weights": MIDFIELDER_WEIGHTS,
    "formulas": MIDFIELDER_FORMULAS,
    "stat_keys": MIDFIELDER_STAT_KEYS,
    "pending": {
        # These are expected to exist because we now export them:
        # - caught_offside: derived from playerStats['Offsides']
        # - own_goals: derived from timeline Goal events marked isOwnGoal
        # If a match JSON doesn't label the event in that way, values may be 0.
    },
    "notes": (
        "Clearances apply once via clearances_total. "
        "Tackles lost and dribbled_past are separate -0.6 terms. "
        "Goals/assists are assumed same as defenders (10/8) since not explicitly listed for midfielders."
    ),
}

