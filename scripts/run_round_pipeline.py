"""
Run the local scoring pipeline for all match JSON files in a round folder.

Steps per match:
  1) stat_collection → one combined outfield CSV (stat_collection_outfield.csv)
  2) point_simulator → <Home>_<Away>_Points.csv (stat + endowed)

Then builds a single GW upload CSV (outfield + keeper team units), same rules as
Tests/build_gw_scores_from_matches.py.

Outputs go under Scores/<round_folder_name>/ — never under Tests/.

Usage (from repo root HFWFiles):
  python scripts/run_round_pipeline.py
  python scripts/run_round_pipeline.py --matches-dir "Matches_Raw/CL_RO16_Leg2" --gw-id 1
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pandas as pd

_REPO_ROOT = Path(__file__).resolve().parent.parent
_TESTS = _REPO_ROOT / "Tests"
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from build_gw_scores_from_matches import (  # noqa: E402
    score_outfield,
    score_keepers_as_team_units,
)
from point_simulator import simulate_points  # noqa: E402
from stat_collection import stat_collection  # noqa: E402


def _slug_team(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def _match_label(data: dict) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{_slug_team(home)}_{_slug_team(away)}"


def _points_filename(data: dict) -> str:
    return f"{_match_label(data)}_Points.csv"


def _write_csv(df: pd.DataFrame, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        df.to_csv(path, index=False, encoding="utf-8")
        return path
    except PermissionError:
        alt = path.parent / "export_run" / path.name
        alt.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(alt, index=False, encoding="utf-8")
        print(f"Warning: {path} was in use. Wrote {alt} instead.")
        return alt


def _combined_outfield_csv(defenders: pd.DataFrame, midfielders: pd.DataFrame, forwards: pd.DataFrame) -> pd.DataFrame:
    parts = []
    if not defenders.empty:
        parts.append(defenders.assign(stat_role="Defender"))
    if not midfielders.empty:
        parts.append(midfielders.assign(stat_role="Midfielder"))
    if not forwards.empty:
        parts.append(forwards.assign(stat_role="Forward"))
    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, ignore_index=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run stat extraction + points per match; then GW rollup CSV.")
    parser.add_argument(
        "--matches-dir",
        type=Path,
        default=_REPO_ROOT / "Matches_Raw" / "CL_RO16_Leg2",
        help="Folder containing match *.json files",
    )
    parser.add_argument(
        "--scores-root",
        type=Path,
        default=_REPO_ROOT / "Scores",
        help="Root folder for outputs (creates a subfolder per round)",
    )
    parser.add_argument(
        "--round-name",
        type=str,
        default=None,
        help="Subfolder under scores-root (default: matches-dir folder name, e.g. CL_RO16_Leg2)",
    )
    parser.add_argument("--gw-id", type=int, default=1, help="gw_id column in the combined GW CSV")
    parser.add_argument(
        "--gw-out-name",
        type=str,
        default=None,
        help="Filename for combined GW CSV (default: <round_name>_GW<gw_id>_scores.csv)",
    )
    parser.add_argument(
        "--skip-gw-rollup",
        action="store_true",
        help="Only per-match exports; do not write combined GW CSV",
    )
    args = parser.parse_args()

    matches_dir = args.matches_dir.resolve()
    if not matches_dir.is_dir():
        raise SystemExit(f"Not a directory: {matches_dir}")

    round_name = args.round_name or matches_dir.name
    round_out = args.scores_root.resolve() / round_name
    matches_out = round_out / "matches"
    gw_out = round_out / (args.gw_out_name or f"{round_name}_GW{args.gw_id}_scores.csv")

    json_files = sorted(matches_dir.glob("*.json"))
    if not json_files:
        raise SystemExit(f"No JSON files in {matches_dir}")

    print(f"Matches: {matches_dir} ({len(json_files)} files)")
    print(f"Outputs: {round_out}\n")

    for fp in json_files:
        with fp.open("r", encoding="utf-8") as f:
            match_data = json.load(f)

        label = _match_label(match_data)
        match_dir = matches_out / label

        defenders, midfielders, forwards = stat_collection(match_data)
        combined = _combined_outfield_csv(defenders, midfielders, forwards)
        stat_path = match_dir / "stat_collection_outfield.csv"
        if combined.empty:
            print(f"{fp.name}: stat_collection produced no outfield rows (unexpected?)")
        else:
            _write_csv(combined, stat_path)
            print(f"{fp.name}: stat_collection_outfield.csv -> {len(combined)} rows -> {stat_path}")

        points_df = simulate_points(match_data)
        points_path = match_dir / _points_filename(match_data)
        _write_csv(points_df, points_path)
        print(f"{fp.name}: Points -> {len(points_df)} rows -> {points_path}\n")

    if args.skip_gw_rollup:
        print("Skipped GW rollup (--skip-gw-rollup).")
        return

    all_rows: list[pd.DataFrame] = []
    for fp in json_files:
        with fp.open("r", encoding="utf-8") as f:
            match_data = json.load(f)
        outfield = score_outfield(match_data)
        keepers = score_keepers_as_team_units(match_data)
        combined = pd.concat([outfield, keepers], ignore_index=True)
        combined["gw_id"] = args.gw_id
        all_rows.append(combined)
        print(f"GW rollup: {fp.name} outfield={len(outfield)}, keepers={len(keepers)}")

    final_df = pd.concat(all_rows, ignore_index=True)
    final_df["score"] = final_df["score"].round().astype(int)
    final_df = final_df[
        ["player_id", "player_name", "team_id", "team_name", "score", "gw_id"]
    ].sort_values(["team_name", "score"], ascending=[True, False])

    round_out.mkdir(parents=True, exist_ok=True)
    written = _write_csv(final_df, gw_out)
    print(f"\nWrote GW CSV: {len(final_df)} rows -> {written}")


if __name__ == "__main__":
    main()
