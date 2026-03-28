"""
Point simulator: full pipeline from match JSON -> stat points + endowed points -> final points CSV.

Output file naming:
    <HomeTeamNoSpaces>_<AwayTeamNoSpaces>_Points.csv
Saved under `Tests/`.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd

from Calculate_stat_points import calculate_stat_points
from calculate_endowed_points import calculate_endowed_points


def _slug_team(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def _match_output_name(data: dict[str, Any]) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{_slug_team(home)}_{_slug_team(away)}_Points.csv"


def _write_csv(df: pd.DataFrame, path: Path) -> Path:
    try:
        df.to_csv(path, index=False, encoding="utf-8")
        return path
    except PermissionError:
        alt = path.parent / "export_run" / path.name
        alt.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(alt, index=False, encoding="utf-8")
        print(f"Warning: {path} was in use. Wrote {alt} instead.")
        return alt


def simulate_points(match_data: dict[str, Any]) -> pd.DataFrame:
    stat_df = calculate_stat_points(match_data)
    end_df = calculate_endowed_points(match_data)

    # keep only necessary columns from each side, then merge
    stat_keep = stat_df[
        [
            "player_id",
            "player_name",
            "team_id",
            "team_name",
            "usual_playing_position_id",
            "role",
            "stat_points_weighted",
            "stat_points_dispossessed_formula",
            "stat_points_minutes",
            "stat_points_total",
        ]
    ].copy()

    end_keep = end_df[
        [
            "player_id",
            "minutes_played_derived",
            "goals_for_while_on_field",
            "goals_against_while_on_field",
            "endowed_points",
        ]
    ].copy()

    merged = stat_keep.merge(end_keep, on="player_id", how="left")
    merged["endowed_points"] = merged["endowed_points"].fillna(0.0)
    merged["minutes_played_derived"] = merged["minutes_played_derived"].fillna(0.0)
    merged["goals_for_while_on_field"] = merged["goals_for_while_on_field"].fillna(0).astype(int)
    merged["goals_against_while_on_field"] = merged["goals_against_while_on_field"].fillna(0).astype(int)

    merged["total_points"] = merged["stat_points_total"] + merged["endowed_points"]

    merged = merged.sort_values(
        by=["total_points", "stat_points_total", "endowed_points"],
        ascending=[False, False, False],
    ).reset_index(drop=True)

    return merged


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path", nargs="?", default=str(Path(__file__).resolve().parent / "Match1.json"))
    parser.add_argument("--out", default=None, help="Optional explicit output CSV path")
    args = parser.parse_args()

    json_path = Path(args.json_path)
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    df = simulate_points(data)
    out_name = args.out if args.out else _match_output_name(data)
    out_path = Path(__file__).resolve().parent / out_name
    written = _write_csv(df, out_path)

    print(f"Wrote {len(df)} outfield players -> {written}")
    print(df.head(15).to_string(index=False))


if __name__ == "__main__":
    main()

