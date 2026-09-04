"""Audit penalty shootout saves vs FotMob JSON for RO32 matches."""
from __future__ import annotations

import json
import sys
from pathlib import Path

_TESTS = Path(__file__).resolve().parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from penalty_shootout_points import (  # noqa: E402
    SHOOTOUT_POINTS_SAVE,
    _player_id_from_event,
    _saved_penalties_in_shootout_from_stats,
    compute_penalty_shootout_points,
    extract_penalty_shootout_events,
)

ROOT = _TESTS.parent
MATCHES = [
    ("South Africa vs Canada", ROOT / "Matches_Raw/World Cup 2026/SouthAfrica_Vs_Canada.json"),
    ("Brazil vs Japan", ROOT / "Matches_Raw/World Cup 2026/Brazil_Vs_Japan.json"),
    ("Germany vs Paraguay", ROOT / "Matches_Raw/World Cup 2026/Germany_Vs_Paraguay.json"),
    ("Netherlands vs Morocco", ROOT / "Matches_Raw/World Cup 2026/Netherlands_Vs_Morocco.json"),
]


def gk_shootout_saves(data: dict) -> list[dict]:
    rows = []
    ps = (data.get("content") or {}).get("playerStats") or {}
    for blob in ps.values():
        if blob.get("isGoalkeeper") is not True:
            continue
        saves = 0
        for sec in blob.get("stats") or []:
            blk = sec.get("stats") or {}
            for ent in blk.values():
                if isinstance(ent, dict) and ent.get("key") == "saved_penalties_in_shootout":
                    saves = (ent.get("stat") or {}).get("value") or 0
        rows.append(
            {
                "name": blob.get("name"),
                "player_id": blob.get("id"),
                "team_id": blob.get("teamId"),
                "team_name": blob.get("teamName"),
                "saved_penalties_in_shootout": saves,
            }
        )
    return rows


def main() -> None:
    for label, path in MATCHES:
        print(f"\n{'=' * 60}")
        print(label)
        print("=" * 60)
        if not path.exists():
            print("  JSON not found")
            continue

        data = json.loads(path.read_text(encoding="utf-8"))
        events = extract_penalty_shootout_events(data)
        _, keeper_pts = compute_penalty_shootout_points(data)
        saves_by_team = _saved_penalties_in_shootout_from_stats(data)

        if not events:
            print("  No penalty shootout")
            continue

        scored = missed = 0
        for e in events:
            et = e.get("type")
            pid = _player_id_from_event(e)
            name = (e.get("player") or {}).get("name") or e.get("nameStr")
            sm = e.get("shotmapEvent") or {}
            if et == "Goal":
                scored += 1
                print(f"  GOAL +4: {name} (player_id={pid})")
            elif et == "MissedPenalty":
                missed += 1
                print(
                    f"  MISS -4: {name} (player_id={pid})"
                    f" shotmap={sm.get('eventType')} keeperId={sm.get('keeperId')}"
                )

        print(f"\n  Event totals: {scored} scored, {missed} missed")
        print("\n  FotMob GK shootout save stats:")
        for row in gk_shootout_saves(data):
            cnt = row["saved_penalties_in_shootout"]
            marker = " ***" if cnt else ""
            print(
                f"    {row['name']} (player_id={row['player_id']}, team_id={row['team_id']}, "
                f"{row['team_name']}): saved_penalties_in_shootout={cnt}{marker}"
            )

        print("\n  Applied to keeper UNITS (team_id -> +6 per save):")
        for tid, pts in sorted(keeper_pts.items()):
            saves = int(pts / SHOOTOUT_POINTS_SAVE)
            print(f"    team_id {tid}: {saves} save(s) -> shootout_score +{int(pts)}")


if __name__ == "__main__":
    main()
