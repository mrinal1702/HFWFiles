"""
Goalkeeper point scoring system.

Stat weights are per-user specification.
Endowment rule is documented for simulator implementation:
- Team GK endowment baseline: 18 - 6*(team goals conceded)
- If multiple GKs play for a team, treat them as one unit for endowed points.
- For stat points in that case, keep only the GK with highest stat points.
"""

from __future__ import annotations

from typing import Any, TypedDict


class GoalkeeperWeights(TypedDict, total=False):
    saves: float
    accurate_passes: float
    inaccurate_passes: float
    clearances: float
    interceptions: float
    tackles: float
    accurate_long_balls: float
    punches: float
    high_claim: float


class GoalkeeperFormulas(TypedDict, total=False):
    minutes_per_point: float


GOALKEEPER_WEIGHTS: GoalkeeperWeights = {
    "saves": 3.2,
    "accurate_passes": 0.16,
    "inaccurate_passes": -0.2,
    "clearances": 1.0,
    "interceptions": 2.0,
    "tackles": 2.0,
    "accurate_long_balls": 0.3,
    "punches": 2.0,
    "high_claim": 2.4,
}


GOALKEEPER_FORMULAS: GoalkeeperFormulas = {
    "minutes_per_point": 1.0 / 30.0,
}


# Map logical keys to keeper_stat_collection.py columns.
GOALKEEPER_STAT_KEYS: dict[str, str] = {
    "saves": "saves",
    "accurate_passes": "accurate_passes",
    "inaccurate_passes": "inaccurate_passes",
    "clearances": "clearances",
    "interceptions": "interceptions",
    "tackles": "tackles",
    "accurate_long_balls": "accurate_long_balls",
    "punches": "punches",
    "high_claim": "high_claim",
    "minutes_played": "minutes_played",
}


GOALKEEPER_ENDOWMENT_RULES: dict[str, Any] = {
    "base_points": 18.0,
    "per_goal_conceded": -6.0,
    "team_gk_as_single_unit": True,
    "if_multiple_gk_played_stat_points_use_best_single_gk": True,
    "notes": (
        "When more than one goalkeeper appears for a team in one match, endowed points are "
        "calculated once at team-GK level, while stat points should be taken from the goalkeeper "
        "with the highest stat_points_total."
    ),
}


GOALKEEPER_SCORING: dict[str, Any] = {
    "version": "0.1",
    "role": "goalkeeper",
    "weights": GOALKEEPER_WEIGHTS,
    "formulas": GOALKEEPER_FORMULAS,
    "stat_keys": GOALKEEPER_STAT_KEYS,
    "endowment_rules": GOALKEEPER_ENDOWMENT_RULES,
}

