#!/usr/bin/env python3
"""
Regenerate *_FinalPoints.csv from match JSON files (any folder).

Uses the same merge path as fetch_fotmob_match --score and presentation_final_points.

Usage (repo root):
  python scripts/rescore_finalpoints.py --matches-dir "Matches_Raw/World Cup 2026"
  python scripts/rescore_finalpoints.py --matches-dir "Matches_Raw/World Cup 2026" --copy-to-app
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "Tests"
sys.path.insert(0, str(TESTS))

from calculate_keeper_points import (  # noqa: E402
    build_keeper_unit_rows,
    compute_keeper_endowed_points,
    compute_keeper_stat_points,
)
from final_points import merge_outfield_and_keepers  # noqa: E402
from keeper_stat_collection import keeper_stat_collection  # noqa: E402
from point_simulator import simulate_points  # noqa: E402

APP_SCORES = ROOT / "auction-app" / "data" / "match-scores"


def _slug_team(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def match_base_name(data: dict) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{_slug_team(home)}_{_slug_team(away)}"


def build_final_points(match_data: dict) -> pd.DataFrame:
    outfield = simulate_points(match_data)

    keepers = keeper_stat_collection(match_data)
    if keepers.empty:
        keeper_units = pd.DataFrame(
            columns=[
                "team_id",
                "team_name",
                "stat_points_total",
                "endowed_points",
                "total_points",
            ]
        )
    else:
        keepers_scored = compute_keeper_stat_points(keepers)
        keepers_endowed = compute_keeper_endowed_points(match_data, keepers_scored)
        keeper_units = build_keeper_unit_rows(keepers_endowed)

    return merge_outfield_and_keepers(outfield, keeper_units, validate=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate FinalPoints CSVs from match JSON.")
    parser.add_argument(
        "--matches-dir",
        type=Path,
        default=ROOT / "Matches_Raw" / "World Cup 2026",
        help="Folder containing *_Vs_*.json match files",
    )
    parser.add_argument(
        "--copy-to-app",
        action="store_true",
        help="Also copy to auction-app/data/match-scores/ when that folder exists.",
    )
    args = parser.parse_args()

    match_dir = args.matches_dir.resolve()
    json_files = sorted(
        p
        for p in match_dir.glob("*.json")
        if "manifest" not in p.name.lower() and ("_Vs_" in p.name or "_vs_" in p.name)
    )
    if not json_files:
        raise SystemExit(f"No match JSON files in {match_dir}")

    print(f"Rescoring {len(json_files)} matches -> {match_dir}\n")

    for fp in json_files:
        data = json.loads(fp.read_text(encoding="utf-8"))
        base = match_base_name(data)
        out_path = match_dir / f"{base}_FinalPoints.csv"
        df = build_final_points(data)
        df.to_csv(out_path, index=False, encoding="utf-8")
        print(f"  {fp.name} -> {out_path.name} ({len(df)} rows)")

        if args.copy_to_app:
            app_path = APP_SCORES / f"{base}_FinalPoints.csv"
            if app_path.parent.is_dir():
                shutil.copy2(out_path, app_path)

    print(f"\nDone. {len(json_files)} FinalPoints files written.")


if __name__ == "__main__":
    main()
