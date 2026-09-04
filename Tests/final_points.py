"""
Shared merge + validation for *_FinalPoints.csv.

All paths that produce FinalPoints (per-match fetch, presentation merge, batch
rescore) must go through merge_outfield_and_keepers() so keeper total_points
is never dropped before final_score is rounded.
"""

from __future__ import annotations

from typing import Any

import pandas as pd


FINAL_POINTS_COLUMNS = [
    "player_name",
    "player_id",
    "team_name",
    "position",
    "stats_score",
    "endowment_score",
    "shootout_score",
    "final_score",
]

# Legacy CSVs (pre–shootout column) still accepted by upload/parser helpers.
LEGACY_FINAL_POINTS_COLUMNS = [
    "player_name",
    "player_id",
    "team_name",
    "position",
    "stats_score",
    "endowment_score",
    "final_score",
]


def merge_outfield_and_keepers(
    outfield_df: pd.DataFrame,
    keepers_df: pd.DataFrame,
    *,
    match_data: dict[str, Any] | None = None,
    validate: bool = True,
) -> pd.DataFrame:
    """
    Merge outfield + keeper unit rows into FinalPoints schema.

    outfield_df: output of simulate_points() (or *_Points.csv) with columns
        player_name, player_id, team_name, role, stat_points_total,
        endowed_points, total_points.

    keepers_df: output of calculate_keeper_points pipeline with columns
        team_id, team_name, stat_points_total, endowed_points, total_points
        (one row per team after pick_best_stat_gk_per_team + total_points).
    """
    out_final = outfield_df[
        ["player_name", "player_id", "team_name", "role", "stat_points_total", "endowed_points", "total_points"]
    ].rename(
        columns={
            "role": "position",
            "stat_points_total": "stats_score",
            "endowed_points": "endowment_score",
            "total_points": "final_score_raw",
        }
    )

    keepers = keepers_df.copy()
    if "total_points" not in keepers.columns:
        raise ValueError(
            "keepers_df missing total_points — compute "
            "(stat_points_total + endowed_points).clip(lower=0) before merge"
        )
    keepers["player_name"] = keepers["team_name"].astype(str) + " Keepers"
    keepers["player_id"] = keepers["team_id"]
    keepers["position"] = "goalkeeper"

    keep_final = keepers[
        ["player_name", "player_id", "team_name", "position", "stat_points_total", "endowed_points", "total_points"]
    ].rename(
        columns={
            "stat_points_total": "stats_score",
            "endowed_points": "endowment_score",
            "total_points": "final_score_raw",
        }
    )

    merged = pd.concat([out_final, keep_final], ignore_index=True)
    merged["final_score_raw"] = pd.to_numeric(merged["final_score_raw"], errors="coerce").fillna(0.0)
    merged["shootout_score"] = 0.0
    merged["final_score"] = merged["final_score_raw"].round().clip(lower=0).astype(int)
    result = merged[
        [
            "player_name",
            "player_id",
            "team_name",
            "position",
            "stats_score",
            "endowment_score",
            "shootout_score",
            "final_score",
        ]
    ].copy()

    result = apply_penalty_shootout_points(result, match_data)

    if validate:
        validate_final_points_df(result, context="merge_outfield_and_keepers")
    return result


def apply_penalty_shootout_points(
    df: pd.DataFrame,
    match_data: dict[str, Any] | None,
) -> pd.DataFrame:
    """Add shootout_score column and recompute final_score when a shootout occurred."""
    from penalty_shootout_points import compute_penalty_shootout_points

    result = df.copy()
    if "shootout_score" not in result.columns:
        result["shootout_score"] = 0.0

    outfield_pts: dict[int, float] = {}
    keeper_pts_by_team: dict[int, float] = {}
    if match_data is not None:
        outfield_pts, keeper_pts_by_team = compute_penalty_shootout_points(match_data)

    if not outfield_pts and not keeper_pts_by_team:
        result["final_score"] = (
            pd.to_numeric(result["stats_score"], errors="coerce").fillna(0.0)
            + pd.to_numeric(result["endowment_score"], errors="coerce").fillna(0.0)
            + pd.to_numeric(result["shootout_score"], errors="coerce").fillna(0.0)
        ).round().clip(lower=0).astype(int)
        return result[FINAL_POINTS_COLUMNS].copy()

    shootout_col: list[float] = []
    for _, row in result.iterrows():
        pid = int(pd.to_numeric(row["player_id"], errors="coerce"))
        position = str(row.get("position") or "").strip().lower()
        if position == "goalkeeper":
            shootout_col.append(float(keeper_pts_by_team.get(pid, 0.0)))
        else:
            shootout_col.append(float(outfield_pts.get(pid, 0.0)))

    result["shootout_score"] = shootout_col
    raw_total = (
        pd.to_numeric(result["stats_score"], errors="coerce").fillna(0.0)
        + pd.to_numeric(result["endowment_score"], errors="coerce").fillna(0.0)
        + pd.to_numeric(result["shootout_score"], errors="coerce").fillna(0.0)
    )
    result["final_score"] = raw_total.round().clip(lower=0).astype(int)
    return result[FINAL_POINTS_COLUMNS].copy()


def validate_final_points_df(df: pd.DataFrame, *, context: str = "") -> None:
    """
    Raise ValueError if FinalPoints rows look corrupt.

    Catches the GW1 rescore bug: keeper rows with positive stat+endowment but
    final_score forced to 0 because total_points was never computed.
    """
    prefix = f"{context}: " if context else ""
    if "shootout_score" not in df.columns:
        df = df.copy()
        df["shootout_score"] = 0.0

    required = set(FINAL_POINTS_COLUMNS)
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{prefix}missing columns {sorted(missing)}")

    gk = df[df["position"].astype(str).str.strip().str.lower() == "goalkeeper"]
    if gk.empty:
        raise ValueError(f"{prefix}no goalkeeper unit rows (expected 2 per match file)")

    errors: list[str] = []
    for _, row in gk.iterrows():
        name = str(row.get("player_name") or "")
        stats = float(pd.to_numeric(row.get("stats_score"), errors="coerce") or 0)
        endow = float(pd.to_numeric(row.get("endowment_score"), errors="coerce") or 0)
        shootout = float(pd.to_numeric(row.get("shootout_score"), errors="coerce") or 0)
        final = int(pd.to_numeric(row.get("final_score"), errors="coerce") or 0)
        raw_total = stats + endow + shootout
        expected = int(max(0, round(raw_total)))

        if raw_total > 0.01 and final == 0:
            errors.append(
                f"{name}: final_score=0 but stats_score+endowment_score={raw_total:.2f} "
                "(keeper total_points was likely not computed before merge)"
            )
        elif abs(final - expected) > 0:
            errors.append(f"{name}: final_score={final} but expected {expected} from components")

    if errors:
        raise ValueError(f"{prefix}FinalPoints validation failed:\n  " + "\n  ".join(errors))


def validate_final_points_csv(path: Any) -> None:
    """Load a *_FinalPoints.csv and run validate_final_points_df."""
    df = pd.read_csv(path)
    validate_final_points_df(df, context=str(path))
