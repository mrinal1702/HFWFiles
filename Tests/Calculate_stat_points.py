"""
Calculate stat-based points for all outfield players from a match JSON.

Uses:
- `stat_collection.py` for extraction
- scoring configs in `scoring/`
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

# ensure repo root import path
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from scoring import DEFENDER_SCORING, MIDFIELDER_SCORING, FORWARDS_SCORING
from stat_collection import stat_collection


def _safe_num(v: Any) -> float:
    if pd.isna(v):
        return 0.0
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    return 0.0


def _apply_scoring(df: pd.DataFrame, cfg: dict[str, Any], role: str) -> pd.DataFrame:
    out = df.copy()
    out["role"] = role
    out["stat_points_weighted"] = 0.0

    stat_keys: dict[str, str] = cfg.get("stat_keys", {})
    weights: dict[str, float] = cfg.get("weights", {})
    formulas: dict[str, float] = cfg.get("formulas", {})

    for logical_key, weight in weights.items():
        col = stat_keys.get(logical_key)
        if not col or col not in out.columns:
            continue
        out["stat_points_weighted"] += out[col].apply(_safe_num) * float(weight)

    # formula: dispossessed_base - dispossessed_per_event * dispossessed
    disp_base = formulas.get("dispossessed_base")
    disp_per = formulas.get("dispossessed_per_event")
    disp_col = stat_keys.get("dispossessed", "dispossessed")
    if disp_base is not None and disp_per is not None and disp_col in out.columns:
        out["stat_points_dispossessed_formula"] = float(disp_base) - out[disp_col].apply(_safe_num) * float(disp_per)
    else:
        out["stat_points_dispossessed_formula"] = 0.0

    # formula: minutes_per_point * minutes_played
    mpp = formulas.get("minutes_per_point")
    min_col = stat_keys.get("minutes_played", "minutes_played")
    if mpp is not None and min_col in out.columns:
        out["stat_points_minutes"] = out[min_col].apply(_safe_num) * float(mpp)
    else:
        out["stat_points_minutes"] = 0.0

    out["stat_points_total"] = (
        out["stat_points_weighted"]
        + out["stat_points_dispossessed_formula"]
        + out["stat_points_minutes"]
    )
    return out


def calculate_stat_points(match_data: dict[str, Any]) -> pd.DataFrame:
    d, m, f = stat_collection(match_data)

    d_scored = _apply_scoring(d, DEFENDER_SCORING, "defender")
    m_scored = _apply_scoring(m, MIDFIELDER_SCORING, "midfielder")
    f_scored = _apply_scoring(f, FORWARDS_SCORING, "forward")

    all_df = pd.concat([d_scored, m_scored, f_scored], ignore_index=True)
    all_df = all_df[all_df.get("usual_playing_position_id", 0) != 0].copy()
    return all_df


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

    df = calculate_stat_points(data)
    out_path = Path(args.out) if args.out else path.parent / "stat_points_all_outfield.csv"
    written = _write_csv(df, out_path)
    print(f"Wrote {len(df)} rows -> {written}")


if __name__ == "__main__":
    main()

