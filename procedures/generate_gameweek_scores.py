from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parent.parent
TESTS_DIR = ROOT / "Tests"
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

from Calculate_stat_points import calculate_stat_points
from calculate_endowed_points import calculate_endowed_points
from calculate_keeper_points import (
    compute_keeper_endowed_points,
    compute_keeper_stat_points,
    pick_best_stat_gk_per_team,
)
from keeper_stat_collection import keeper_stat_collection


def _slug(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def _match_label(data: dict[str, Any]) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{_slug(home)}_{_slug(away)}"


def _score_outfield(match_data: dict[str, Any]) -> pd.DataFrame:
    stat_df = calculate_stat_points(match_data)
    end_df = calculate_endowed_points(match_data)

    stat_keep = stat_df[
        ["player_id", "player_name", "team_id", "team_name", "stat_points_total"]
    ].copy()
    end_keep = end_df[["player_id", "endowed_points"]].copy()

    merged = stat_keep.merge(end_keep, on="player_id", how="left")
    merged["endowed_points"] = merged["endowed_points"].fillna(0.0)
    merged["score"] = merged["stat_points_total"] + merged["endowed_points"]
    return merged[["player_id", "player_name", "team_id", "team_name", "score"]]


def _score_keeper_units(match_data: dict[str, Any]) -> pd.DataFrame:
    keepers = keeper_stat_collection(match_data)
    if keepers.empty:
        return pd.DataFrame(
            columns=["player_id", "player_name", "team_id", "team_name", "score"]
        )

    keepers_scored = compute_keeper_stat_points(keepers)
    keepers_endowed = compute_keeper_endowed_points(match_data, keepers_scored)
    best = pick_best_stat_gk_per_team(keepers_endowed)
    best["score"] = best["stat_points_total"] + best["endowed_points"]

    # Existing project convention: one "keeper unit" row per team.
    return pd.DataFrame(
        {
            "player_id": best["team_id"],
            "player_name": best["team_name"].astype(str) + " Keepers",
            "team_id": best["team_id"],
            "team_name": best["team_name"],
            "score": best["score"],
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Procedure: Generate gameweek player scores from raw match JSON folder."
    )
    parser.add_argument(
        "--matches-dir",
        required=True,
        help=r"Folder containing match JSON files (e.g. C:\...\Matches_Raw\CL_RO16_Leg2)",
    )
    parser.add_argument("--gw-id", required=True, type=int, help="Game week ID for output rows.")
    parser.add_argument(
        "--output",
        default=None,
        help=r"Optional output CSV path (default: C:\...\Scores\GW<id>_scores.csv)",
    )
    args = parser.parse_args()

    matches_dir = Path(args.matches_dir)
    if not matches_dir.exists():
        raise FileNotFoundError(f"Matches folder not found: {matches_dir}")

    json_files = sorted(matches_dir.glob("*.json"))
    if not json_files:
        raise FileNotFoundError(f"No JSON files found in: {matches_dir}")

    out_path = (
        Path(args.output)
        if args.output
        else ROOT / "Scores" / f"GW{args.gw_id}_scores.csv"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    all_rows: list[pd.DataFrame] = []
    for fp in json_files:
        with fp.open("r", encoding="utf-8") as f:
            data = json.load(f)

        outfield = _score_outfield(data)
        keepers = _score_keeper_units(data)
        combined = pd.concat([outfield, keepers], ignore_index=True)
        combined["gw_id"] = args.gw_id
        all_rows.append(combined)

        print(
            f"{fp.name}: outfield={len(outfield)}, keeper_units={len(keepers)}, total={len(combined)}"
        )

    final_df = pd.concat(all_rows, ignore_index=True)
    final_df["score"] = final_df["score"].round().astype(int)
    final_df = final_df[
        ["player_id", "player_name", "team_id", "team_name", "score", "gw_id"]
    ].sort_values(["team_name", "score"], ascending=[True, False])

    final_df.to_csv(out_path, index=False, encoding="utf-8")
    print(f"\nWrote {len(final_df)} rows -> {out_path}")


if __name__ == "__main__":
    main()
