"""
Endowed points calculator.

Given a FotMob-style match JSON, derive for each player:
- when they are on the field (using Substitution events + lineup starters)
- how many team goals were scored/conceded while they're on field (using Goal events)
- total on-field minutes (from the same derived intervals)

Then compute:
- Defenders: base 10 (or 5 if <45 mins) and -5 per goal conceded while on field
- Midfielders: base 5 (or 2.5 if <45 mins) and +2 per goal scored, -2 per goal conceded while on field
- Forwards: base 0 (or -2.5 if <45 mins) and +3 per goal scored while on field

Output: CSVs in `Tests/` or `Tests/export_run/` if target files are locked.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


TESTS_DIR = Path(__file__).resolve().parent
DEFAULT_JSON = TESTS_DIR / "Match1.json"

OUT_DEF = TESTS_DIR / "endowed_points_defenders.csv"
OUT_MID = TESTS_DIR / "endowed_points_midfielders.csv"
OUT_FWD = TESTS_DIR / "endowed_points_forwards.csv"


@dataclass
class PlayerState:
    on: bool = False
    entered_at: int | None = None  # match minute when they entered the pitch
    minutes: float = 0.0
    goals_for: int = 0
    goals_against: int = 0


def _input_path() -> Path:
    env = os.environ.get("ENDOWED_POINTS_JSON")
    if env:
        return Path(env)
    return DEFAULT_JSON


def _read_json(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def lineup_usual_position_by_player(content: dict[str, Any]) -> dict[int, int]:
    """
    player_id -> usualPlayingPositionId
    0 = GK, 1 = DEF, 2 = MID, 3 = FWD
    """
    out: dict[int, int] = {}
    lineup = content.get("lineup") or {}
    for side in ("homeTeam", "awayTeam"):
        team = lineup.get(side) or {}
        for bucket in ("starters", "subs"):
            for p in team.get(bucket) or []:
                if not isinstance(p, dict):
                    continue
                pid = p.get("id")
                up = p.get("usualPlayingPositionId")
                if pid is None or up is None:
                    continue
                out[int(pid)] = int(up)
    return out


def role_override_by_player(content: dict[str, Any]) -> dict[int, int]:
    """
    Optional position override from matchFacts.topPlayers.positionLabel.key:
    - rightwinger_short / leftwinger_short -> midfielder (2)
    - striker_short -> forward (3)
    """
    out: dict[int, int] = {}
    top = (content.get("matchFacts") or {}).get("topPlayers") or {}
    keys_to_mid = {"rightwinger_short", "leftwinger_short"}
    keys_to_fwd = {"striker_short"}
    for bucket in ("homeTopPlayers", "awayTopPlayers"):
        for p in top.get(bucket) or []:
            if not isinstance(p, dict):
                continue
            pid = p.get("playerId")
            if pid is None:
                continue
            try:
                pid_i = int(pid)
            except (TypeError, ValueError):
                continue
            label_key = ((p.get("positionLabel") or {}).get("key") or "").strip().lower()
            if label_key in keys_to_mid:
                out[pid_i] = 2
            elif label_key in keys_to_fwd:
                out[pid_i] = 3
    return out


def red_card_count_by_player_from_timeline(data: dict[str, Any]) -> dict[int, int]:
    """
    Not used in the endowed points formula, but handy for debugging.
    Counts type=Card & card=Red only.
    """
    out: dict[int, int] = {}
    evs = (
        data.get("content", {})
        .get("matchFacts", {})
        .get("events", {})
        .get("events")
    )
    if not isinstance(evs, list):
        return out
    for e in evs:
        if not isinstance(e, dict):
            continue
        if e.get("type") != "Card":
            continue
        if e.get("card") != "Red":
            continue
        pid = e.get("playerId")
        if pid is None and isinstance(e.get("player"), dict):
            pid = e["player"].get("id")
        if pid is None:
            continue
        try:
            pid_i = int(pid)
        except (TypeError, ValueError):
            continue
        out[pid_i] = out.get(pid_i, 0) + 1
    return out


def player_meta_from_playerstats(content: dict[str, Any]) -> dict[int, dict[str, Any]]:
    out: dict[int, dict[str, Any]] = {}
    ps = content.get("playerStats") or {}
    if not isinstance(ps, dict):
        return out
    for _pid_str, pdata in ps.items():
        if not isinstance(pdata, dict):
            continue
        pid = pdata.get("id")
        if pid is None:
            continue
        try:
            pid_i = int(pid)
        except (TypeError, ValueError):
            continue
        out[pid_i] = {
            "player_id": pid_i,
            "player_name": pdata.get("name"),
            "team_id": pdata.get("teamId"),
            "team_name": pdata.get("teamName"),
            "is_goalkeeper": pdata.get("isGoalkeeper"),
        }
    return out


def initial_on_field_from_lineup(content: dict[str, Any]) -> set[int]:
    lineup = content.get("lineup") or {}
    on: set[int] = set()
    for side in ("homeTeam", "awayTeam"):
        team = lineup.get(side) or {}
        for p in team.get("starters") or []:
            if isinstance(p, dict) and p.get("id") is not None:
                try:
                    on.add(int(p["id"]))
                except (TypeError, ValueError):
                    continue
    return on


def compute_on_field_and_goals(data: dict[str, Any]) -> dict[int, PlayerState]:
    """
    Derive per-player on-field minutes and goals for/against while on field.
    We update on-field sets based on Substitution events using `swap` and the current on-field set.
    """
    content = data.get("content") or {}
    player_meta = player_meta_from_playerstats(content)
    home_id = (data.get("general") or {}).get("homeTeam", {}).get("id")
    away_id = (data.get("general") or {}).get("awayTeam", {}).get("id")
    try:
        home_id_i = int(home_id)
        away_id_i = int(away_id)
    except (TypeError, ValueError):
        home_id_i, away_id_i = None, None

    evs = content.get("matchFacts", {}).get("events", {}).get("events", [])
    if not isinstance(evs, list):
        evs = []

    # match end: take last Half marker if present, else max event time, else 90
    half_times = [e.get("time") for e in evs if isinstance(e, dict) and e.get("type") == "Half" and isinstance(e.get("time"), (int, float))]
    match_end = int(
        max(half_times)
        if half_times
        else (max([e.get("time") for e in evs if isinstance(e, dict)], default=90) or 90)
    )

    usual_pos = lineup_usual_position_by_player(content)  # for later filter only

    # init player states for everyone we might encounter
    states: dict[int, PlayerState] = {pid: PlayerState() for pid in player_meta.keys()}

    on_field = initial_on_field_from_lineup(content)
    for pid in on_field:
        if pid not in states:
            states[pid] = PlayerState()
        states[pid].on = True
        states[pid].entered_at = 0

    # helper: team id from player
    def team_of(pid: int) -> int | None:
        meta = player_meta.get(pid)
        if not meta:
            return None
        try:
            return int(meta.get("team_id")) if meta.get("team_id") is not None else None
        except (TypeError, ValueError):
            return None

    # Process events in listed order. Many JSONs are consistent in that order within a minute.
    for e in evs:
        if not isinstance(e, dict):
            continue
        et = e.get("type")
        t = e.get("time")
        if not isinstance(t, (int, float)):
            continue
        t_int = int(t)

        if et == "Substitution":
            swap = e.get("swap")
            if not isinstance(swap, list) or len(swap) != 2:
                continue
            # Determine which player is currently on field (outgoing) and which enters (incoming)
            p0 = swap[0] if isinstance(swap[0], dict) else {}
            p1 = swap[1] if isinstance(swap[1], dict) else {}
            pid0 = p0.get("id")
            pid1 = p1.get("id")
            if pid0 is None or pid1 is None:
                continue
            try:
                pid0_i = int(pid0)
                pid1_i = int(pid1)
            except (TypeError, ValueError):
                continue

            if pid0_i in on_field and pid1_i not in on_field:
                outgoing, incoming = pid0_i, pid1_i
            elif pid1_i in on_field and pid0_i not in on_field:
                outgoing, incoming = pid1_i, pid0_i
            else:
                # Fallback: if both are on field (unlikely), keep ordering; if both off, skip.
                continue

            # outgoing leaves
            if outgoing not in states:
                states[outgoing] = PlayerState()
            if states[outgoing].on and states[outgoing].entered_at is not None:
                states[outgoing].minutes += float(t_int - states[outgoing].entered_at)
            states[outgoing].on = False
            states[outgoing].entered_at = None
            on_field.discard(outgoing)

            # incoming enters
            if incoming not in states:
                states[incoming] = PlayerState()
            states[incoming].on = True
            states[incoming].entered_at = t_int
            on_field.add(incoming)

        elif et == "Goal":
            # Determine scoring team by event's isHome flag if possible
            is_home_player = e.get("isHome")
            if home_id_i is None or away_id_i is None:
                scoring_team_id = None
            else:
                scoring_team_id = home_id_i if is_home_player is True else away_id_i

            if scoring_team_id is None:
                continue

            # Update all players currently on field
            for pid in on_field:
                ps = states.setdefault(pid, PlayerState())
                pid_team = team_of(pid)
                if pid_team is None:
                    continue
                if pid_team == scoring_team_id:
                    ps.goals_for += 1
                else:
                    ps.goals_against += 1

        else:
            continue

    # Close any still-on players at match end
    for pid in list(on_field):
        st = states.setdefault(pid, PlayerState())
        if st.on and st.entered_at is not None:
            st.minutes += float(match_end - st.entered_at)
        st.on = False
        st.entered_at = None
    return states


def endowment_points_for_position(position_id: int, minutes: float, goals_for: int, goals_against: int) -> float:
    """
    position_id: 1 DEF, 2 MID, 3 FWD (usualPlayingPositionId)
    """
    is_short = minutes < 45
    if position_id == 1:
        base = 5.0 if is_short else 10.0
        return base - (5.0 * goals_against)
    if position_id == 2:
        base = 2.5 if is_short else 5.0
        return base + (2.0 * goals_for) - (2.0 * goals_against)
    if position_id == 3:
        base = -2.5 if is_short else 0.0
        return base + (3.0 * goals_for)
    return 0.0


def _write_df_csv(df: pd.DataFrame, path: Path) -> Path:
    try:
        df.to_csv(path, index=False, encoding="utf-8")
        return path
    except PermissionError:
        alt = path.parent / "export_run" / path.name
        alt.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(alt, index=False, encoding="utf-8")
        print(f"Warning: could not write {path} (file in use?). Wrote {alt} instead.")
        return alt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path", nargs="?", default=None)
    parser.add_argument("--player-id", type=int, default=None, help="Optional: print endowed points for one player")
    args = parser.parse_args()

    path = Path(args.json_path) if args.json_path else _input_path()
    data = _read_json(path)
    content = data.get("content") or {}

    player_meta = player_meta_from_playerstats(content)
    usual_pos = lineup_usual_position_by_player(content)
    role_overrides = role_override_by_player(content)

    states = compute_on_field_and_goals(data)

    rows: list[dict[str, Any]] = []
    for pid, st in states.items():
        if st.minutes <= 0:
            continue
        pos = role_overrides.get(pid, usual_pos.get(pid))
        if pos is None:
            # fallback: if playerStats has usualPosition, but we don't load it here
            # so we rely on lineup only.
            continue
        if pos == 0:
            continue

        meta = player_meta.get(pid, {})
        team_id = meta.get("team_id")
        team_name = meta.get("team_name")
        player_name = meta.get("player_name")

        points = endowment_points_for_position(pos, st.minutes, st.goals_for, st.goals_against)
        rows.append(
            {
                "player_id": pid,
                "player_name": player_name,
                "team_id": team_id,
                "team_name": team_name,
                "usual_playing_position_id": pos,
                "minutes_played_derived": st.minutes,
                "goals_for_while_on_field": st.goals_for,
                "goals_against_while_on_field": st.goals_against,
                "endowed_points": points,
            }
        )

    df = pd.DataFrame(rows)
    d = df[df["usual_playing_position_id"] == 1].copy()
    m = df[df["usual_playing_position_id"] == 2].copy()
    f = df[df["usual_playing_position_id"] == 3].copy()

    p1 = _write_df_csv(d, OUT_DEF)
    p2 = _write_df_csv(m, OUT_MID)
    p3 = _write_df_csv(f, OUT_FWD)

    print(f"Input: {path}")
    print(f"Defenders: {len(d)} -> {p1}")
    print(f"Midfielders: {len(m)} -> {p2}")
    print(f"Forwards: {len(f)} -> {p3}")

    if args.player_id is not None:
        pid = args.player_id
        row = df[df["player_id"] == pid]
        if row.empty:
            print(f"No derived endowed points found for player_id={pid} (either GK, not in lineup, or never on pitch).")
        else:
            print(row.to_string(index=False))


if __name__ == "__main__":
    main()

