"""
Audit whether Best XI formation logic used in-game (match) positions.

Usage (repo root):
  python procedures/audit_ingame_formation_usage.py --gw-id 4 --auction-id 6
  python procedures/audit_ingame_formation_usage.py --gw-id 4 --auction-id 6 --player-id 839204
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_PROC = Path(__file__).resolve().parent
if str(_PROC) not in sys.path:
    sys.path.insert(0, str(_PROC))

from best_xi import (  # noqa: E402
    _norm_pos,
    build_eligible_roles,
    load_master_player_list,
    union_match_roles_for_gameweek,
)
from compute_auction_best_xi import _gw_match_json_paths  # noqa: E402
from formation_match_roles import (  # noqa: E402
    load_match_json,
    outfield_roles_by_player_for_match,
)
from position_roles import (  # noqa: E402
    lineup_granular_position_id_by_player,
    role_override_by_player,
)

_ROLE_LETTER = {1: "D", 2: "M", 3: "F"}


def audit_player(
    pid: int,
    master: dict,
    union: dict[int, frozenset[str]],
    matches_dir: Path,
) -> None:
    meta = master.get(pid) or {}
    listed = meta.get("position")
    mroles = union.get(pid)
    elig = build_eligible_roles(listed, mroles)
    print(f"\n=== Player {pid}: {meta.get('player_name', '?')} ===")
    print(f"  Listed pool position: {listed}")
    print(f"  Match-role union: {sorted(mroles) if mroles else '(none)'}")
    print(f"  Best XI eligible roles: {sorted(elig)}")

    for p in sorted(_gw_match_json_paths(matches_dir)):
        content = load_match_json(p).get("content") or {}
        stats = content.get("playerStats") or {}
        if str(pid) not in stats and pid not in stats:
            continue
        per = outfield_roles_by_player_for_match(content)
        if pid not in per:
            continue
        gran = lineup_granular_position_id_by_player(content).get(pid)
        tp = role_override_by_player(content).get(pid)
        print(
            f"  {p.name}: resolved={_ROLE_LETTER.get(per[pid])} "
            f"granularPosId={gran} topPlayersOverride={tp}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit in-game position usage in Best XI.")
    parser.add_argument("--gw-id", type=int, required=True)
    parser.add_argument("--auction-id", type=int, required=True)
    parser.add_argument("--player-id", type=int, default=None)
    parser.add_argument(
        "--matches-dir",
        type=Path,
        default=_ROOT / "Matches_Raw" / "World Cup 2026",
    )
    parser.add_argument(
        "--best-xi-json",
        type=Path,
        default=None,
        help="Defaults to Scores/best_xi_auction_{auction}_{gw}.json",
    )
    args = parser.parse_args()

    master_path = _ROOT / "Player_List" / "master_player_list.csv"
    master = load_master_player_list(master_path)
    match_paths = _gw_match_json_paths(args.matches_dir)
    union = union_match_roles_for_gameweek(match_paths)

    xi_path = args.best_xi_json or (
        _ROOT / "Scores" / f"best_xi_auction_{args.auction_id}_gw{args.gw_id}.json"
    )
    if not xi_path.is_file():
        raise SystemExit(f"Best XI JSON not found: {xi_path}")

    xi = json.loads(xi_path.read_text(encoding="utf-8"))
    print(f"GW{args.gw_id} Auction {args.auction_id}")
    print(f"Match JSON files scanned for roles: {len(match_paths)} ({args.matches_dir})")
    print(f"Best XI source: {xi_path.name}")
    print(f"Meta: {xi.get('meta')}")

    if args.player_id is not None:
        audit_player(args.player_id, master, union, args.matches_dir)

    flex_picks: list[tuple] = []
    no_match_data = 0
    had_match_data = 0
    xi_used_flex = 0
    xi_listed_diff = 0
    match_only_expansion = 0

    for m in xi.get("managers", []):
        for o in m.get("outfield", []):
            pid = int(o["player_id"])
            meta = master.get(pid) or {}
            listed_r = _norm_pos(meta.get("position"))
            xi_r = o["role"]
            mroles = union.get(pid)
            elig = build_eligible_roles(meta.get("position"), mroles)

            if not mroles:
                no_match_data += 1
            else:
                had_match_data += 1
                listed_set = {listed_r} if listed_r else set()
                if mroles - frozenset(listed_set):
                    match_only_expansion += 1

            if o.get("flexible"):
                xi_used_flex += 1
                flex_picks.append(
                    (
                        m["user_name"],
                        o["player_name"],
                        listed_r,
                        xi_r,
                        sorted(elig),
                        sorted(mroles) if mroles else [],
                    )
                )
            if listed_r and listed_r != xi_r:
                xi_listed_diff += 1

    total_of = sum(len(m.get("outfield", [])) for m in xi.get("managers", []))
    managers = len(xi.get("managers", []))

    print(f"\n=== SUMMARY ({managers} managers, {total_of} outfield XI slots) ===")
    print(f"XI picks where player had in-match role data: {had_match_data}/{total_of}")
    print(f"XI picks where only listed pool position applied (no match JSON): {no_match_data}/{total_of}")
    print(
        f"XI picks where match roles added eligibility beyond listed: {match_only_expansion}/{total_of}"
    )
    print(f"XI picks marked flexible (in-game allowed different line): {xi_used_flex}/{total_of}")
    print(f"XI picks slotted in a different line than listed pool: {xi_listed_diff}/{total_of}")

    if flex_picks:
        print("\nFlexible XI picks (manager | player | listed | XI slot | eligible | match roles):")
        for row in flex_picks:
            print(f"  {row[0]:20} | {row[1]:22} | {row[2]} -> {row[3]} | elig={row[4]} | match={row[5]}")


if __name__ == "__main__":
    main()
