"""
Calculate endowed points table for all outfield players from a match JSON.

Wrapper over `endowed_points.py` logic to produce a DataFrame that can be merged
with stat points in `point_simulator.py`.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd

from endowed_points import (
    compute_on_field_and_goals,
    endowment_points_for_position,
    lineup_usual_position_by_player,
    player_meta_from_playerstats,
    role_override_by_player,
)


def calculate_endowed_points(match_data: dict[str, Any]) -> pd.DataFrame:
    content = match_data.get("content") or {}
    meta = player_meta_from_playerstats(content)
    pos_map = lineup_usual_position_by_player(content)
    overrides = role_override_by_player(content)
    states = compute_on_field_and_goals(match_data)

    rows: list[dict[str, Any]] = []
    for pid, st in states.items():
        if st.minutes <= 0:
            continue
        pos = overrides.get(pid, pos_map.get(pid))
        if pos not in (1, 2, 3):
            continue
        m = meta.get(pid, {})
        rows.append(
            {
                "player_id": pid,
                "player_name": m.get("player_name"),
                "team_id": m.get("team_id"),
                "team_name": m.get("team_name"),
                "usual_playing_position_id": pos,
                "minutes_played_derived": st.minutes,
                "goals_for_while_on_field": st.goals_for,
                "goals_against_while_on_field": st.goals_against,
                "endowed_points": endowment_points_for_position(pos, st.minutes, st.goals_for, st.goals_against),
            }
        )
    return pd.DataFrame(rows)


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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    path = Path(args.json_path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    df = calculate_endowed_points(data)
    out_path = Path(args.out) if args.out else path.parent / "endowed_points_all_outfield.csv"
    written = _write_csv(df, out_path)
    print(f"Wrote {len(df)} rows -> {written}")


if __name__ == "__main__":
    main()

