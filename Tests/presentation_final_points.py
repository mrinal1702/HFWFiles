"""
Presentation step: merge outfield + goalkeeper results into one final CSV.

Input:
  - a match JSON path

Reads:
  - `Tests/<Home>_<Away>_Points.csv` from `point_simulator.py`
  - `Tests/<Home>_<Away>_KeeperPoints.csv` from `calculate_keeper_points.py`

Output:
  - `Tests/<Home>_<Away>_FinalPoints.csv`

Output columns:
  - player_name
  - player_id
  - team_name
  - position (role / goalkeeper)
  - stats_score
  - endowment_score
  - final_score (rounded)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd


_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _slug_team(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def _match_output_name(data: dict[str, Any]) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{_slug_team(home)}_{_slug_team(away)}"


def _safe_read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path")
    args = parser.parse_args()

    json_path = Path(args.json_path)
    match_data = json.loads(json_path.read_text(encoding="utf-8"))
    base = _match_output_name(match_data)

    tests_dir = Path(__file__).resolve().parent
    outfield_path = tests_dir / f"{base}_Points.csv"
    keepers_path = tests_dir / f"{base}_KeeperPoints.csv"

    outfield = _safe_read_csv(outfield_path)
    keepers = _safe_read_csv(keepers_path)

    # Outfield: rename into requested schema
    out_keep_cols = {
        "player_name": "player_name",
        "player_id": "player_id",
        "team_name": "team_name",
        "role": "position",
        "stat_points_total": "stats_score",
        "endowed_points": "endowment_score",
        "total_points": "final_score_raw",
    }
    out_final = outfield[list(out_keep_cols.keys())].rename(columns=out_keep_cols)

    # Keepers: collapse the unit into one row per team
    # Our keeper CSV already picks the best-stat GK per team, and endowed_points is team-level.
    keepers = keepers.copy()
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

    # Round final score to nearest whole number
    merged["final_score"] = merged["final_score_raw"].round().astype(int)
    merged = merged.drop(columns=["final_score_raw"])

    # final column order
    merged = merged[
        [
            "player_name",
            "player_id",
            "team_name",
            "position",
            "stats_score",
            "endowment_score",
            "final_score",
        ]
    ]

    out_path = tests_dir / f"{base}_FinalPoints.csv"
    merged.to_csv(out_path, index=False, encoding="utf-8")

    print(f"Wrote merged final points -> {out_path}")
    print(merged.sort_values(["team_name", "final_score"], ascending=[True, False]).head(20).to_string(index=False))


if __name__ == "__main__":
    main()

