"""
Calculate goalkeeper points end-to-end:
1) collect goalkeeper stats from match JSON
2) compute stat-based points
3) compute endowed points per team and assign to the best-stat GK for that team

Output CSV: <HomeTeamNoSpaces>_<AwayTeamNoSpaces>_KeeperPoints.csv in `Tests/`.
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

from scoring.goalkeeper_points import GOALKEEPER_FORMULAS, GOALKEEPER_SCORING, GOALKEEPER_WEIGHTS
from keeper_stat_collection import keeper_stat_collection


def _slug_team(name: str) -> str:
    if not name:
        return "Unknown"
    compact = re.sub(r"[^A-Za-z0-9]+", "", name)
    return compact or "Unknown"


def _match_output_name(data: dict[str, Any]) -> str:
    home = (data.get("general") or {}).get("homeTeam", {}).get("name") or "Home"
    away = (data.get("general") or {}).get("awayTeam", {}).get("name") or "Away"
    return f"{_slug_team(home)}_{_slug_team(away)}_KeeperPoints.csv"


def _safe_num(v: Any) -> float:
    if v is None:
        return 0.0
    if pd.isna(v):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def compute_keeper_stat_points(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["stat_points_weighted"] = 0.0

    weights: dict[str, float] = GOALKEEPER_WEIGHTS
    for metric, w in weights.items():
        # keeper_stat_collection outputs these columns by metric name
        if metric not in out.columns:
            continue
        out["stat_points_weighted"] += out[metric].apply(_safe_num) * float(w)

    # minutes term
    mpp = float(GOALKEEPER_FORMULAS["minutes_per_point"])
    if "minutes_played" in out.columns:
        out["stat_points_minutes"] = out["minutes_played"].apply(_safe_num) * mpp
    else:
        out["stat_points_minutes"] = 0.0

    out["stat_points_total"] = out["stat_points_weighted"] + out["stat_points_minutes"]
    return out


def compute_keeper_endowed_points(match_data: dict[str, Any], keepers_df: pd.DataFrame) -> pd.DataFrame:
    """
    Endowment per your rule:
    - Normal: 18 - 6 * goals_conceded_by_team
    - If a single GK played (<45 minutes), halve baseline to 9 when minutes < 45.
    - If multiple GKs played for that team, treat GK endowment as a single unit over the full 90 minutes:
      use base 18 (no halving) regardless of individual GK minutes.
    """
    header_teams = ((match_data.get("header") or {}).get("teams") or [])
    home_id = (match_data.get("general") or {}).get("homeTeam", {}).get("id")
    away_id = (match_data.get("general") or {}).get("awayTeam", {}).get("id")

    # determine team scores (goals for)
    team_score: dict[int, int] = {}
    for t in header_teams:
        if not isinstance(t, dict):
            continue
        tid = t.get("id")
        sc = t.get("score")
        try:
            tid_i = int(tid)
            sc_i = int(sc)
        except (TypeError, ValueError):
            continue
        team_score[tid_i] = sc_i

    try:
        home_id_i = int(home_id)
        away_id_i = int(away_id)
    except (TypeError, ValueError):
        home_id_i, away_id_i = None, None

    if home_id_i is None or away_id_i is None:
        # fallback: if ids missing, do nothing
        keepers_df["endowed_points"] = 0.0
        return keepers_df

    home_conceded = team_score.get(away_id_i, 0)
    away_conceded = team_score.get(home_id_i, 0)

    def endowed_for_team(team_id: int) -> float:
        conceded = home_conceded if team_id == home_id_i else away_conceded
        return 18.0 - 6.0 * conceded

    # Determine number of goalkeepers who actually played for each team (minutes > 0)
    keepers_df = keepers_df.copy()
    keepers_df["minutes_played"] = keepers_df["minutes_played"].apply(_safe_num)

    endowment_rows: list[dict[str, Any]] = []
    for team_id in keepers_df["team_id"].dropna().unique().tolist():
        team_id_i = int(team_id)
        team_keepers = keepers_df[keepers_df["team_id"] == team_id_i].copy()
        # treat NaN as 0 in minutes
        played = team_keepers[team_keepers["minutes_played"] > 0]
        multiple = len(played) > 1
        base = 18.0 if multiple else 18.0
        conceded = home_conceded if team_id_i == home_id_i else away_conceded

        if not multiple:
            # single GK: apply halving if minutes < 45
            if len(played) == 1:
                mins = float(played.iloc[0]["minutes_played"])
                if mins < 45:
                    base = 9.0

        endowed = base - 6.0 * conceded
        endowment_rows.append({"team_id": team_id_i, "endowed_points": endowed})

    endowment_df = pd.DataFrame(endowment_rows)
    keepers_df = keepers_df.merge(endowment_df, on="team_id", how="left")
    keepers_df["endowed_points"] = keepers_df["endowed_points"].apply(_safe_num)
    return keepers_df


def pick_best_stat_gk_per_team(keepers_df: pd.DataFrame) -> pd.DataFrame:
    out_rows: list[pd.DataFrame] = []
    for team_id, team_df in keepers_df.groupby("team_id"):
        # best-stat keeper for stat side
        best_idx = team_df["stat_points_total"].astype(float).idxmax()
        out_rows.append(team_df.loc[[best_idx]])
    return pd.concat(out_rows, ignore_index=True)


def _write_csv(df: pd.DataFrame, path: Path) -> Path:
    try:
        df.to_csv(path, index=False, encoding="utf-8")
        return path
    except PermissionError:
        alt = path.parent / "export_run" / path.name
        alt.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(alt, index=False, encoding="utf-8")
        return alt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    path = Path(args.json_path)
    with open(path, "r", encoding="utf-8") as f:
        match_data = json.load(f)

    # Collect keeper stats
    keepers = keeper_stat_collection(match_data)
    if keepers.empty:
        print("No goalkeeper rows found.")
        return

    # Stat points
    keepers_scored = compute_keeper_stat_points(keepers)

    # Endowment points per team
    keepers_endowed = compute_keeper_endowed_points(match_data, keepers_scored)

    # Apply rule: only best-stat GK gets endowment (stat points already computed for each GK)
    best = pick_best_stat_gk_per_team(keepers_endowed)
    best["total_points"] = best["stat_points_total"] + best["endowed_points"]

    # Ensure readable column order
    cols = [
        "player_id",
        "player_name",
        "team_id",
        "team_name",
        "minutes_played",
        "stat_points_total",
        "endowed_points",
        "total_points",
    ]
    for c in cols:
        if c not in best.columns:
            best[c] = 0
    best = best[cols].sort_values(by=["total_points"], ascending=False).reset_index(drop=True)

    out_name = args.out if args.out else _match_output_name(match_data)
    out_path = Path(__file__).resolve().parent / out_name
    written = _write_csv(best, out_path)

    print(f"Wrote goalkeeper points -> {written}")
    print(best.to_string(index=False))


if __name__ == "__main__":
    main()

