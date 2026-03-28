"""
Collect goalkeeper-only stats from a FotMob-style match JSON.

Output CSV default:
    Tests/keeper_stat_collection.csv
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


TESTS_DIR = Path(__file__).resolve().parent
DEFAULT_JSON = TESTS_DIR / "Match1.json"
OUT_CSV = TESTS_DIR / "keeper_stat_collection.csv"

# playerStats keys
KEY_MINUTES = "minutes_played"
KEY_SAVES = "saves"
KEY_ACCURATE_PASSES = "accurate_passes"
KEY_LONG_BALLS_ACCURATE = "long_balls_accurate"
KEY_CLEARANCES = "clearances"
KEY_INTERCEPTIONS = "interceptions"
KEY_TACKLES = "matchstats.headers.tackles"
KEY_PUNCHES = "punches"
KEY_HIGH_CLAIM = "keeper_high_claim"


def _safe_num(v: Any) -> float | int | None:
    if isinstance(v, (int, float)):
        return v
    return None


def _extract_stat_map(player_blob: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for sec in player_blob.get("stats") or []:
        if not isinstance(sec, dict):
            continue
        blk = sec.get("stats")
        if not isinstance(blk, dict):
            continue
        for _label, ent in blk.items():
            if not isinstance(ent, dict):
                continue
            k = ent.get("key")
            if not k or k in out:
                continue
            st = ent.get("stat") or {}
            if not isinstance(st, dict):
                st = {}
            out[k] = {
                "value": st.get("value"),
                "total": st.get("total"),
            }
    return out


def _v(m: dict[str, dict[str, Any]], key: str) -> float | int | None:
    s = m.get(key) or {}
    return _safe_num(s.get("value"))


def _t(m: dict[str, dict[str, Any]], key: str) -> float | int | None:
    s = m.get(key) or {}
    return _safe_num(s.get("total"))


def _v0(m: dict[str, dict[str, Any]], key: str) -> float | int:
    v = _v(m, key)
    return 0 if v is None else v


def _t0(m: dict[str, dict[str, Any]], key: str) -> float | int:
    v = _t(m, key)
    return 0 if v is None else v


def _inaccurate_passes(m: dict[str, dict[str, Any]]) -> float | int | None:
    val = _v(m, KEY_ACCURATE_PASSES)
    tot = _t(m, KEY_ACCURATE_PASSES)
    if val is None or tot is None:
        return None
    return tot - val


def keeper_stat_collection(match_data: dict[str, Any]) -> pd.DataFrame:
    content = match_data.get("content") or {}
    ps = content.get("playerStats") or {}
    rows: list[dict[str, Any]] = []

    for _pid, p in ps.items():
        if not isinstance(p, dict):
            continue
        if p.get("isGoalkeeper") is not True:
            continue
        pid = p.get("id")
        try:
            pid_i = int(pid)
        except (TypeError, ValueError):
            continue

        m = _extract_stat_map(p)
        rows.append(
            {
                "player_id": pid_i,
                "player_name": p.get("name"),
                "team_id": p.get("teamId"),
                "team_name": p.get("teamName"),
                "is_goalkeeper": True,
                "minutes_played": _v(m, KEY_MINUTES),
                "saves": _v0(m, KEY_SAVES),
                "accurate_passes": _v(m, KEY_ACCURATE_PASSES),
                "inaccurate_passes": _inaccurate_passes(m),
                "clearances": _v0(m, KEY_CLEARANCES),
                "interceptions": _v0(m, KEY_INTERCEPTIONS),
                "tackles": _v0(m, KEY_TACKLES),
                "accurate_long_balls": _v0(m, KEY_LONG_BALLS_ACCURATE),
                "accurate_long_balls_attempted": _t0(m, KEY_LONG_BALLS_ACCURATE),
                "punches": _v0(m, KEY_PUNCHES),
                "high_claim": _v0(m, KEY_HIGH_CLAIM),
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
    parser.add_argument("json_path", nargs="?", default=str(DEFAULT_JSON))
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    json_path = Path(args.json_path)
    with open(json_path, "r", encoding="utf-8") as f:
        d = json.load(f)

    df = keeper_stat_collection(d)
    out = Path(args.out) if args.out else OUT_CSV
    written = _write_csv(df, out)
    print(f"Input: {json_path}")
    print(f"Wrote {len(df)} goalkeeper rows -> {written}")
    if not df.empty:
        print(df.to_string(index=False))


if __name__ == "__main__":
    main()

