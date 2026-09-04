"""
Audit GW1 outfield players whose in-match position was NOT handled by position_roles
overrides, so counting role came from lineup usualPlayingPositionId / usualPosition only.

Compares scoring role vs master_player_list listed position (Defender/Midfielder/Forward).

Run from repo root:
  python Scores/audit_unmapped_positions_gw1.py
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
from stat_collection import extract_stat_map, KEY_MINUTES
from position_roles import (
    GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD,
    ALL_HANDLED_TOPPLAYER_KEYS,
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

HANDLED_TOPPLAYER_KEYS = ALL_HANDLED_TOPPLAYER_KEYS

KNOWN_GRANULAR_RULES = GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD | WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS


def listed_to_role(position: str | None) -> str | None:
    if not position:
        return None
    p = position.strip().lower()
    if p == "defender":
        return "DEF"
    if p == "midfielder":
        return "MID"
    if p == "forward":
        return "FWD"
    if p == "goalkeeper":
        return None
    return None


def topplayer_info(content: dict[str, Any], pid: int) -> dict[str, str] | None:
    top = (content.get("matchFacts") or {}).get("topPlayers") or {}
    for bucket in ("homeTopPlayers", "awayTopPlayers"):
        for p in top.get(bucket) or []:
            if not isinstance(p, dict):
                continue
            try:
                if int(p.get("playerId")) != pid:
                    continue
            except (TypeError, ValueError):
                continue
            pl = p.get("positionLabel") or {}
            return {
                "label": str(pl.get("label") or ""),
                "key": str(pl.get("key") or "").strip().lower(),
                "bucket": bucket,
            }
    return None


def resolve_lineup_baseline(content: dict[str, Any], pid: int, pdata: dict[str, Any]) -> int | None:
    """Lineup usualPlayingPositionId or playerStats.usualPosition — no topPlayers / granular rules."""
    if pdata.get("isGoalkeeper") is True:
        return None
    lineup_pos = lineup_usual_position_by_player(content)
    pos = lineup_pos.get(pid)
    if pos is None:
        up = pdata.get("usualPosition")
        if up is not None:
            pos = int(up)
    if pos is None or pos == 0 or pos not in (1, 2, 3):
        return None
    return pos


def minutes_played(pdata: dict[str, Any]) -> float:
    m = extract_stat_map(pdata)
    block = m.get(KEY_MINUTES) or {}
    try:
        return float(block.get("value") or 0)
    except (TypeError, ValueError):
        return 0.0


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

    all_topplayer_keys: set[str] = set()
    all_granular_ids: set[int] = set()
    rows: list[dict[str, Any]] = []
    lineup_only_rows: list[dict[str, Any]] = []
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
        overrides = role_override_by_player(content)
        granular_by_player = lineup_granular_position_id_by_player(content)

        for pid_str, pdata in player_stats.items():
            if not isinstance(pdata, dict):
                continue
            if pdata.get("isGoalkeeper") is True:
                continue
            try:
                pid = int(pdata.get("id", pid_str))
            except (TypeError, ValueError):
                continue

            mins = minutes_played(pdata)
            if mins <= 0:
                continue

            key = (pid, fp.name)
            if key in seen:
                continue
            seen.add(key)

            tp = topplayer_info(content, pid)
            if tp and tp["key"]:
                all_topplayer_keys.add(tp["key"])

            baseline = resolve_lineup_baseline(content, pid, pdata)
            scoring = resolve_outfield_position_id_for_scoring(content, pid, pdata)
            meta = master.get(pid, {})
            listed = listed_to_role(meta.get("position"))
            granular = granular_by_player.get(pid)
            if granular is not None:
                all_granular_ids.add(int(granular))
            usual_lineup = lineup_usual_position_by_player(content).get(pid)

            override_role = overrides.get(pid)
            granular_85 = granular in GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD
            winger_label = tp is not None and tp["key"] in _TOPPLAYER_WINGER_KEYS
            winger_skipped = (
                winger_label
                and granular is not None
                and granular not in WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS
            )
            unmapped_topplayer = tp is not None and tp["key"] and tp["key"] not in HANDLED_TOPPLAYER_KEYS

            override_applied = scoring is not None and baseline is not None and scoring != baseline
            scoring_equals_listed = (
                scoring is not None and listed is not None and ROLE.get(scoring) == listed
            )
            scoring_equals_baseline = (
                scoring is not None and baseline is not None and scoring == baseline
            )

            # Primary: unmapped topPlayers label; counting role = lineup baseline only
            flag_unmapped_defaults_lineup = unmapped_topplayer and scoring_equals_baseline

            # Winger label present but granular not 83/87 → no winger→MID rule
            flag_winger_rule_skipped = winger_skipped and scoring_equals_baseline

            # Scoring role matches master list while only baseline (no override) was used
            flag_scored_as_listed_via_baseline = (
                scoring_equals_listed and scoring_equals_baseline and listed is not None
            )

            # Interesting: unmapped label AND scored same as listed (user's question)
            flag_user_concern = (
                flag_unmapped_defaults_lineup and scoring_equals_listed and listed is not None
            ) or (
                flag_winger_rule_skipped
                and scoring_equals_listed
                and listed is not None
                and ROLE.get(baseline) == listed
            )

            row = {
                "player_id": pid,
                "player_name": meta.get("player_name") or pdata.get("name", "?"),
                "team": meta.get("team_name") or pdata.get("teamName", "?"),
                "listed_position": meta.get("position", "?"),
                "listed_role": listed or "",
                "match": match_label,
                "match_file": fp.name,
                "minutes": round(mins, 1),
                "lineup_usual": ROLE.get(usual_lineup, str(usual_lineup) if usual_lineup else ""),
                "baseline_counting_role": ROLE.get(baseline, "") if baseline else "",
                "scoring_counting_role": ROLE.get(scoring, "") if scoring else "EXCLUDED",
                "granular_position_id": granular if granular is not None else "",
                "topplayers_label": tp["label"] if tp else "",
                "topplayers_key": tp["key"] if tp else "",
                "override_applied": override_applied,
                "unmapped_topplayers_key": unmapped_topplayer,
                "winger_rule_skipped": winger_skipped,
                "scored_as_listed_role": scoring_equals_listed,
                "flag_user_concern": flag_user_concern,
                "in_master_list": pid in master,
                "notes": _notes(
                    unmapped_topplayer,
                    winger_skipped,
                    scoring,
                    baseline,
                    listed,
                    granular,
                    override_applied,
                ),
            }

            if scoring_equals_baseline and scoring is not None:
                lineup_only_rows.append(row)

            if not (
                flag_unmapped_defaults_lineup
                or flag_winger_rule_skipped
                or scoring is None
                or (unmapped_topplayer and scoring_equals_listed)
            ):
                continue

            rows.append(row)

    rows.sort(key=lambda r: (not r["flag_user_concern"], r["player_name"], r["match"]))

    listed_via_lineup = [
        r for r in lineup_only_rows if r["scored_as_listed_role"] and r["listed_role"]
    ]
    lineup_differs_listed = [
        r
        for r in lineup_only_rows
        if r["listed_role"] and r["scoring_counting_role"] != r["listed_role"]
    ]

    out_json = ROOT / "Scores" / "gw1_unmapped_position_audit.json"
    out_csv = ROOT / "Scores" / "gw1_unmapped_position_audit.csv"
    out_keys = ROOT / "Scores" / "gw1_topplayers_label_keys.json"
    out_lineup = ROOT / "Scores" / "gw1_lineup_only_scoring_audit.json"
    out_granular = ROOT / "Scores" / "gw1_granular_position_ids.json"

    out_json.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    out_lineup.write_text(
        json.dumps(
            {
                "scored_as_listed_via_lineup_baseline": listed_via_lineup,
                "lineup_baseline_differs_from_listed": lineup_differs_listed,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    out_keys.write_text(
        json.dumps(
            {
                "handled": sorted(HANDLED_TOPPLAYER_KEYS),
                "seen_in_gw1": sorted(all_topplayer_keys),
                "unhandled_seen": sorted(all_topplayer_keys - HANDLED_TOPPLAYER_KEYS),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    out_granular.write_text(
        json.dumps(
            {
                "granular_position_ids_in_gw1_lineups": sorted(all_granular_ids),
                "ids_with_explicit_rules": sorted(KNOWN_GRANULAR_RULES),
                "ids_without_explicit_rule": sorted(all_granular_ids - KNOWN_GRANULAR_RULES),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    if rows:
        fields = list(rows[0].keys())
        with out_csv.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)

    concerns = [r for r in rows if r["flag_user_concern"]]
    unmapped = [r for r in rows if r["unmapped_topplayers_key"]]
    winger_skip = [r for r in rows if r["winger_rule_skipped"]]
    excluded = [r for r in rows if r["scoring_counting_role"] == "EXCLUDED"]

    print(f"GW1 matches: {match_dir}")
    print(f"Unique topPlayers positionLabel.key values: {len(all_topplayer_keys)}")
    print(f"  Handled: {sorted(HANDLED_TOPPLAYER_KEYS)}")
    unhandled_keys = sorted(all_topplayer_keys - HANDLED_TOPPLAYER_KEYS)
    print(f"  Unhandled keys seen: {unhandled_keys}")
    print(f"Played outfield rows (lineup-baseline only): {len(lineup_only_rows)}")
    print(f"  Lineup baseline matches master listed role: {len(listed_via_lineup)}")
    print(f"  Lineup baseline DIFFERS from master listed: {len(lineup_differs_listed)}")
    print(f"Granular positionIds in GW1 lineups: {sorted(all_granular_ids)}")
    print(f"  Without explicit granular rule: {sorted(all_granular_ids - KNOWN_GRANULAR_RULES)}")
    print()
    print(f"Rows flagged (unmapped / winger-skipped / excluded): {len(rows)}")
    print(f"  Unmapped topPlayers key (used lineup baseline): {len(unmapped)}")
    print(f"  Winger rule skipped (granular not 83/87): {len(winger_skip)}")
    print(f"  Scoring excluded (no DEF/MID/FWD line): {len(excluded)}")
    print(f"  User concern (unmapped/winger-skip + scored as listed role): {len(concerns)}")
    print(f"Wrote {out_json}")
    if rows:
        print(f"Wrote {out_csv}")
    print(f"Wrote {out_keys}")
    print(f"Wrote {out_lineup}")
    print(f"Wrote {out_granular}")
    print()

    if concerns:
        print("=== Scored using lineup baseline; matches master listed role (review) ===")
        for r in concerns:
            print(
                f"  {r['player_name']} ({r['player_id']}) | {r['team']} | {r['match']} | "
                f"listed={r['listed_position']} | scoring={r['scoring_counting_role']} | "
                f"lineup={r['lineup_usual']} | topPlayers={r['topplayers_key'] or '-'} | "
                f"posId={r['granular_position_id'] or '-'} | {r['notes']}"
            )
        print()

    if winger_skip:
        print("=== Winger topPlayers label but granular not 83/87 (lineup baseline used) ===")
        for r in winger_skip:
            print(
                f"  {r['player_name']} ({r['player_id']}) | {r['match']} | "
                f"listed={r['listed_position']} scoring={r['scoring_counting_role']} | "
                f"key={r['topplayers_key']} posId={r['granular_position_id']}"
            )
        print()

    if lineup_differs_listed:
        print("=== Lineup usual used for scoring; DIFFERS from master listed role ===")
        for r in sorted(lineup_differs_listed, key=lambda x: x["player_name"])[:40]:
            print(
                f"  {r['player_name']} ({r['player_id']}) | {r['match']} | "
                f"listed={r['listed_position']} ({r['listed_role']}) | "
                f"scoring={r['scoring_counting_role']} | lineup={r['lineup_usual']} | "
                f"topPlayers={r['topplayers_key'] or '-'} posId={r['granular_position_id'] or '-'}"
            )
        if len(lineup_differs_listed) > 40:
            print(f"  ... and {len(lineup_differs_listed) - 40} more (see {out_lineup.name})")
        print()

    if unmapped:
        print("=== Unmapped topPlayers keys (all) ===")
        by_key: dict[str, list[str]] = {}
        for r in unmapped:
            by_key.setdefault(r["topplayers_key"], []).append(r["player_name"])
        for k, names in sorted(by_key.items()):
            print(f"  {k}: {', '.join(sorted(set(names)))}")


def _notes(
    unmapped: bool,
    winger_skipped: bool,
    scoring: int | None,
    baseline: int | None,
    listed: str | None,
    granular: int | None,
    override_applied: bool,
) -> str:
    parts: list[str] = []
    if scoring is None:
        parts.append("excluded from stat/endowment scoring")
    if unmapped:
        parts.append("topPlayers key not in position map")
    if winger_skipped:
        parts.append(f"winger label but positionId={granular} not in 83/87")
    if override_applied:
        parts.append("override applied")
    elif baseline is not None and scoring == baseline:
        parts.append("counting role = lineup usual only")
    if listed and scoring is not None and ROLE.get(scoring) == listed:
        parts.append("matches master listed role")
    return "; ".join(parts)


if __name__ == "__main__":
    main()
