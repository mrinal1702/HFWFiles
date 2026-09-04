"""
Audit GW1 players whose counting role changed after position_roles map update.

Old rules: lineup usual + striker/winger(topPlayers) overrides only.
New rules: + LM/RM topPlayers -> MID, + granular positionId 85 -> MID.

Run from repo root: python Scores/audit_position_map_changes_gw1.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "Tests"))
sys.path.insert(0, str(ROOT / "procedures"))

from formation_match_roles import load_match_json
from position_roles import (
    GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD,
    WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS,
    lineup_granular_position_id_by_player,
    lineup_usual_position_by_player,
    resolve_outfield_position_id_for_scoring,
    role_override_by_player,
    _TOPPLAYER_MIDFIELDER_KEYS,
    _TOPPLAYER_STRIKER_KEYS,
    _TOPPLAYER_WINGER_KEYS,
)

ROLE = {1: "DEF", 2: "MID", 3: "FWD"}


def _resolve_old(content: dict[str, Any], pid: int, pdata: dict[str, Any]) -> int | None:
    if pdata.get("isGoalkeeper") is True:
        return None
    lineup_pos = lineup_usual_position_by_player(content)
    role_overrides = role_override_by_player(content)
    # Strip new LM/RM overrides from old behavior
    granular = lineup_granular_position_id_by_player(content)
    top = (content.get("matchFacts") or {}).get("topPlayers") or {}
    old_overrides: dict[int, int] = {}
    for bucket in ("homeTopPlayers", "awayTopPlayers"):
        for p in top.get(bucket) or []:
            if not isinstance(p, dict):
                continue
            try:
                pid_i = int(p["playerId"])
            except (TypeError, ValueError, KeyError):
                continue
            label_key = ((p.get("positionLabel") or {}).get("key") or "").strip().lower()
            if label_key in _TOPPLAYER_STRIKER_KEYS:
                old_overrides[pid_i] = 3
            elif label_key in _TOPPLAYER_WINGER_KEYS:
                g = granular.get(pid_i)
                if g is not None and g in WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS:
                    old_overrides[pid_i] = 2
            # LM/RM not applied in old version

    pos = lineup_pos.get(pid)
    if pos is None:
        up = pdata.get("usualPosition")
        if up is not None:
            pos = int(up)
    if pos is None or pos == 0 or pos not in (1, 2, 3):
        return None
    return old_overrides.get(pid, pos)


def _reason(content: dict[str, Any], pid: int, old: int, new: int) -> str:
    parts: list[str] = []
    granular = lineup_granular_position_id_by_player(content).get(pid)
    top = (content.get("matchFacts") or {}).get("topPlayers") or {}
    labels: list[str] = []
    for bucket in ("homeTopPlayers", "awayTopPlayers"):
        for p in top.get(bucket) or []:
            if p.get("playerId") == pid:
                pl = p.get("positionLabel") or {}
                labels.append(f"{pl.get('label', '?')} ({pl.get('key', '?')})")
    if granular in GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD and new == 2 and old != 2:
        parts.append(f"positionId={granular}")
    for lab in labels:
        if "leftmidfielder" in lab or "rightmidfielder" in lab:
            parts.append(f"topPlayers {lab}")
    return "; ".join(parts) if parts else "rule change"


def load_master() -> dict[int, dict[str, str]]:
    out: dict[int, dict[str, str]] = {}
    path = ROOT / "Player_List" / "master_player_list.csv"
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                pid = int(row["player_id"])
            except (TypeError, ValueError, KeyError):
                continue
            out[pid] = {
                "player_name": (row.get("player_name") or "").strip(),
                "team_name": (row.get("team_name") or "").strip(),
                "position": (row.get("position") or "").strip(),
            }
    return out


def main() -> None:
    match_dir = ROOT / "Matches_Raw" / "World Cup 2026"
    master = load_master()
    affected: list[dict[str, Any]] = []
    seen: set[tuple[int, str]] = set()

    for fp in sorted(match_dir.glob("*.json")):
        if "manifest" in fp.name.lower():
            continue
        if "_Vs_" not in fp.name and "_vs_" not in fp.name:
            continue
        match_label = fp.stem.replace("_Vs_", " vs ")
        data = load_match_json(fp)
        content = data.get("content") or {}
        player_stats = content.get("playerStats") or {}

        for pid_str, pdata in player_stats.items():
            if not isinstance(pdata, dict):
                continue
            try:
                pid = int(pdata.get("id", pid_str))
            except (TypeError, ValueError):
                continue
            old = _resolve_old(content, pid, pdata)
            new = resolve_outfield_position_id_for_scoring(content, pid, pdata)
            if old is None or new is None or old == new:
                continue
            key = (pid, fp.name)
            if key in seen:
                continue
            seen.add(key)
            meta = master.get(pid, {})
            granular = lineup_granular_position_id_by_player(content).get(pid)
            usual = lineup_usual_position_by_player(content).get(pid)
            affected.append(
                {
                    "player_id": pid,
                    "player_name": meta.get("player_name") or pdata.get("name", "?"),
                    "team": meta.get("team_name") or pdata.get("teamName", "?"),
                    "listed_position": meta.get("position", "?"),
                    "match": match_label,
                    "match_file": fp.name,
                    "lineup_usual": ROLE.get(usual, str(usual)),
                    "position_id": granular,
                    "old_counting_role": ROLE.get(old, str(old)),
                    "new_counting_role": ROLE.get(new, str(new)),
                    "reason": _reason(content, pid, old, new),
                    "in_master_list": pid in master,
                }
            )

    affected.sort(key=lambda r: (r["player_name"], r["match"]))

    out_json = ROOT / "Scores" / "gw1_position_map_affected_players.json"
    out_csv = ROOT / "Scores" / "gw1_position_map_affected_players.csv"
    out_json.write_text(json.dumps(affected, indent=2), encoding="utf-8")

    if affected:
        fields = list(affected[0].keys())
        with out_csv.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(affected)

    print(f"GW1 matches scanned: {match_dir}")
    print(f"Players with CHANGED counting role: {len(affected)}")
    print(f"Wrote {out_json}")
    if affected:
        print(f"Wrote {out_csv}")
    print()

    # Group by transition
    by_transition: dict[str, list[dict[str, Any]]] = {}
    for row in affected:
        t = f"{row['old_counting_role']} -> {row['new_counting_role']}"
        by_transition.setdefault(t, []).append(row)

    for transition, rows in sorted(by_transition.items()):
        print(f"=== {transition} ({len(rows)}) ===")
        for r in rows:
            print(
                f"  {r['player_name']} ({r['player_id']}) | {r['team']} | "
                f"listed={r['listed_position']} | {r['match']} | "
                f"posId={r['position_id']} usual={r['lineup_usual']} | {r['reason']}"
            )
        print()

    in_pool = sum(1 for r in affected if r["in_master_list"])
    print(f"In master player pool: {in_pool}/{len(affected)}")


if __name__ == "__main__":
    main()
