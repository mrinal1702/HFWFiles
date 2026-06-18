"""
Regenerate *_FinalPoints.csv for all World Cup GW1 match JSONs.

Uses updated position_roles (stat + endowment + role column).

Usage (repo root):
  python scripts/rescore_wc_gw1_finalpoints.py
  python scripts/rescore_wc_gw1_finalpoints.py --copy-to-app
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
    compute_keeper_endowed_points,
    compute_keeper_stat_points,
    pick_best_stat_gk_per_team,
)
from keeper_stat_collection import keeper_stat_collection  # noqa: E402
from point_simulator import simulate_points  # noqa: E402

MATCH_DIR = ROOT / "Matches_Raw" / "World Cup 2026"
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
        keepers_final = pd.DataFrame(
            columns=[
                "player_name",
                "player_id",
                "team_name",
                "position",
                "stats_score",
                "endowment_score",
                "final_score_raw",
            ]
        )
    else:
        keepers_scored = compute_keeper_stat_points(keepers)
        keepers_endowed = compute_keeper_endowed_points(match_data, keepers_scored)
        best = pick_best_stat_gk_per_team(keepers_endowed)
        best = best.copy()
        best["total_points"] = (best["stat_points_total"] + best["endowed_points"]).clip(lower=0.0)
        best["player_name"] = best["team_name"].astype(str) + " Keepers"
        best["player_id"] = best["team_id"]
        best["position"] = "goalkeeper"
        keepers_final = best.rename(
            columns={
                "stat_points_total": "stats_score",
                "endowed_points": "endowment_score",
                "total_points": "final_score_raw",
            }
        )

    out_final = outfield.rename(
        columns={
            "role": "position",
            "stat_points_total": "stats_score",
            "endowed_points": "endowment_score",
            "total_points": "final_score_raw",
        }
    )[["player_name", "player_id", "team_name", "position", "stats_score", "endowment_score", "final_score_raw"]]

    merged = pd.concat([out_final, keepers_final], ignore_index=True)
    merged["final_score_raw"] = pd.to_numeric(merged["final_score_raw"], errors="coerce").fillna(0.0)
    merged["final_score"] = merged["final_score_raw"].round().clip(lower=0).astype(int)
    return merged[
        ["player_name", "player_id", "team_name", "position", "stats_score", "endowment_score", "final_score"]
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate WC GW1 FinalPoints CSVs.")
    parser.add_argument(
        "--copy-to-app",
        action="store_true",
        help="Also copy to auction-app/data/match-scores/ when that file exists.",
    )
    args = parser.parse_args()

    json_files = sorted(
        p
        for p in MATCH_DIR.glob("*.json")
        if "manifest" not in p.name.lower() and ("_Vs_" in p.name or "_vs_" in p.name)
    )
    if not json_files:
        raise SystemExit(f"No match JSON files in {MATCH_DIR}")

    affected_ids = {292462, 356406, 1735453, 442277, 1031656, 526827, 692984}
    print(f"Rescoring {len(json_files)} matches -> {MATCH_DIR}\n")

    for fp in json_files:
        data = json.loads(fp.read_text(encoding="utf-8"))
        base = match_base_name(data)
        out_path = MATCH_DIR / f"{base}_FinalPoints.csv"
        df = build_final_points(data)
        df.to_csv(out_path, index=False, encoding="utf-8")

        hits = df[df["player_id"].isin(affected_ids)][["player_name", "position", "final_score"]]
        print(f"  {fp.name} -> {out_path.name} ({len(df)} rows)")
        for _, row in hits.iterrows():
            print(f"      {row['player_name']}: {row['position']} {int(row['final_score'])} pts")

        if args.copy_to_app:
            app_path = APP_SCORES / f"{base}_FinalPoints.csv"
            if app_path.parent.is_dir():
                shutil.copy2(out_path, app_path)

    print(f"\nDone. {len(json_files)} FinalPoints files written.")


if __name__ == "__main__":
    main()
