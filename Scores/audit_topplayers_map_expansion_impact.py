"""Compare GW1 points before/after topPlayers map expansion for changed roles."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "Tests"))
sys.path.insert(0, str(ROOT / "procedures"))

from formation_match_roles import load_match_json, outfield_roles_by_player_for_match
from point_simulator import simulate_points

MATCH_DIR = ROOT / "Matches_Raw" / "World Cup 2026"


def load_final_points() -> dict[int, int]:
    scores: dict[int, int] = {}
    for fp in MATCH_DIR.glob("*_FinalPoints.csv"):
        df = pd.read_csv(fp)
        for _, row in df.iterrows():
            if str(row.get("position", "")).lower() == "goalkeeper":
                continue
            try:
                pid = int(row["player_id"])
                scores[pid] = int(row["final_score"])
            except (TypeError, ValueError):
                continue
    return scores


def main() -> None:
    old_scores = load_final_points()
    changed: list[dict] = []

    for fp in sorted(MATCH_DIR.glob("*.json")):
        if "manifest" in fp.name.lower() or "_Vs_" not in fp.name:
            continue
        data = load_match_json(fp)
        new_df = simulate_points(data)
        for _, row in new_df.iterrows():
            pid = int(row["player_id"])
            new_pts = int(round(max(0, float(row["total_points"]))))
            old_pts = old_scores.get(pid)
            if old_pts is None or old_pts == new_pts:
                continue
            changed.append(
                {
                    "player_id": pid,
                    "player_name": row["player_name"],
                    "team_name": row["team_name"],
                    "match": fp.stem.replace("_Vs_", " vs "),
                    "old_role": None,
                    "new_role": row.get("role"),
                    "old_points": old_pts,
                    "new_points": new_pts,
                    "delta": new_pts - old_pts,
                }
            )

    changed.sort(key=lambda x: -abs(x["delta"]))
    out = ROOT / "Scores" / "gw1_topplayers_map_expansion_impact.json"
    out.write_text(json.dumps(changed, indent=2), encoding="utf-8")
    print(f"Players with point change: {len(changed)}")
    for r in changed[:30]:
        print(
            f"  {r['player_name']} ({r['player_id']}) | {r['match']} | "
            f"{r['old_points']} -> {r['new_points']} ({r['delta']:+d}) role {r['new_role']}"
        )
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
