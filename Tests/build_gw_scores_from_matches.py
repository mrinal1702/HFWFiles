from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd


_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from Calculate_stat_points import calculate_stat_points
from calculate_endowed_points import calculate_endowed_points
from calculate_keeper_points import compute_keeper_endowed_points, compute_keeper_stat_points, pick_best_stat_gk_per_team
from keeper_stat_collection import keeper_stat_collection


MATCHES_DIR = Path(r"C:\Users\trive\HFWFiles\Matches_Raw\CL_RO16_Leg2")
OUT_DIR = Path(r"C:\Users\trive\HFWFiles\Scores")
OUT_FILE = OUT_DIR / "CL_RO16_Leg2_GW1_scores.csv"
GW_ID = 1


def _slug_team(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def _match_label(data: dict[str, Any]) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{_slug_team(home)}_{_slug_team(away)}"


def score_outfield(match_data: dict[str, Any]) -> pd.DataFrame:
    stat_df = calculate_stat_points(match_data)
    end_df = calculate_endowed_points(match_data)

    stat_keep = stat_df[
        [
            "player_id",
            "player_name",
            "team_id",
            "team_name",
            "stat_points_total",
        ]
    ].copy()
    end_keep = end_df[["player_id", "endowed_points"]].copy()

    merged = stat_keep.merge(end_keep, on="player_id", how="left")
    merged["endowed_points"] = merged["endowed_points"].fillna(0.0)
    merged["score"] = merged["stat_points_total"] + merged["endowed_points"]

    return merged[["player_id", "player_name", "team_id", "team_name", "score"]]


def score_keepers_as_team_units(match_data: dict[str, Any]) -> pd.DataFrame:
    keepers = keeper_stat_collection(match_data)
    if keepers.empty:
        return pd.DataFrame(columns=["player_id", "player_name", "team_id", "team_name", "score"])

    keepers_scored = compute_keeper_stat_points(keepers)
    keepers_endowed = compute_keeper_endowed_points(match_data, keepers_scored)
    best = pick_best_stat_gk_per_team(keepers_endowed)
    best["score"] = best["stat_points_total"] + best["endowed_points"]

    # Existing project rule: represent each team's keeper unit as one row.
    out = pd.DataFrame(
        {
            "player_id": best["team_id"],
            "player_name": best["team_name"].astype(str) + " Keepers",
            "team_id": best["team_id"],
            "team_name": best["team_name"],
            "score": best["score"],
        }
    )
    return out


def main() -> None:
    json_files = sorted(MATCHES_DIR.glob("*.json"))
    if not json_files:
        raise FileNotFoundError(f"No JSON files found in {MATCHES_DIR}")

    all_rows: list[pd.DataFrame] = []
    for fp in json_files:
        with fp.open("r", encoding="utf-8") as f:
            match_data = json.load(f)

        outfield = score_outfield(match_data)
        keepers = score_keepers_as_team_units(match_data)
        combined = pd.concat([outfield, keepers], ignore_index=True)
        combined["gw_id"] = GW_ID
        all_rows.append(combined)

        print(f"Scored {fp.name}: outfield={len(outfield)}, keepers={len(keepers)}, total={len(combined)}")

    final_df = pd.concat(all_rows, ignore_index=True)
    final_df["score"] = final_df["score"].round().astype(int)

    final_df = final_df[
        ["player_id", "player_name", "team_id", "team_name", "score", "gw_id"]
    ].sort_values(["team_name", "score"], ascending=[True, False])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        final_df.to_csv(OUT_FILE, index=False, encoding="utf-8")
        written = OUT_FILE
    except PermissionError:
        alt = OUT_DIR / "export_run" / OUT_FILE.name
        alt.parent.mkdir(parents=True, exist_ok=True)
        final_df.to_csv(alt, index=False, encoding="utf-8")
        written = alt
        print(f"Warning: {OUT_FILE} was in use. Wrote {written} instead.")

    print(f"\nWrote {len(final_df)} rows -> {written}")
    print(final_df.head(20).to_string(index=False))


if __name__ == "__main__":
    main()
